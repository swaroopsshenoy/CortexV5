import { useState, useCallback, useEffect, useRef } from "react";
import "./FileExplorer.css";

/* ── Icon helpers ── */

const FILE_ICONS = {
  cpp: { icon: "⟨⟩", cls: "fe-icon--cpp" },
  cc: { icon: "⟨⟩", cls: "fe-icon--cpp" },
  cxx: { icon: "⟨⟩", cls: "fe-icon--cpp" },
  c: { icon: "C", cls: "fe-icon--cpp" },
  h: { icon: "H", cls: "fe-icon--header" },
  hpp: { icon: "H", cls: "fe-icon--header" },
  hxx: { icon: "H", cls: "fe-icon--header" },
  cmake: { icon: "⚙", cls: "fe-icon--cmake" },
  txt: { icon: "📄", cls: "fe-icon--txt" },
  md: { icon: "M↓", cls: "fe-icon--md" },
  json: { icon: "{}", cls: "fe-icon--json" },
  exe: { icon: "▶", cls: "fe-icon--exe" },
  o: { icon: "○", cls: "fe-icon--default" },
  obj: { icon: "○", cls: "fe-icon--default" },
};

function getFileIcon(name, isDir, isOpen) {
  if (isDir) {
    return {
      icon: isOpen ? "📂" : "📁",
      cls: isOpen ? "fe-icon--folder-open" : "fe-icon--folder",
    };
  }
  const lower = name.toLowerCase();
  if (lower === "cmakelists.txt") {
    return { icon: "⚙", cls: "fe-icon--cmake" };
  }
  const ext = lower.split(".").pop();
  return FILE_ICONS[ext] || { icon: "📄", cls: "fe-icon--default" };
}

/* ── Context Menu ── */

function ContextMenu({ x, y, entry, onClose, onNewFile, onNewFolder, onRename, onDelete }) {
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    }
    function handleKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  // Adjust position so menu doesn't overflow viewport
  const style = { left: x, top: y };

  return (
    <div className="fe-context-menu" style={style} ref={menuRef}>
      <button
        type="button"
        className="fe-context-item"
        onClick={() => { onNewFile(); onClose(); }}
      >
        <span className="fe-context-icon">📄</span>
        New File
      </button>
      <button
        type="button"
        className="fe-context-item"
        onClick={() => { onNewFolder(); onClose(); }}
      >
        <span className="fe-context-icon">📁</span>
        New Folder
      </button>
      <div className="fe-context-sep" />
      <button
        type="button"
        className="fe-context-item"
        onClick={() => { onRename(); onClose(); }}
      >
        <span className="fe-context-icon">✏️</span>
        Rename
      </button>
      <div className="fe-context-sep" />
      <button
        type="button"
        className="fe-context-item fe-context-item--danger"
        onClick={() => { onDelete(); onClose(); }}
      >
        <span className="fe-context-icon">🗑</span>
        Delete
      </button>
    </div>
  );
}

/* ── Tree Row ── */

function TreeRow({
  entry,
  depth,
  isOpen,
  isSelected,
  isRenaming,
  renameValue,
  onToggle,
  onSelect,
  onContextMenu,
  onRenameChange,
  onRenameSubmit,
  onRenameCancel,
}) {
  const isDir = entry.kind === "directory";
  const { icon, cls } = getFileIcon(entry.name, isDir, isOpen);

  return (
    <div
      className={`fe-row ${isSelected ? "fe-row--selected" : ""}`}
      onClick={() => {
        if (isDir) onToggle(entry.relativePath);
        onSelect(entry);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onSelect(entry);
        onContextMenu(e, entry);
      }}
    >
      {/* Indent guides */}
      <div className="fe-indent">
        {Array.from({ length: depth }, (_, i) => (
          <div key={i} className="fe-indent-guide" />
        ))}
      </div>

      {/* Chevron */}
      <div
        className={`fe-chevron ${isDir ? (isOpen ? "fe-chevron--open" : "") : "fe-chevron--hidden"}`}
        onClick={(e) => {
          if (isDir) {
            e.stopPropagation();
            onToggle(entry.relativePath);
          }
        }}
      >
        ▶
      </div>

      {/* Icon */}
      <div className={`fe-icon ${cls}`}>{icon}</div>

      {/* Label or rename input */}
      {isRenaming ? (
        <input
          className="fe-rename-input"
          autoFocus
          value={renameValue}
          onChange={(e) => onRenameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onRenameSubmit();
            if (e.key === "Escape") onRenameCancel();
          }}
          onBlur={onRenameCancel}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className={`fe-label ${isDir ? "fe-label--dir" : ""}`}>
          {entry.name}
        </span>
      )}
    </div>
  );
}

