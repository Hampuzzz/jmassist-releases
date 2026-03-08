$path = "G:\Temp\ubuntu-24.04.2-live-server-amd64.iso"
if (Test-Path $path) {
    $f = Get-Item $path
    $sizeMB = [math]::Round($f.Length / 1MB)
    Write-Host "ISO download: $sizeMB MB so far"
} else {
    Write-Host "ISO file not found yet"
}
