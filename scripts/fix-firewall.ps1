# Allow ping (ICMP) through Windows Firewall
Write-Host "Enabling ICMP ping through firewall..." -ForegroundColor Cyan
New-NetFirewallRule -DisplayName "Allow ICMPv4-In" -Protocol ICMPv4 -IcmpType 8 -Direction Inbound -Action Allow -ErrorAction SilentlyContinue
Write-Host "Done!" -ForegroundColor Green

# Also check the Ethernet adapter
Write-Host ""
Write-Host "=== Ethernet adapter ===" -ForegroundColor Cyan
Get-NetAdapter -Name "Ethernet" | Format-Table Name, Status, LinkSpeed -AutoSize

Write-Host ""
Write-Host "=== Ethernet IP ===" -ForegroundColor Cyan
Get-NetIPAddress -InterfaceAlias "Ethernet" -AddressFamily IPv4 | Format-Table IPAddress, PrefixLength -AutoSize

Write-Host ""
Write-Host "Pinging Magicnuc..." -ForegroundColor Cyan
ping 10.10.10.2 -n 3
