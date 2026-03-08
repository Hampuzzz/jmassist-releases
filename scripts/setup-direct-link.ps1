# Set static IP on Ethernet adapter for direct link to Magicnuc
$adapter = Get-NetAdapter | Where-Object { $_.InterfaceDescription -like "*Realtek*" }
Write-Host "Adapter: $($adapter.Name)" -ForegroundColor Cyan

# Remove existing IP config
Remove-NetIPAddress -InterfaceIndex $adapter.ifIndex -Confirm:$false -ErrorAction SilentlyContinue

# Use 10.10.10.x subnet (avoids conflict with vEthernet on 192.168.137.x)
New-NetIPAddress -InterfaceIndex $adapter.ifIndex -IPAddress "10.10.10.1" -PrefixLength 24 -ErrorAction SilentlyContinue
Write-Host "Set IP to 10.10.10.1/24" -ForegroundColor Green

Start-Sleep -Seconds 2

Write-Host "Pinging Magicnuc at 10.10.10.2..." -ForegroundColor Cyan
ping 10.10.10.2 -n 3
