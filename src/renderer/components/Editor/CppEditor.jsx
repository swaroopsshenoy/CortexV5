import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import Editor from "@monaco-editor/react";
import { buildCompletionItems } from "./cppCompletionProvider";
import { registerCppFormattingProviders, formatCppSource } from "./cppFormattingProvider";

const CppEditor = forwardRef(function CppEditor({
  tab,
  diagnostics,
  focusDiagnostic,
  onCodeChange,
  onSave,
  onCompile
}, ref) {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const completionDisposableRef = useRef(null);
  const formattingDisposablesRef = useRef([]);

  // Expose formatDocument to parent via ref
  useImperativeHandle(ref, () => ({
    formatDocument() {
      const editor = editorRef.current;
      if (!editor) return;
      const action = editor.getAction("editor.action.formatDocument");
      if (action) {
        action.run();
      } else {
        // Fallback: format directly via our formatter
        const model = editor.getModel();
        if (!model) return;
        const formatted = formatCppSource(model.getValue());
        const trimmed = formatted.endsWith("\n") ? formatted.slice(0, -1) : formatted;
        if (trimmed !== model.getValue()) {
          model.pushEditOperations(
            [],
            [{
              range: model.getFullModelRange(),
              text: trimmed
            }],
            () => null
          );
        }
      }
    }
  }), []);

  const markerData = useMemo(
    () =>
      diagnostics.map((item) => ({
        startLineNumber: item.line,
        startColumn: item.column,
        endLineNumber: item.line,
        endColumn: item.column + 1,
        message: item.message,
        severity: item.severity
      })),
    [diagnostics]
  );

  useEffect(() => {
    if (!monacoRef.current || !editorRef.current) {
      return;
    }

    const model = editorRef.current.getModel();
    if (!model) {
      return;
    }

    monacoRef.current.editor.setModelMarkers(model, "compiler", markerData);
  }, [markerData]);

  useEffect(() => {
    if (!focusDiagnostic || !editorRef.current) {
      return;
    }

    const position = {
      lineNumber: Math.max(1, Number(focusDiagnostic.line) || 1),
      column: Math.max(1, Number(focusDiagnostic.column) || 1)
    };

    editorRef.current.setPosition(position);
    editorRef.current.revealPositionInCenter(position);
    editorRef.current.focus();
  }, [focusDiagnostic]);

  useEffect(() => {
    return () => {
      if (completionDisposableRef.current) {
        completionDisposableRef.current.dispose();
      }
      for (const d of formattingDisposablesRef.current) {
        d.dispose();
      }
      formattingDisposablesRef.current = [];
    };
  }, []);

  function handleMount(editorInstance, monacoInstance) {
    editorRef.current = editorInstance;
    monacoRef.current = monacoInstance;

    if (!completionDisposableRef.current) {
      completionDisposableRef.current = monacoInstance.languages.registerCompletionItemProvider(
        "cpp",
        {
          triggerCharacters: [".", ">", ":"],
          provideCompletionItems: (model, position) =>
            buildCompletionItems(model, position, monacoInstance)
        }
      );
    }

    // Register formatting providers (Shift+Alt+F and Ctrl+K Ctrl+F)
    if (formattingDisposablesRef.current.length === 0) {
      formattingDisposablesRef.current = registerCppFormattingProviders(monacoInstance);
    }

    // Shift+Alt+F — format document
    editorInstance.addCommand(
      monacoInstance.KeyMod.Shift | monacoInstance.KeyMod.Alt | monacoInstance.KeyCode.KeyF,
      () => {
        const action = editorInstance.getAction("editor.action.formatDocument");
        if (action) {
          action.run();
        } else {
          // Fallback: format directly
          const model = editorInstance.getModel();
          if (model) {
            const formatted = formatCppSource(model.getValue());
            const trimmed = formatted.endsWith("\n") ? formatted.slice(0, -1) : formatted;
            if (trimmed !== model.getValue()) {
              model.pushEditOperations(
                [],
                [{ range: model.getFullModelRange(), text: trimmed }],
                () => null
              );
            }
          }
        }
      }
    );

    // Ctrl+S — format then save
    editorInstance.addCommand(
      monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS,
      () => {
        const model = editorInstance.getModel();
        if (model) {
          const formatted = formatCppSource(model.getValue());
          const trimmed = formatted.endsWith("\n") ? formatted.slice(0, -1) : formatted;
          if (trimmed !== model.getValue()) {
            model.pushEditOperations(
              [],
              [{ range: model.getFullModelRange(), text: trimmed }],
              () => null
            );
            onCodeChange(trimmed);
          }
        }
        onSave();
      }
    );
    editorInstance.addCommand(
      monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Enter,
      () => onCompile()
    );
  }

  return (
    <Editor
      height="100%"
      defaultLanguage="cpp"
      language={tab.language}
      value={tab.code}
      path={tab.path}
      onMount={handleMount}
      onChange={(value) => onCodeChange(value ?? "")}
      theme="vs-dark"
      options={{
        minimap: { enabled: true },
        automaticLayout: true,
        fontSize: 14,
        tabSize: 2,
        scrollBeyondLastLine: false,
        formatOnPaste: true,
        formatOnType: false
      }}
    />
  );
});

export default CppEditor;
