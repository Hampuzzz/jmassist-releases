Write-Host "Scanning network for JMServer (Magicnuc)..." -ForegroundColor Cyan
Write-Host ""

# First try the planned static IP
$targetIP = "192.168.68.65"
$result = Test-NetConnection -ComputerName $targetIP -Port 22 -WarningAction SilentlyContinue -InformationLevel Quiet
if ($result) {
    Write-Host "FOUND at $targetIP (port 22 open - SSH ready!)" -ForegroundColor Green
    exit 0
}

# Scan the subnet for SSH (port 22)
Write-Host "Not at $targetIP, scanning 192.168.68.1-254 for SSH..." -ForegroundColor Yellow
$found = @()
1..254 | ForEach-Object {
    $ip = "192.168.68.$_"
    $tcp = New-Object System.Net.Sockets.TcpClient
    try {
        $connect = $tcp.BeginConnect($ip, 22, $null, $null)
        $wait = $connect.AsyncWaitHandle.WaitOne(200, $false)
        if ($wait -and $tcp.Connected) {
            $found += $ip
            Write-Host "  SSH open: $ip" -ForegroundColor Green
        }
    } catch {} finally {
        $tcp.Close()
    }
}

if ($found.Count -eq 0) {
    Write-Host ""
    Write-Host "No SSH servers found on 192.168.68.x" -ForegroundColor Red
    Write-Host "Make sure Magicnuc is powered on and connected to the router" -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "Found $($found.Count) SSH server(s): $($found -join ', ')" -ForegroundColor Green
}
