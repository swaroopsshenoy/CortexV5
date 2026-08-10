/**
 * C++ formatting provider for Monaco Editor.
 *
 * Handles:
 *  - Indentation based on brace depth
 *  - Spacing around operators
 *  - Spacing after keywords (if, for, while, etc.)
 *  - Spacing after commas and semicolons (in for-loops)
 *  - Trailing whitespace removal
 *  - Blank line normalization
 *  - Preprocessor directives kept at column 0
 */

const INDENT = "  "; // 2-space indent to match editor tabSize

// Keywords that should have a space before '('
const KEYWORDS_BEFORE_PAREN = new Set([
  "if", "else", "for", "while", "switch", "catch", "return", "do", "case"
]);

// Binary operators that should have spaces around them
const BINARY_OPS = /\s*(={1,2}|!=|<=|>=|<<|>>|&&|\|\||[+\-*/%&|^]=)\s*/g;

// ---------------------------------------------------------------------------
// Core formatting logic
// ---------------------------------------------------------------------------

/**
 * Preprocess C++ source to split multiple statements per line onto separate lines,
 * avoiding splitting inside comments, string/char literals, or parentheses (e.g., for loops).
 */
function splitMultiStatementLines(text) {
  let result = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escaped = false;
  let parenDepth = 0;
  let inSingleLineComment = false;
  let inMultiLineComment = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const nextCh = text[i + 1];

    if (escaped) {
      result += ch;
      escaped = false;
      continue;
    }

    if (inSingleLineComment) {
      result += ch;
      if (ch === "\n") {
        inSingleLineComment = false;
      }
      continue;
    }

    if (inMultiLineComment) {
      result += ch;
      if (ch === "*" && nextCh === "/") {
        result += "/";
        inMultiLineComment = false;
        i++;
      }
      continue;
    }

    if (inDoubleQuote) {
      result += ch;
      if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inDoubleQuote = false;
      }
      continue;
    }

    if (inSingleQuote) {
      result += ch;
      if (ch === "\\") {
        escaped = true;
      } else if (ch === "'") {
        inSingleQuote = false;
      }
      continue;
    }

    // Outside comments and strings
    if (ch === "/" && nextCh === "/") {
      inSingleLineComment = true;
      result += "//";
      i++;
      continue;
    }

    if (ch === "/" && nextCh === "*") {
      inMultiLineComment = true;
      result += "/*";
      i++;
      continue;
    }

    if (ch === '"') {
      inDoubleQuote = true;
      result += ch;
      continue;
    }

    if (ch === "'") {
      inSingleQuote = true;
      result += ch;
      continue;
    }

    if (ch === "(") {
      parenDepth++;
      result += ch;
      continue;
    }

    if (ch === ")") {
      parenDepth = Math.max(0, parenDepth - 1);
      result += ch;
      continue;
    }

    if (ch === "{" && parenDepth === 0) {
      result += "{";
      // Check if this is a block with statements by searching for a semicolon before the matching }
      let hasSemicolon = false;
      let braceDepth = 1;
      let lookAheadSingleQuote = false;
      let lookAheadDoubleQuote = false;
      let lookAheadEscaped = false;
      let lookAheadSingleLineComment = false;
      let lookAheadMultiLineComment = false;

      for (let j = i + 1; j < text.length; j++) {
        const lj = text[j];
        const nextLj = text[j + 1];

        if (lookAheadEscaped) {
          lookAheadEscaped = false;
          continue;
        }

        if (lookAheadSingleLineComment) {
          if (lj === "\n") {
            lookAheadSingleLineComment = false;
          }
          continue;
        }

        if (lookAheadMultiLineComment) {
          if (lj === "*" && nextLj === "/") {
            lookAheadMultiLineComment = false;
            j++;
          }
          continue;
        }

        if (lookAheadDoubleQuote) {
          if (lj === "\\") {
            lookAheadEscaped = true;
          } else if (lj === '"') {
            lookAheadDoubleQuote = false;
          }
          continue;
        }

        if (lookAheadSingleQuote) {
          if (lj === "\\") {
            lookAheadEscaped = true;
          } else if (lj === "'") {
            lookAheadSingleQuote = false;
          }
          continue;
        }

        if (lj === "/" && nextLj === "/") {
          lookAheadSingleLineComment = true;
          j++;
          continue;
        }

        if (lj === "/" && nextLj === "*") {
          lookAheadMultiLineComment = true;
          j++;
          continue;
        }

        if (lj === '"') {
          lookAheadDoubleQuote = true;
          continue;
        }

        if (lj === "'") {
          lookAheadSingleQuote = true;
          continue;
        }

        if (lj === "{") {
          braceDepth++;
        }

        if (lj === "}") {
          braceDepth--;
          if (braceDepth === 0) {
            break;
          }
        }

        if (lj === ";") {
          hasSemicolon = true;
        }
      }

      if (hasSemicolon) {
        // Look ahead to see if we should split
        let nextIdx = i + 1;
        while (nextIdx < text.length && (text[nextIdx] === " " || text[nextIdx] === "\t")) {
          nextIdx++;
        }
        if (nextIdx < text.length) {
          const lookAheadCh = text[nextIdx];
          const lookAheadNextCh = text[nextIdx + 1];
          const isComment = (lookAheadCh === "/" && (lookAheadNextCh === "/" || lookAheadNextCh === "*"));
          if (lookAheadCh !== "\r" && lookAheadCh !== "\n" && !isComment) {
            result += "\n";
            i = nextIdx - 1; // Advance past the skipped spaces
          }
        }
      }
      continue;
    }

    if (ch === ";" && parenDepth === 0) {
      result += ";";
      // Look ahead to see if we should split
      let nextIdx = i + 1;
      while (nextIdx < text.length && (text[nextIdx] === " " || text[nextIdx] === "\t")) {
        nextIdx++;
      }
      if (nextIdx < text.length) {
        const lookAheadCh = text[nextIdx];
        const lookAheadNextCh = text[nextIdx + 1];
        const isComment = (lookAheadCh === "/" && (lookAheadNextCh === "/" || lookAheadNextCh === "*"));
        if (lookAheadCh !== "\r" && lookAheadCh !== "\n" && !isComment) {
          result += "\n";
          i = nextIdx - 1; // Advance past the skipped spaces
        }
      }
      continue;
    }

    result += ch;
  }

  return result;
}