/* ── Inline New Input Row ── */

function NewInputRow({ depth, icon, onSubmit, onCancel }) {
  const [value, setValue] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="fe-new-input-row">
      <div className="fe-indent">
        {Array.from({ length: depth }, (_, i) => (
          <div key={i} className="fe-indent-guide" />
        ))}
      </div>
      <div className="fe-chevron fe-chevron--hidden">▶</div>
      <div className="fe-icon">{icon}</div>
      <input
        ref={inputRef}
        className="fe-new-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim()) onSubmit(value.trim());
          if (e.key === "Escape") onCancel();
        }}
        onBlur={onCancel}
        placeholder="Enter name..."
      />
    </div>
  );
}

/* ── Main FileExplorer ── */

export default function FileExplorer({
  entries = [],
  rootPath,
  selectedPath,
  onSelectFolder,
  onSelectEntry,
  onCreate,
  onRename,
  onDelete,
  onRefresh,
}) {
  const [openDirs, setOpenDirs] = useState(new Set());
  const [contextMenu, setContextMenu] = useState(null);
  const [renamingPath, setRenamingPath] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [newInput, setNewInput] = useState(null); // { parentPath, kind, depth }

  const toggleDir = useCallback((path) => {
    setOpenDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const collapseAll = useCallback(() => {
    setOpenDirs(new Set());
  }, []);

  const handleContextMenu = useCallback((e, entry) => {
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      entry,
    });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const startRename = useCallback(() => {
    if (!selectedPath) return;
    setRenamingPath(selectedPath);
    // Extract just the name from the path
    const parts = selectedPath.split("\\");
    setRenameValue(parts[parts.length - 1]);
  }, [selectedPath]);

  const submitRename = useCallback(() => {
    if (!renamingPath || !renameValue.trim()) {
      setRenamingPath(null);
      return;
    }
    // Build new path by replacing last segment
    const parts = renamingPath.split("\\");
    parts[parts.length - 1] = renameValue.trim();
    const newPath = parts.join("\\");
    if (newPath !== renamingPath) {
      onRename(renamingPath, newPath);
    }
    setRenamingPath(null);
  }, [renamingPath, renameValue, onRename]);

  const cancelRename = useCallback(() => {
    setRenamingPath(null);
  }, []);

  const startNewFile = useCallback(() => {
    // Determine parent path and depth
    const ctx = contextMenu?.entry;
    let parentPath = "";
    let depth = 0;
    if (ctx) {
      if (ctx.kind === "directory") {
        parentPath = ctx.relativePath;
        depth = (ctx.relativePath.match(/\\/g) || []).length + 1;
        // Ensure parent is open
        setOpenDirs((prev) => new Set(prev).add(ctx.relativePath));
      } else {
        const parts = ctx.relativePath.split("\\");
        parts.pop();
        parentPath = parts.join("\\");
        depth = parts.length;
      }
    }
    setNewInput({ parentPath, kind: "file", depth });
  }, [contextMenu]);

  const startNewFolder = useCallback(() => {
    const ctx = contextMenu?.entry;
    let parentPath = "";
    let depth = 0;
    if (ctx) {
      if (ctx.kind === "directory") {
        parentPath = ctx.relativePath;
        depth = (ctx.relativePath.match(/\\/g) || []).length + 1;
        setOpenDirs((prev) => new Set(prev).add(ctx.relativePath));
      } else {
        const parts = ctx.relativePath.split("\\");
        parts.pop();
        parentPath = parts.join("\\");
        depth = parts.length;
      }
    }
    setNewInput({ parentPath, kind: "directory", depth });
  }, [contextMenu]);

  const handleNewSubmit = useCallback(
    (name) => {
      if (!newInput) return;
      const fullPath = newInput.parentPath
        ? `${newInput.parentPath}\\${name}`
        : name;
      onCreate(fullPath, newInput.kind);
      setNewInput(null);
    },
    [newInput, onCreate]
  );

  const handleDelete = useCallback(() => {
    if (selectedPath) {
      onDelete(selectedPath);
    }
  }, [selectedPath, onDelete]);

  // Toolbar new file/folder (creates inside selected directory if one exists, otherwise root)
  const getSelectedContext = useCallback(() => {
    if (!selectedPath) return { parentPath: "", depth: 0 };
    
    let found = null;
    const search = (items) => {
      for (const item of items) {
        if (item.relativePath === selectedPath) {
          found = item;
          return;
        }
        if (item.children) search(item.children);
        if (found) return;
      }
    };
    search(entries);

    if (found) {
      if (found.kind === "directory") {
        setOpenDirs((prev) => new Set(prev).add(found.relativePath));
        return {
          parentPath: found.relativePath,
          depth: (found.relativePath.match(/\\/g) || []).length + 1
        };
      } else {
        const parts = found.relativePath.split("\\");
        parts.pop();
        return {
          parentPath: parts.join("\\"),
          depth: parts.length
        };
      }
    }
    return { parentPath: "", depth: 0 };
  }, [selectedPath, entries]);

  const toolbarNewFile = useCallback(() => {
    if (!rootPath) return;
    const ctx = getSelectedContext();
    setNewInput({ parentPath: ctx.parentPath, kind: "file", depth: ctx.depth });
  }, [rootPath, getSelectedContext]);

  const toolbarNewFolder = useCallback(() => {
    if (!rootPath) return;
    const ctx = getSelectedContext();
    setNewInput({ parentPath: ctx.parentPath, kind: "directory", depth: ctx.depth });
  }, [rootPath, getSelectedContext]);

  /* ── Render tree recursively ── */
  function renderEntries(items, depth) {
    const rows = [];

    for (const entry of items) {
      const isDir = entry.kind === "directory";
      const isOpen = openDirs.has(entry.relativePath);
      const isSelected = selectedPath === entry.relativePath;
      const isRenaming = renamingPath === entry.relativePath;

      rows.push(
        <TreeRow
          key={entry.relativePath}
          entry={entry}
          depth={depth}
          isOpen={isOpen}
          isSelected={isSelected}
          isRenaming={isRenaming}
          renameValue={renameValue}
          onToggle={toggleDir}
          onSelect={onSelectEntry}
          onContextMenu={handleContextMenu}
          onRenameChange={setRenameValue}
          onRenameSubmit={submitRename}
          onRenameCancel={cancelRename}
        />
      );

      // Show new input row if creating inside this directory
      if (
        isDir &&
        isOpen &&
        newInput &&
        newInput.parentPath === entry.relativePath
      ) {
        rows.push(
          <NewInputRow
            key={`new-${entry.relativePath}`}
            depth={depth + 1}
            icon={newInput.kind === "file" ? "📄" : "📁"}
            onSubmit={handleNewSubmit}
            onCancel={() => setNewInput(null)}
          />
        );
      }

      // Render children if open
      if (isDir && isOpen && entry.children?.length > 0) {
        rows.push(...renderEntries(entry.children, depth + 1));
      }
    }

    return rows;
  }

  // Extract folder name from rootPath
  const folderName = rootPath ? rootPath.split("\\").pop().toUpperCase() : "EXPLORER";

  return (
    <div className="file-explorer">
      {/* Toolbar */}
      <div className="fe-toolbar">
        <span className="fe-toolbar-title">{folderName}</span>
        <div className="fe-toolbar-actions">
          <button
            type="button"
            className="fe-toolbar-btn"
            title="Open Folder"
            onClick={onSelectFolder}
          >
            📁
          </button>
          <button
            type="button"
            className="fe-toolbar-btn"
            title="New File"
            onClick={toolbarNewFile}
          >
            📄
          </button>
          <button
            type="button"
            className="fe-toolbar-btn"
            title="New Folder"
            onClick={toolbarNewFolder}
          >
            📁
          </button>
          <button
            type="button"
            className="fe-toolbar-btn"
            title="Collapse All"
            onClick={collapseAll}
          >
            ⊟
          </button>
          <button
            type="button"
            className="fe-toolbar-btn"
            title="Refresh"
            onClick={onRefresh}
          >
            ↻
          </button>
        </div>
      </div>

      {/* Open Folder Button (Empty State) */}
      {!rootPath && (
        <div className="fe-open-folder-container">
          <p className="fe-empty-text">You have not yet opened a folder.</p>
          <button
            type="button"
            className="fe-open-folder-btn"
            onClick={onSelectFolder}
          >
            Open Folder
          </button>
        </div>
      )}

      {/* Tree */}
      <div className="fe-tree-container">
        {rootPath && entries.length === 0 && !newInput && (
          <div className="fe-empty">No files in workspace</div>
        )}
        {rootPath && (
          <>
            {/* Root-level new input */}
            {newInput && newInput.parentPath === "" && (
              <NewInputRow
                depth={0}
                icon={newInput.kind === "file" ? "📄" : "📁"}
                onSubmit={handleNewSubmit}
                onCancel={() => setNewInput(null)}
              />
            )}
            {entries.length > 0 && renderEntries(entries, 0)}
          </>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          entry={contextMenu.entry}
          onClose={closeContextMenu}
          onNewFile={startNewFile}
          onNewFolder={startNewFolder}
          onRename={startRename}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
