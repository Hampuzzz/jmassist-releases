Write-Host "=== Ethernet adapter status ===" -ForegroundColor Cyan
Get-NetAdapter | Where-Object { $_.InterfaceDescription -like "*Realtek*" -or $_.Name -eq "Ethernet" } | Format-Table Name, Status, LinkSpeed, InterfaceDescription -AutoSize

Write-Host ""
Write-Host "=== Ethernet IP config ===" -ForegroundColor Cyan
Get-NetIPAddress | Where-Object { $_.InterfaceAlias -like "*Ethernet*" -and $_.AddressFamily -eq "IPv4" } | Format-Table InterfaceAlias, IPAddress, PrefixLength -AutoSize