/**
 * Format a block of C++ source code text.
 * Returns the formatted string.
 */
export function formatCppSource(text) {
  const preprocessed = splitMultiStatementLines(text);
  const rawLines = preprocessed.split("\n");
  const formattedLines = [];
  let indentLevel = 0;
  let insideMultiLineComment = false;
  let previousLineBlank = false;

  for (let i = 0; i < rawLines.length; i++) {
    let line = rawLines[i];

    // Strip trailing whitespace and carriage returns
    line = line.replace(/\s+$/, "");

    // Track multi-line comments
    if (insideMultiLineComment) {
      // Keep comment lines indented to current level, preserve leading * alignment
      const commentContent = line.replace(/^\s*/, "");
      if (commentContent.startsWith("*")) {
        formattedLines.push(INDENT.repeat(indentLevel) + " " + commentContent);
      } else {
        formattedLines.push(INDENT.repeat(indentLevel) + commentContent);
      }
      if (line.includes("*/")) {
        insideMultiLineComment = false;
      }
      previousLineBlank = false;
      continue;
    }

    if (line.includes("/*") && !line.includes("*/")) {
      insideMultiLineComment = true;
    }

    const trimmed = line.trim();

    // --- Handle blank lines: collapse multiple into one ---
    if (trimmed === "") {
      if (!previousLineBlank) {
        formattedLines.push("");
        previousLineBlank = true;
      }
      continue;
    }
    previousLineBlank = false;

    // --- Preprocessor directives stay at column 0 ---
    if (trimmed.startsWith("#")) {
      formattedLines.push(trimmed);
      continue;
    }

    // --- Adjust indent for closing braces BEFORE indenting this line ---
    // Count leading closing braces/parens that reduce indent for this line
    const leadingClosers = trimmed.match(/^[}\])]*/)?.[0]?.length ?? 0;
    const tempIndent = Math.max(0, indentLevel - leadingClosers);

    // --- Apply spacing rules ---
    let formatted = applySpacingRules(trimmed);

    // --- Indent the line ---
    formatted = INDENT.repeat(tempIndent) + formatted;
    formattedLines.push(formatted);

    // --- Update indent level for subsequent lines ---
    for (const ch of trimmed) {
      if (ch === "{") indentLevel++;
      if (ch === "}") indentLevel = Math.max(0, indentLevel - 1);
    }
  }

  // Remove trailing blank lines
  while (formattedLines.length > 0 && formattedLines[formattedLines.length - 1].trim() === "") {
    formattedLines.pop();
  }

  // Ensure single trailing newline
  return formattedLines.join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// Spacing rules
// ---------------------------------------------------------------------------

