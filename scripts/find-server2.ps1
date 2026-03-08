# Check ARP table for new devices
Write-Host "=== ARP Table (known devices) ===" -ForegroundColor Cyan
arp -a | Select-String "192.168"

Write-Host ""
Write-Host "=== This PC's network config ===" -ForegroundColor Cyan
ipconfig | Select-String "IPv4|Subnet|Gateway"
