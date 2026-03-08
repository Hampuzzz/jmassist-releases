Write-Host "Testing SSH on all active IPs..." -ForegroundColor Cyan
$ips = @(50, 52, 55, 56, 58, 59, 60, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75)
foreach ($last in $ips) {
    $ip = "192.168.68.$last"
    $tcp = New-Object System.Net.Sockets.TcpClient
    try {
        $connect = $tcp.BeginConnect($ip, 22, $null, $null)
        $wait = $connect.AsyncWaitHandle.WaitOne(500, $false)
        if ($wait -and $tcp.Connected) {
            Write-Host "  SSH OPEN: $ip" -ForegroundColor Green
        }
    } catch {} finally {
        $tcp.Close()
    }
}
Write-Host ""
Write-Host "Done." -ForegroundColor Cyan