function applySpacingRules(line) {
  // Skip lines that are pure comments
  if (line.startsWith("//") || line.startsWith("/*")) {
    return line;
  }

  // Separate code from trailing comment
  let code = line;
  let trailingComment = "";
  const commentIdx = findTrailingCommentIndex(line);
  if (commentIdx !== -1) {
    code = line.substring(0, commentIdx).trimEnd();
    trailingComment = " " + line.substring(commentIdx);
  }

  // Skip string literals — we need to be careful not to modify content inside quotes
  // Simple approach: process only parts outside of string literals
  code = processOutsideStrings(code, (segment) => {
    let s = segment;

    // --- Space after keywords before '(' ---
    for (const kw of KEYWORDS_BEFORE_PAREN) {
      const kwRegex = new RegExp(`\\b${kw}\\(`, "g");
      s = s.replace(kwRegex, `${kw} (`);
    }

    // --- Space around binary and assignment operators ---
    s = s.replace(BINARY_OPS, " $1 ");

    // --- Space after commas ---
    s = s.replace(/,([^\s])/g, ", $1");

    // --- Space after semicolons in for-loops ---
    s = s.replace(/;([^\s)\n])/g, "; $1");

    // --- Space before opening brace ---
    s = s.replace(/([^\s])\{/g, "$1 {");

    // --- Remove spaces before semicolons ---
    s = s.replace(/\s+;/g, ";");

    // --- Remove spaces before commas ---
    s = s.replace(/\s+,/g, ",");

    // --- Normalize multiple spaces to single (outside indentation) ---
    s = s.replace(/([^\s]) {2,}([^\s])/g, "$1 $2");

    // --- Fix double spaces around operators that we may have introduced ---
    s = s.replace(/ {2,}/g, (match, offset) => {
      // Keep leading indentation intact
      if (offset === 0) return match;
      return " ";
    });

    return s;
  });

  return code + trailingComment;
}

/**
 * Find the index of a trailing // comment, accounting for string literals.
 */
function findTrailingCommentIndex(line) {
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escaped = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      escaped = true;
      continue;
    }

    if (ch === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (ch === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && ch === "/" && line[i + 1] === "/") {
      return i;
    }
  }
  return -1;
}

/**
 * Process only the parts of a line that are outside string literals.
 * Preserves string content unchanged.
 */
function processOutsideStrings(line, processor) {
  const parts = [];
  let current = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escaped = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      current += ch;
      escaped = true;
      continue;
    }

    if (ch === "'" && !inDoubleQuote) {
      if (inSingleQuote) {
        // Closing single quote
        current += ch;
        parts.push(current);
        current = "";
        inSingleQuote = false;
      } else {
        // Opening single quote — process what we have so far
        parts.push(processor(current));
        current = ch;
        inSingleQuote = true;
      }
      continue;
    }

    if (ch === '"' && !inSingleQuote) {
      if (inDoubleQuote) {
        // Closing double quote
        current += ch;
        parts.push(current);
        current = "";
        inDoubleQuote = false;
      } else {
        // Opening double quote — process what we have so far
        parts.push(processor(current));
        current = ch;
        inDoubleQuote = true;
      }
      continue;
    }

    current += ch;
  }

  // Process remaining content
  if (inSingleQuote || inDoubleQuote) {
    parts.push(current); // unclosed string, don't modify
  } else {
    parts.push(processor(current));
  }

  return parts.join("");
}

// ---------------------------------------------------------------------------
// Monaco provider registration
// ---------------------------------------------------------------------------

/**
 * Register document formatting and range formatting providers for C++.
 * Returns an array of disposables.
 */
export function registerCppFormattingProviders(monacoInstance) {
  const disposables = [];

  // Full document formatting (Shift+Alt+F)
  disposables.push(
    monacoInstance.languages.registerDocumentFormattingEditProvider("cpp", {
      provideDocumentFormattingEdits(model) {
        const fullText = model.getValue();
        const formatted = formatCppSource(fullText);

        if (formatted === fullText) {
          return [];
        }

        const lineCount = model.getLineCount();
        const lastLineLength = model.getLineMaxColumn(lineCount);

        return [
          {
            range: {
              startLineNumber: 1,
              startColumn: 1,
              endLineNumber: lineCount,
              endColumn: lastLineLength
            },
            text: formatted.endsWith("\n") ? formatted.slice(0, -1) : formatted
          }
        ];
      }
    })
  );

  // Selection formatting (Ctrl+K Ctrl+F)
  disposables.push(
    monacoInstance.languages.registerDocumentRangeFormattingEditProvider("cpp", {
      provideDocumentRangeFormattingEdits(model, range) {
        const selectedText = model.getValueInRange(range);
        const formatted = formatCppSource(selectedText);

        if (formatted === selectedText) {
          return [];
        }

        return [
          {
            range,
            text: formatted.endsWith("\n") ? formatted.slice(0, -1) : formatted
          }
        ];
      }
    })
  );

  return disposables;
}
