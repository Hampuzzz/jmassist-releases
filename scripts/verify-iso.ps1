Write-Host "Verifying Ubuntu Server ISO checksum..." -ForegroundColor Cyan
Write-Host ""

$isoPath = "G:\Temp\ubuntu-24.04.2-live-server-amd64.iso"

if (-not (Test-Path $isoPath)) {
    Write-Host "ERROR: ISO not found at $isoPath" -ForegroundColor Red
    exit 1
}

$fileSize = [math]::Round((Get-Item $isoPath).Length / 1MB)
Write-Host "File size: $fileSize MB"
Write-Host "Calculating SHA256 (this takes a minute)..."

$hash = (Get-FileHash $isoPath -Algorithm SHA256).Hash
Write-Host ""
Write-Host "SHA256: $hash" -ForegroundColor Yellow
Write-Host ""

# Official Ubuntu 24.04.2 server SHA256
$officialHash = "D2D0DE69AFB0EC51647782862A9B2C0B28D16C24A41BB8F291F6D2A8E21E5942"

if ($hash -eq $officialHash) {
    Write-Host "MATCH - ISO is valid!" -ForegroundColor Green
} else {
    Write-Host "NO MATCH - ISO may be corrupt!" -ForegroundColor Red
    Write-Host "Expected: $officialHash"
    Write-Host "Got:      $hash"
}
