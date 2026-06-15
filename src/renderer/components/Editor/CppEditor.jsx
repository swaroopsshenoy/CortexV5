import { useEffect, useMemo, useRef } from "react";
import Editor from "@monaco-editor/react";

const COMPLETION_ITEMS = [
  {
    label: "std::vector",
    insertText: "std::vector<${1:int}> ${2:name};",
    documentation: "STL dynamic array",
    kind: "Class"
  },
  {
    label: "fori",
    insertText: "for (int ${1:i} = 0; ${1:i} < ${2:n}; ++${1:i}) {\n\t$0\n}",
    documentation: "Index-based loop",
    kind: "Snippet"
  },
  {
    label: "cout",
    insertText: "std::cout << ${1:value} << std::endl;",
    documentation: "Standard output",
    kind: "Function"
  }
];

export default function CppEditor({
  tab,
  diagnostics,
  focusDiagnostic,
  onCodeChange,
  onSave,
  onCompile
}) {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const completionDisposableRef = useRef(null);

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
    };
  }, []);

  function handleMount(editorInstance, monacoInstance) {
    editorRef.current = editorInstance;
    monacoRef.current = monacoInstance;

    if (!completionDisposableRef.current) {
      completionDisposableRef.current = monacoInstance.languages.registerCompletionItemProvider(
        "cpp",
        {
          provideCompletionItems: () => ({
            suggestions: COMPLETION_ITEMS.map((item) => ({
              label: item.label,
              insertText: item.insertText,
              insertTextRules:
                monacoInstance.languages.CompletionItemInsertTextRule
                  .InsertAsSnippet,
              kind:
                monacoInstance.languages.CompletionItemKind[item.kind] ??
                monacoInstance.languages.CompletionItemKind.Text,
              documentation: item.documentation
            }))
          })
        }
      );
    }

    editorInstance.addCommand(
      monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS,
      () => onSave()
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
        scrollBeyondLastLine: false
      }}
    />
  );
}
