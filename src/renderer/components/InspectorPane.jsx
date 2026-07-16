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
    profileHistoryWindow = 10
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
    </aside>
  );
}
