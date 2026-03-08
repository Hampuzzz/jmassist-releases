# Force static IP on Ethernet adapter
$adapter = Get-NetAdapter -Name "Ethernet"
$ifIndex = $adapter.ifIndex

Write-Host "Interface index: $ifIndex" -ForegroundColor Cyan

# Disable DHCP and set static IP
Set-NetIPInterface -InterfaceIndex $ifIndex -Dhcp Disabled -ErrorAction SilentlyContinue

# Remove ALL existing IPs on this adapter
Get-NetIPAddress -InterfaceIndex $ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue | Remove-NetIPAddress -Confirm:$false -ErrorAction SilentlyContinue

Start-Sleep -Seconds 1

# Set new static IP
New-NetIPAddress -InterfaceIndex $ifIndex -IPAddress "10.10.10.1" -PrefixLength 24
Write-Host "IP set to 10.10.10.1/24" -ForegroundColor Green

Start-Sleep -Seconds 2

# Verify
Write-Host ""
Write-Host "=== Verify ===" -ForegroundColor Cyan
Get-NetIPAddress -InterfaceIndex $ifIndex -AddressFamily IPv4 | Format-Table IPAddress, PrefixLength -AutoSize

Write-Host ""
ping 10.10.10.2 -n 3
