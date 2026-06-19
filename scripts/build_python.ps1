#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Freeze Python drivers into standalone executables using PyInstaller.
    Run this BEFORE `npm run dist`.

.PREREQUISITES
    pip install pyinstaller
    (or: pip install -r requirements-build.txt)

.USAGE
    pwsh scripts/build_python.ps1
#>

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$PyDir = Join-Path $Root "src\electron\main\py"
$OutDir = Join-Path $Root "dist\python"

Write-Host "[build_python] Freezing Python drivers -> $OutDir" -ForegroundColor Cyan

# Ensure output directory exists
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$PyInstallerPath = "$env:APPDATA\Python\Python311\Scripts\pyinstaller.exe"

# Check PyInstaller is available
try {
    & $PyInstallerPath --version | Out-Null
} catch {
    Write-Error "PyInstaller not found at $PyInstallerPath"
    exit 1
}

function Freeze-Driver {
    param([string]$DriverFile, [string]$DistPath)
    $DriverName = [System.IO.Path]::GetFileNameWithoutExtension($DriverFile)
    $DriverPath = Join-Path $PyDir $DriverFile
    Write-Host "[build_python] Freezing $DriverFile ..." -ForegroundColor Yellow

    & $PyInstallerPath `
        --onefile `
        --distpath $DistPath `
        --workpath (Join-Path $Root "build\pyinstaller\$DriverName") `
        --specpath (Join-Path $Root "build\pyinstaller\$DriverName") `
        --name $DriverName `
        --noconfirm `
        $DriverPath

    if ($LASTEXITCODE -ne 0) {
        Write-Error "PyInstaller failed for $DriverFile (exit code $LASTEXITCODE)"
        exit $LASTEXITCODE
    }
    Write-Host "[build_python] OK: $DistPath\$DriverName.exe" -ForegroundColor Green
}

Freeze-Driver "performance_risk_driver.py" $OutDir
Freeze-Driver "nlp_refine_driver.py" $OutDir

Write-Host ""
Write-Host "[build_python] Done. Frozen executables:" -ForegroundColor Cyan
Get-ChildItem $OutDir -Filter "*.exe" | ForEach-Object {
    $size = [math]::Round($_.Length / 1MB, 1)
    Write-Host "  $($_.Name)  ($size MB)" -ForegroundColor White
}
Write-Host ""
Write-Host "Next: npm run dist" -ForegroundColor Cyan
