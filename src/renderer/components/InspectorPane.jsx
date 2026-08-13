import { useState } from "react";

function formatTimestamp(value) {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}

export default function InspectorPane(props) {
  const {
    quickFixCards = [],
    onQuickFixSelect,
    profileHistory = [],
    profileHistoryWindow = 10,
    simulationResult = null,
    simulationStepIndex = 0,
    onSimulationStepChange
  } = props;

  const [expandedCardIds, setExpandedCardIds] = useState({});
  const trendEntries = Array.isArray(profileHistory) ? profileHistory : [];
  const validEntries = trendEntries.filter(
    (entry) => typeof entry?.meanMs === "number" && !Number.isNaN(entry.meanMs)
  );
  const trendValues = validEntries.map((entry) => entry.meanMs);
  const trendMin = trendValues.length > 0 ? Math.min(...trendValues) : 0;
  const trendMax = trendValues.length > 0 ? Math.max(...trendValues) : 0;
  const trendSpan = trendMax - trendMin || 1;
  const chartWidth = 280;
  const chartHeight = 120;
  const chartPadding = 10;
  const trendCoords = validEntries.map((entry, index) => {
    const value = entry.meanMs;
    const ratio = trendValues.length > 1 ? index / (trendValues.length - 1) : 0;
    const x = chartPadding + ratio * (chartWidth - chartPadding * 2);
    const y =
      chartPadding +
      (1 - (value - trendMin) / trendSpan) * (chartHeight - chartPadding * 2);
    return { x, y, value, file: entry.file };
  });
  const trendPoints = trendCoords.map((coord) => `${coord.x},${coord.y}`).join(" ");
  const trendFirst = trendValues[0];
  const trendLast = trendValues[trendValues.length - 1];
  const trendDeltaPercent =
    typeof trendFirst === "number" && trendFirst !== 0
      ? ((trendLast - trendFirst) / trendFirst) * 100
      : 0;
  const trendBadge =
    trendValues.length > 1
      ? trendDeltaPercent < -0.1
        ? { text: `${Math.abs(trendDeltaPercent).toFixed(1)}% faster`, tone: "improvement" }
        : trendDeltaPercent > 0.1
          ? { text: `${trendDeltaPercent.toFixed(1)}% slower`, tone: "regression" }
          : { text: "Flat", tone: "flat" }
      : { text: "No trend yet", tone: "flat" };
  const trendOldest = formatTimestamp(trendEntries[0]?.timestamp);
  const trendLatest = formatTimestamp(trendEntries[trendEntries.length - 1]?.timestamp);

  function toggleCard(cardKey) {
    setExpandedCardIds((current) => ({
      ...current,
      [cardKey]: !current[cardKey]
    }));
  }

  return (
    <aside className="inspector-pane">
      <div className="inspector-header">
        <strong>Inspector</strong>
      </div>
      <section className="trend-panel">
        <div className="trend-header">
          <div>
            <div className="trend-title">Benchmark Trend</div>
            <div className="trend-subtitle">Mean ms · Last {profileHistoryWindow} runs</div>
          </div>
          <span className={`trend-badge trend-badge--${trendBadge.tone}`}>{trendBadge.text}</span>
        </div>
        {trendValues.length > 0 ? (
          <>
            <svg
              className="trend-chart"
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              role="img"
              aria-label="Benchmark trend chart"
            >
              <polyline className="trend-line" points={trendPoints} />
              {trendCoords.map((coord, index) => (
                <circle
                  key={`${coord.x}-${coord.y}-${index}`}
                  className="trend-point"
                  cx={coord.x}
                  cy={coord.y}
                  r={5}
                  title={coord.file ? `File: ${coord.file}` : "File: unknown"}
                />
              ))}
            </svg>
            <div className="trend-axis">
              <span>{trendOldest || "Oldest"}</span>
              <span>{trendLatest || "Latest"}</span>
            </div>
            <div className="trend-meta">
              <span>Min {trendMin.toFixed(2)} ms</span>
              <span>Max {trendMax.toFixed(2)} ms</span>
              <span>Latest {trendLast.toFixed(2)} ms</span>
            </div>
          </>
        ) : (
          <div className="trend-empty">No benchmark history yet.</div>
        )}
      </section>
      {quickFixCards.length > 0 ? (
        <section className="inspector-quickfixes">
          <div className="inspector-quickfixes-title">Quick Fix Cards</div>
          <ul className="quickfix-list">
            {quickFixCards.map((card) => {
              const cardKey = `${card.id}-${card.explanationTitle}-${card.priority}`;
              const isExpanded = !!expandedCardIds[cardKey];
              return (
                <li key={cardKey} className="quickfix-card">
                  <button
                    type="button"
                    className="quickfix-summary"
                    onClick={() => toggleCard(cardKey)}
                  >
                    <span className="quickfix-summary-text">{card.text}</span>
                    <span
                      className={`quickfix-badge quickfix-badge--${card.actionType}`}
                    >
                      {card.actionType}
                    </span>
                    <span className="quickfix-impact">{card.expectedImpact}</span>
                  </button>
                  {isExpanded ? (
                    <div className="quickfix-details">
                      <div className="quickfix-meta">
                        <span>Issue: {card.explanationTitle}</span>
                        <span>Score: {Math.round(card.relevanceScore * 100)}%</span>
                        <span>Priority: {card.priority}</span>
                      </div>
                      <div className="quickfix-reason">{card.reason}</div>
                      <button
                        type="button"
                        className="quickfix-apply"
                        onClick={() => onQuickFixSelect?.(card)}
                      >
                        Copy and focus line
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {simulationResult ? (
        <section className="simulation-panel" style={{ padding: "12px", borderTop: "1px solid #334155" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <strong style={{ fontSize: "13px", color: "#e2e8f0" }}>Simulation Call Stack</strong>
            <span style={{ fontSize: "11px", color: "#94a3b8" }}>{simulationResult.status}</span>
          </div>

          {Array.isArray(simulationResult.executionTrace) && simulationResult.executionTrace.length > 0 ? (() => {
            const trace = simulationResult.executionTrace;
            const currentIdx = Math.min(Math.max(0, simulationStepIndex), trace.length - 1);
            const currentStep = trace[currentIdx];
            const callStack = currentStep?.callStack || [];

            return (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                  <button
                    type="button"
                    disabled={currentIdx <= 0}
                    onClick={() => onSimulationStepChange?.(currentIdx - 1)}
                    style={{ padding: "2px 8px", fontSize: "12px", cursor: currentIdx <= 0 ? "not-allowed" : "pointer" }}
                  >
                    Prev
                  </button>
                  <span style={{ fontSize: "12px", color: "#cbd5e1" }}>
                    Step {currentIdx + 1} / {trace.length}
                  </span>
                  <button
                    type="button"
                    disabled={currentIdx >= trace.length - 1}
                    onClick={() => onSimulationStepChange?.(currentIdx + 1)}
                    style={{ padding: "2px 8px", fontSize: "12px", cursor: currentIdx >= trace.length - 1 ? "not-allowed" : "pointer" }}
                  >
                    Next
                  </button>
                </div>

                {currentStep && (
                  <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "8px", background: "#0f172a", padding: "6px", borderRadius: "4px" }}>
                    <div>Event: <strong style={{ color: "#38bdf8" }}>{currentStep.eventType}</strong></div>
                    {currentStep.line != null && <div>Line: {currentStep.line}</div>}
                    <div>Detail: {currentStep.detail}</div>
                  </div>
                )}

                <div className="call-stack-list" style={{ background: "#0f172a", borderRadius: "4px", padding: "8px" }}>
                  <div style={{ fontWeight: "600", fontSize: "12px", color: "#cbd5e1", marginBottom: "6px" }}>
                    Call Stack ({callStack.length} frame{callStack.length === 1 ? "" : "s"})
                  </div>
                  {callStack.length > 0 ? (
                    callStack.map((frame) => (
                      <div
                        key={frame.frameId}
                        style={{
                          padding: "6px",
                          marginBottom: "4px",
                          background: "#1e293b",
                          borderRadius: "4px",
                          fontSize: "11px"
                        }}
                      >
                        <div style={{ color: "#f1f5f9", fontWeight: "600" }}>
                          {frame.functionName || "anonymous"}() {frame.line != null ? `(line ${frame.line})` : ""}
                        </div>
                        {frame.params && frame.params.length > 0 && (
                          <div style={{ color: "#94a3b8", marginTop: "2px" }}>
                            Params: {frame.params.map((p) => `${p.name}=${p.value}`).join(", ")}
                          </div>
                        )}
                        {frame.locals && frame.locals.length > 0 && (
                          <div style={{ color: "#94a3b8", marginTop: "2px" }}>
                            Locals: {frame.locals.map((l) => `${l.name}=${l.value}`).join(", ")}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: "11px", color: "#64748b" }}>Empty call stack</div>
                  )}
                </div>
              </>
            );
          })() : (
            <div style={{ fontSize: "12px", color: "#64748b" }}>No execution steps recorded.</div>
          )}
        </section>
      ) : null}
    </aside>
  );
}
