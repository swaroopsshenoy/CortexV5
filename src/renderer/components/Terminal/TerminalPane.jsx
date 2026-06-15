import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { ipcClient } from "../../ipc/client";

function toPrintableInput(input) {
  return String(input ?? "").replace(/[\x00-\x08\x0b-\x1f\x7f]/g, "");
}

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

const TerminalPane = forwardRef(function TerminalPane(props, ref) {
  const {
    quickFixCards = [],
    onQuickFixSelect,
    profileHistory = [],
    profileHistoryWindow = 10
  } = props;
  const hostRef = useRef(null);
  const terminalRef = useRef(null);
  const fitAddonRef = useRef(null);
  const lineBufferRef = useRef("");
  const [historyCount, setHistoryCount] = useState(0);
  const [expandedCardIds, setExpandedCardIds] = useState({});
  const trendEntries = Array.isArray(profileHistory) ? profileHistory : [];
  const trendValues = trendEntries
    .map((entry) => entry?.meanMs)
    .filter((value) => typeof value === "number" && !Number.isNaN(value));
  const trendMin = trendValues.length > 0 ? Math.min(...trendValues) : 0;
  const trendMax = trendValues.length > 0 ? Math.max(...trendValues) : 0;
  const trendSpan = trendMax - trendMin || 1;
  const chartWidth = 280;
  const chartHeight = 120;
  const chartPadding = 10;
  const trendCoords = trendValues.map((value, index) => {
    const ratio = trendValues.length > 1 ? index / (trendValues.length - 1) : 0;
    const x = chartPadding + ratio * (chartWidth - chartPadding * 2);
    const y =
      chartPadding +
      (1 - (value - trendMin) / trendSpan) * (chartHeight - chartPadding * 2);
    return { x, y, value };
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

  useImperativeHandle(
    ref,
    () => ({
      writeSystem(message) {
        if (!terminalRef.current) {
          return;
        }
        terminalRef.current.writeln(`\r\n[system] ${String(message ?? "")}`);
      }
    }),
    []
  );

  useEffect(() => {
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 12,
      theme: {
        background: "#020617"
      }
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(hostRef.current);
    fitAddon.fit();

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    terminal.writeln("CortexV5 terminal ready.");

    ipcClient
      .terminalStart({})
      .then((result) => {
        terminal.writeln(`Connected shell PID ${result.pid}.`);
      })
      .catch((error) => {
        terminal.writeln(`Failed to start shell: ${error.message}`);
      });

    ipcClient
      .terminalResize({
        cols: terminal.cols,
        rows: terminal.rows
      })
      .catch(() => {});

    ipcClient
      .terminalHistoryList({})
      .then((result) => {
        setHistoryCount(result.entries.length);
      })
      .catch(() => {});

    const disposeData = ipcClient.onTerminalData((payload) => {
      terminal.write(payload.data);
    });
    const disposeExit = ipcClient.onTerminalExit((payload) => {
      terminal.writeln(`\r\n[shell exited: ${payload.code}]`);
    });

    const disposeInput = terminal.onData((data) => {
      if (data === "\u007f") {
        if (lineBufferRef.current.length > 0) {
          lineBufferRef.current = lineBufferRef.current.slice(0, -1);
        }
        ipcClient.terminalWrite({ data }).catch(() => {});
        return;
      }

      ipcClient.terminalWrite({ data }).catch(() => {});

      if (data === "\r") {
        const command = lineBufferRef.current.trim();
        if (command.length > 0) {
          ipcClient
            .terminalRecordHistory({ command })
            .then(() => {
              setHistoryCount((count) => count + 1);
            })
            .catch(() => {});
        }
        lineBufferRef.current = "";
        return;
      }

      if (data.startsWith("\u001b")) {
        return;
      }

      lineBufferRef.current += toPrintableInput(data);
    });

    const handleResize = () => {
      fitAddon.fit();
      ipcClient
        .terminalResize({
          cols: terminal.cols,
          rows: terminal.rows
        })
        .catch(() => {});
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      disposeInput.dispose();
      disposeData();
      disposeExit();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  function handleClear() {
    terminalRef.current?.clear();
  }

  function handleStop() {
    ipcClient.terminalInterrupt({}).catch(() => {});
  }

  function toggleCard(cardKey) {
    setExpandedCardIds((current) => ({
      ...current,
      [cardKey]: !current[cardKey]
    }));
  }

  return (
    <aside className="terminal-pane">
      <div className="terminal-header">
        <strong>Terminal</strong>
        <span className="terminal-history-count">History: {historyCount}</span>
        <div className="terminal-actions">
          <button type="button" onClick={handleClear}>
            Clear
          </button>
          <button type="button" onClick={handleStop}>
            Stop
          </button>
        </div>
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
                  r={3}
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
        <section className="terminal-quickfixes">
          <div className="terminal-quickfixes-title">Quick Fix Cards</div>
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
      <div ref={hostRef} className="terminal-host" />
    </aside>
  );
});

export default TerminalPane;
