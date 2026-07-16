import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { ipcClient } from "../../ipc/client";

function toPrintableInput(input) {
  return String(input ?? "").replace(/[\x00-\x08\x0b-\x1f\x7f]/g, "");
}

const TerminalPane = forwardRef(function TerminalPane(props, ref) {
  const { onCompile, onRun } = props;
  const hostRef = useRef(null);
  const terminalRef = useRef(null);
  const fitAddonRef = useRef(null);
  const lineBufferRef = useRef("");
  const [historyCount, setHistoryCount] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);

  useImperativeHandle(
    ref,
    () => ({
      writeSystem(message, type = "system") {
        if (!terminalRef.current) {
          return;
        }
        const formatted = String(message ?? "").replace(/\r?\n/g, "\r\n");
        let color = "\x1b[34m"; // blue
        if (type === "error") color = "\x1b[31m"; // red
        else if (type === "success") color = "\x1b[32m"; // green
        else if (type === "warning") color = "\x1b[33m"; // yellow
        else if (type === "info") color = "\x1b[36m"; // cyan
        
        terminalRef.current.writeln(`\r\n${color}${formatted}\x1b[0m`);
      },
      resize() {
        if (fitAddonRef.current && terminalRef.current) {
          try {
            fitAddonRef.current.fit();
            ipcClient
              .terminalResize({
                cols: terminalRef.current.cols,
                rows: terminalRef.current.rows
              })
              .catch(() => {});
          } catch (e) {
            // Ignore if terminal isn't ready
          }
        }
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
    
    // Slight delay to ensure layout is ready before initial fit
    setTimeout(() => {
      try {
        fitAddon.fit();
      } catch(e) {}
    }, 10);

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
      try {
        fitAddon.fit();
        ipcClient
          .terminalResize({
            cols: terminal.cols,
            rows: terminal.rows
          })
          .catch(() => {});
      } catch(e) {}
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
  }, [isFullScreen]);

  function handleClear() {
    terminalRef.current?.clear();
  }

  function handleStop() {
    ipcClient.terminalInterrupt({}).catch(() => {});
  }

  function toggleFullScreen() {
    setIsFullScreen((prev) => !prev);
    // Resize after transition
    setTimeout(() => {
      if (fitAddonRef.current && terminalRef.current) {
        try {
          fitAddonRef.current.fit();
          ipcClient.terminalResize({
            cols: terminalRef.current.cols,
            rows: terminalRef.current.rows
          }).catch(() => {});
        } catch(e) {}
      }
    }, 50);
  }

  return (
    <div className={`bottom-terminal-panel ${isFullScreen ? 'terminal-fullscreen' : ''}`}>
      <div className="terminal-header">
        <strong>Terminal</strong>
        <span className="terminal-history-count">History: {historyCount}</span>
        <div className="terminal-actions">
          {onCompile && (
            <button type="button" onClick={onCompile} data-tooltip="Compile the active project">
              Compile
            </button>
          )}
          {onRun && (
            <button type="button" onClick={onRun} data-tooltip="Run the compiled application">
              Run
            </button>
          )}
          <button type="button" onClick={handleClear} data-tooltip="Clear terminal output">
            Clear
          </button>
          <button type="button" onClick={handleStop} data-tooltip="Stop running process">
            Stop
          </button>
          <button type="button" onClick={toggleFullScreen} data-tooltip={isFullScreen ? "Exit full screen" : "Full screen terminal"}>
            {isFullScreen ? "Exit Full Screen" : "Full Screen"}
          </button>
        </div>
      </div>
      <div ref={hostRef} className="terminal-host" />
    </div>
  );
});

export default TerminalPane;
