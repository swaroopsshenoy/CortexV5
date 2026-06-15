param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$repoRootResolved = (Resolve-Path $RepoRoot).Path

$copilotDir = Join-Path $repoRootResolved ".copilot"
$vscodeDir = Join-Path $repoRootResolved ".vscode"
$claudeDir = Join-Path $repoRootResolved ".claude"

New-Item -ItemType Directory -Force -Path $copilotDir | Out-Null
New-Item -ItemType Directory -Force -Path $vscodeDir | Out-Null
New-Item -ItemType Directory -Force -Path $claudeDir | Out-Null

$baseConfig = @{
    mcpServers = @{
        playwright = @{
            command = "npx"
            args    = @("-y", "@microsoft/mcp-server-playwright")
        }
        "cortex-shell" = @{
            command = "python"
            args    = @("$repoRootResolved\mcp\custom-shell-server.py")
        }
        "cortex-cmake" = @{
            command = "python"
            args    = @("$repoRootResolved\mcp\custom-cmake-server.py")
        }
        "cortex-python-ml" = @{
            command = "python"
            args    = @("$repoRootResolved\mcp\python-ml-server.py")
        }
        "cortex-perplexity-search" = @{
            command = "python"
            args    = @("$repoRootResolved\mcp\perplexity-search-server.py")
            env     = @{
                PPLX_API_KEY = "<SET_IN_ENV>"
            }
        }
    }
}

$json = $baseConfig | ConvertTo-Json -Depth 8

Set-Content -Path (Join-Path $copilotDir "mcp.json") -Value $json -Encoding UTF8
Set-Content -Path (Join-Path $vscodeDir "mcp.json") -Value $json -Encoding UTF8
Set-Content -Path (Join-Path $claudeDir "mcp.json") -Value $json -Encoding UTF8

Write-Output "Generated:"
Write-Output (Join-Path $copilotDir "mcp.json")
Write-Output (Join-Path $vscodeDir "mcp.json")
Write-Output (Join-Path $claudeDir "mcp.json")
