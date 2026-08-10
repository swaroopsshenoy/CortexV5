import { DiffEditor } from "@monaco-editor/react";

export default function DiffViewer({
  originalCode,
  modifiedCode,
  language = "cpp",
  onAccept,
  onReject,
  onClose
}) {
  return (
    <div className="diff-viewer-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', borderLeft: '1px solid #444' }}>
      <div className="diff-viewer-header" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', backgroundColor: '#2d2d2d', borderBottom: '1px solid #444' }}>
        <span style={{ fontWeight: 'bold' }}>Optimization Preview</span>
        <div className="diff-viewer-actions" style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => onAccept(modifiedCode)}
            data-tooltip="Accept and apply the optimized code to the active file"
            style={{ padding: '4px 12px', backgroundColor: '#3a7e3a', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Accept
          </button>
          <button 
            onClick={onReject}
            data-tooltip="Reject these changes and keep the original code"
            style={{ padding: '4px 12px', backgroundColor: '#8a3333', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Reject
          </button>
          <button 
            onClick={onClose}
            data-tooltip="Close the diff viewer without applying changes"
            style={{ padding: '4px 8px', backgroundColor: 'transparent', color: '#ccc', border: '1px solid #666', borderRadius: '4px', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      </div>
      <div style={{ flex: 1 }}>
        <DiffEditor
          original={originalCode}
          modified={modifiedCode}
          language={language}
          theme="vs-dark"
          options={{
            readOnly: true,
            renderSideBySide: false,
            minimap: { enabled: false },
            fontSize: 14,
            scrollBeyondLastLine: false,
          }}
        />
      </div>
    </div>
  );
}
