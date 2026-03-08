Write-Host "`n=== DISKS ===" -ForegroundColor Cyan
Get-Disk | Format-Table Number, FriendlyName, BusType, @{N='SizeGB';E={[math]::Round($_.Size/1GB,1)}} -AutoSize

Write-Host "`n=== VOLUMES ===" -ForegroundColor Cyan
Get-Volume | Where-Object { $_.DriveLetter } | Format-Table DriveLetter, FileSystemLabel, DriveType, @{N='SizeGB';E={[math]::Round($_.Size/1GB,1)}}, @{N='FreeGB';E={[math]::Round($_.SizeRemaining/1GB,1)}} -AutoSize

Write-Host "`n=== USB DRIVES ===" -ForegroundColor Cyan
Get-Disk | Where-Object { $_.BusType -eq 'USB' } | Format-Table Number, FriendlyName, @{N='SizeGB';E={[math]::Round($_.Size/1GB,1)}} -AutoSize
