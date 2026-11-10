# Installs autoprint as a hidden background task that starts at logon.
# Settings are read from config.json (created on first install, see config.example.json).
# Usage:      powershell -ExecutionPolicy Bypass -File install-windows.ps1
# Uninstall:  powershell -ExecutionPolicy Bypass -File install-windows.ps1 -Uninstall
param([switch]$Uninstall)
$ErrorActionPreference = 'Stop'

$TaskName = 'snake-label-autoprint'
$Dir = $PSScriptRoot
$Script = Join-Path $Dir 'autoprint.js'
$DataDir = Join-Path $env:LOCALAPPDATA 'snake-label-autoprint'
$Launcher = Join-Path $DataDir 'run.vbs'
$Log = Join-Path $DataDir 'autoprint.log'
$Shortcut = Join-Path ([Environment]::GetFolderPath('Startup')) "$TaskName.lnk"

function Stop-Autoprint {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Remove-Item $Shortcut -ErrorAction SilentlyContinue
    Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
        Where-Object { $_.CommandLine -like "*$Script*" } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
}

Stop-Autoprint
if ($Uninstall) {
    Remove-Item $Launcher -ErrorAction SilentlyContinue
    Write-Host 'Uninstalled.'
    exit 0
}

$Node = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
if (-not $Node) {
    Write-Error 'Node.js not found. Install Node.js 20 or newer first: https://nodejs.org'
}
if ([int](& $Node -p 'process.versions.node.split(".")[0]') -lt 20) {
    Write-Error "Node.js $(& $Node --version) is too old, version 20 or newer is required."
}

Write-Host 'Installing dependencies...'
Push-Location $Dir
try { npm install --omit=dev --no-fund --no-audit } finally { Pop-Location }
if ($LASTEXITCODE -ne 0) { Write-Error 'npm install failed.' }

$ConfigFile = Join-Path $Dir 'config.json'
if (-not (Test-Path $ConfigFile)) {
    $PrinterUrl = Read-Host 'brother_ql_web URL [http://localhost:8013]'
    if (-not $PrinterUrl) { $PrinterUrl = 'http://localhost:8013' }
    $WatchDir = Read-Host 'Folder to watch [~/Downloads]'
    if (-not $WatchDir) { $WatchDir = '~/Downloads' }
    $Config = [ordered]@{
        printerUrl = $PrinterUrl
        watchDir   = $WatchDir
        printedDir = (Join-Path $WatchDir 'printed')
    }
    # WriteAllText writes UTF-8 without BOM
    [IO.File]::WriteAllText($ConfigFile, ($Config | ConvertTo-Json) + "`n")
    Write-Host "Wrote $ConfigFile"
}

# node.exe would open a console window; the VBScript starts it hidden and waits,
# so the task sees node's exit code and can restart it.
New-Item -ItemType Directory -Force $DataDir | Out-Null
$Command = 'cmd.exe /c ""{0}" "{1}" >> "{2}" 2>&1"' -f $Node, $Script, $Log
$Vbs = @"
Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = "$Dir"
WScript.Quit shell.Run("$($Command.Replace('"', '""'))", 0, True)
"@
[IO.File]::WriteAllText($Launcher, $Vbs)

try {
    $Action = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument "`"$Launcher`"" -WorkingDirectory $Dir
    $Trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
    $Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
        -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)
    $Principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
    Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Principal $Principal | Out-Null
    Start-ScheduledTask -TaskName $TaskName
    Write-Host "Installed as scheduled task '$TaskName'."
} catch {
    # Fallback when task creation is not permitted: autostart shortcut (no automatic restart)
    $Link = (New-Object -ComObject WScript.Shell).CreateShortcut($Shortcut)
    $Link.TargetPath = 'wscript.exe'
    $Link.Arguments = "`"$Launcher`""
    $Link.WorkingDirectory = $Dir
    $Link.Save()
    Start-Process wscript.exe -ArgumentList "`"$Launcher`""
    Write-Host "Scheduled task not permitted ($($_.Exception.Message)), installed autostart shortcut instead."
}
Write-Host "Log: $Log"
Write-Host 'Windows may ask to allow node.exe through the firewall; private networks are enough.'
