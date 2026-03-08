$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$outputDir = Join-Path $projectRoot "dist-installer"
$zipName = "JMAssist-Setup.zip"
$outputZip = Join-Path $outputDir $zipName
$tempDir = Join-Path $env:TEMP "JMAssist-installer-build"

Write-Host "Building JM Assist installer..." -ForegroundColor Cyan

if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }
if (Test-Path $outputDir) { Remove-Item $outputDir -Recurse -Force }
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null

$appDir = Join-Path $tempDir "JMAssist"
New-Item -ItemType Directory -Path $appDir -Force | Out-Null

$includes = @(
    "src",
    "electron",
    "scripts",
    "supabase",
    "public",
    "services",
    "package.json",
    "package-lock.json",
    "next.config.mjs",
    "next-env.d.ts",
    "tsconfig.json",
    "tailwind.config.ts",
    "postcss.config.js",
    "drizzle.config.ts",
    "components.json",
    "electron-builder.yml",
    "CLOUDFLARE_TUNNEL.md",
    "JMAssist.bat",
    "JMAssist.vbs",
    "Installera-JMAssist.bat",
    ".env.local"
)

foreach ($item in $includes) {
    $source = Join-Path $projectRoot $item
    $dest = Join-Path $appDir $item
    if (Test-Path $source) {
        if ((Get-Item $source).PSIsContainer) {
            Copy-Item $source $dest -Recurse -Force
        } else {
            $destDir = Split-Path $dest -Parent
            if (!(Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
            Copy-Item $source $dest -Force
        }
        Write-Host "  + $item" -ForegroundColor Green
    }
}

$setupBat = @"
@echo off
chcp 65001 >nul 2>&1
title JM Assist - Setup
color 0A
echo.
echo  JM Assist - Setup
echo  Verkstads-ERP av JM Trading
echo.
set "DEFAULT_DIR=C:\JMAssist"
set /p "INSTALL_DIR=  Installationsmapp [%DEFAULT_DIR%]: "
if "%INSTALL_DIR%"=="" set "INSTALL_DIR=%DEFAULT_DIR%"
echo.
echo  Installerar till: %INSTALL_DIR%
echo.
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
echo  Kopierar filer...
xcopy /E /Y /Q "%~dp0JMAssist\*" "%INSTALL_DIR%\" >nul
echo  [OK] Filer kopierade.
echo.
cd /d "%INSTALL_DIR%"
call "%INSTALL_DIR%\Installera-JMAssist.bat"
"@

Set-Content -Path (Join-Path $tempDir "Setup-JMAssist.bat") -Value $setupBat -Encoding ASCII

if (Test-Path $outputZip) { Remove-Item $outputZip -Force }

Write-Host "Compressing..." -ForegroundColor Yellow
Compress-Archive -Path (Join-Path $tempDir "*") -DestinationPath $outputZip -CompressionLevel Optimal

Remove-Item $tempDir -Recurse -Force

$sizeMB = [math]::Round((Get-Item $outputZip).Length / 1MB, 1)
Write-Host "Done! $outputZip ($sizeMB MB)" -ForegroundColor Green
