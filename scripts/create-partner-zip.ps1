# Create a zip of JM Assist for sharing with partner
# Run: powershell -ExecutionPolicy Bypass -File scripts/create-partner-zip.ps1

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$zipName = "JMAssist-$(Get-Date -Format 'yyyy-MM-dd').zip"
$outputPath = Join-Path $projectRoot $zipName
$tempDir = Join-Path $env:TEMP "JMAssist-export"

Write-Host "Creating JM Assist package..." -ForegroundColor Cyan

# Clean temp
if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

# Files/folders to include
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
    ".env.local"
)

foreach ($item in $includes) {
    $source = Join-Path $projectRoot $item
    $dest = Join-Path $tempDir $item

    if (Test-Path $source) {
        if ((Get-Item $source).PSIsContainer) {
            Copy-Item $source $dest -Recurse -Force
            Write-Host "  + $item/" -ForegroundColor Green
        } else {
            $destDir = Split-Path $dest -Parent
            if (!(Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
            Copy-Item $source $dest -Force
            Write-Host "  + $item" -ForegroundColor Green
        }
    } else {
        Write-Host "  - $item (not found, skipping)" -ForegroundColor Yellow
    }
}

# Create README for partner
$readme = @"
# JM Assist - Verkstads-ERP

## Snabbstart

### 1. Installera beroenden
``````
npm install
``````

### 2. Starta appen (Electron)
``````
JMAssist.bat
``````
Eller manuellt:
``````
npm run dev
# I annat terminal:
cd electron && npx electron .
``````

### 3. Logga in
- Email: admin@jmassist.se
- Losenord: JMAssist2026!

## Databas
Appen ar kopplad till en molndatabas (Supabase).
Alla andringar synkas automatiskt.

## Miljövariabler
Redigera .env.local for att andra:
- Verkstadsinfo (adress, bankgiro, etc.)
- API-nycklar

## Krav
- Node.js 18+
- Windows 10/11
"@

Set-Content -Path (Join-Path $tempDir "README-PARTNER.md") -Value $readme -Encoding UTF8

# Remove old zip if exists
if (Test-Path $outputPath) { Remove-Item $outputPath -Force }

# Create zip
Write-Host "`nCompressing..." -ForegroundColor Cyan
Compress-Archive -Path "$tempDir\*" -DestinationPath $outputPath -CompressionLevel Optimal

# Cleanup temp
Remove-Item $tempDir -Recurse -Force

$sizeMB = [math]::Round((Get-Item $outputPath).Length / 1MB, 1)
Write-Host "`nDone! Created: $zipName ($sizeMB MB)" -ForegroundColor Green
Write-Host "Location: $outputPath" -ForegroundColor Cyan
