# MCP Servers for Cortex++V5

This folder tracks the MCP servers planned for this project and how to wire them.

## Implemented in this repository

- `custom-shell-server.py` (allowlisted command execution)
- `custom-cmake-server.py` (configure/build/test helpers)
- `python-ml-server.py` (Random Forest train/predict + diagnostic explanation)
- `perplexity-search-server.py` (Perplexity-backed research tool)
- `generate-local-config.ps1` (creates host config files with absolute paths)

## Recommended Servers

| MCP Server | Purpose & Value for This Project | How to Add / Use |
| --- | --- | --- |
| GitHub MCP Server (built-in) | File ops, repo context, Git integration, issue/PR handling for multi-file C++ work. | Built into Copilot environments that support GitHub MCP. Use `@github` style workflows where available. |
| Playwright MCP | Browser automation/testing for Electron UI, Monaco interactions, and visual checks. | `npx -y @microsoft/mcp-server-playwright` |
| Terminal / Shell MCP (community or custom) | Safe command execution for compiler spawning, build pipelines, profiling runs. | Use a trusted community shell MCP or implement a thin custom wrapper with explicit allowlists. |
| Perplexity / Search MCP | Real-time research for C++ best practices, Clang AST docs, and optimization patterns. | Add your chosen search MCP server and key/token via local env vars. |
| CMake / Build Tools MCP (community or custom) | CMake-aware build directory management, presets, compiler flags, and build diagnostics. | Adopt a community CMake MCP or create a project-specific CMake MCP wrapper. |
| Python / Scikit-learn MCP (custom) | ML prediction and NLP context for the Python backend (feature extraction + model serving). | Implement a custom MCP server that proxies backend Python scripts/services. |

## Suggested Startup Order

1. GitHub MCP (baseline workspace operations)
2. Playwright MCP (UI automation)
3. Shell + CMake MCP (build/test pipeline)
4. Python/Scikit-learn MCP (ML/NLP integration)
5. Search MCP (architecture and optimization research support)

## Quick setup

1. Install Python dependencies:
   - `pip install -r mcp\requirements.txt`
2. Generate host configs with local absolute paths:
   - `powershell -ExecutionPolicy Bypass -File mcp\generate-local-config.ps1`
3. Set Perplexity key (if using search server):
   - PowerShell (current session): `$env:PPLX_API_KEY="your_key_here"`
4. Use generated files:
   - `.copilot\mcp.json`
   - `.vscode\mcp.json`
   - `.claude\mcp.json`
