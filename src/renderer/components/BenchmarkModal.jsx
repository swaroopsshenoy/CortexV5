import React from "react";

export default function BenchmarkModal({ results, onClose }) {
  if (!results || results.length === 0) {
    return null;
  }

  const overlayStyle = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000
  };

  const modalStyle = {
    backgroundColor: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    padding: "24px",
    width: "80%",
    maxWidth: "800px",
    maxHeight: "80vh",
    overflowY: "auto",
    boxShadow: "0 10px 25px rgba(0,0,0,0.5)"
  };

  const headerStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
    borderBottom: "1px solid var(--border)",
    paddingBottom: "12px"
  };

  const titleStyle = {
    margin: 0,
    fontSize: "1.4rem",
    color: "var(--text)"
  };

  const closeButtonStyle = {
    background: "transparent",
    border: "none",
    color: "var(--muted)",
    fontSize: "1.5rem",
    cursor: "pointer"
  };

  const tableStyle = {
    width: "100%",
    borderCollapse: "collapse",
    textAlign: "left"
  };

  const thStyle = {
    borderBottom: "1px solid var(--border)",
    padding: "10px 8px",
    color: "var(--muted)",
    fontWeight: "bold",
    backgroundColor: "var(--surface2)"
  };

  const tdStyle = {
    borderBottom: "1px solid var(--border)",
    padding: "10px 8px",
    color: "var(--text)"
  };

  const getStatusColor = (status) => {
    if (status === "ok") return "#38a169";
    if (status === "compile-error") return "#e53e3e";
    return "#dd6b20";
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>Batch Benchmark Results</h2>
          <button style={closeButtonStyle} onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>File Name</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Mean (ms)</th>
              <th style={thStyle}>Min / Max (ms)</th>
              <th style={thStyle}>P95 (ms)</th>
            </tr>
          </thead>
          <tbody>
            {results.map((res, index) => {
              const summary = res.summary || {};
              return (
                <tr key={index}>
                  <td style={tdStyle} title={res.outputPath ? `Ran from: ${res.outputPath}` : ""}>
                    <strong>{res.fileName}</strong>
                  </td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: "4px",
                        fontSize: "0.75rem",
                        fontWeight: "600",
                        color: "#fff",
                        backgroundColor: getStatusColor(res.status)
                      }}
                    >
                      {res.status}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    {summary.meanMs != null ? summary.meanMs : "N/A"}
                  </td>
                  <td style={tdStyle}>
                    {summary.minMs != null && summary.maxMs != null
                      ? `${summary.minMs} / ${summary.maxMs}`
                      : "N/A"}
                  </td>
                  <td style={tdStyle}>
                    {summary.p95Ms != null ? summary.p95Ms : "N/A"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ marginTop: "20px", textAlign: "right" }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              backgroundColor: "var(--accent)",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "bold"
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
