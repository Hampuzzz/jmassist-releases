$ip = "192.168.68.66"
Write-Host "Checking ports on $ip..." -ForegroundColor Cyan
$ports = @(22, 80, 443, 8080, 8100, 3000, 9090)
foreach ($port in $ports) {
    $tcp = New-Object System.Net.Sockets.TcpClient
    try {
        $connect = $tcp.BeginConnect($ip, $port, $null, $null)
        $wait = $connect.AsyncWaitHandle.WaitOne(2000, $false)
        if ($wait -and $tcp.Connected) {
            Write-Host "  Port $port - OPEN" -ForegroundColor Green
        } else {
            Write-Host "  Port $port - closed" -ForegroundColor Gray
        }
    } catch {
        Write-Host "  Port $port - error" -ForegroundColor Red
    } finally {
        $tcp.Close()
    }
}
