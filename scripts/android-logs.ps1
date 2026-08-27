$adbPath = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'

if (-not (Test-Path -LiteralPath $adbPath)) {
  throw "ADB nao encontrado em: $adbPath"
}

$device = & $adbPath devices | Select-String 'emulator-5554\s+device'
if (-not $device) {
  throw 'O emulador emulator-5554 nao esta conectado.'
}

Write-Host 'Monitor HTTP Metal Calhas iniciado. Pressione Ctrl+C para encerrar.' -ForegroundColor Cyan
Write-Host 'Faca uma acao no aplicativo para visualizar request e response.' -ForegroundColor DarkGray

& $adbPath -s emulator-5554 logcat -v time 'chromium:I' 'Capacitor/Console:I' '*:S' |
  Select-String -Pattern '\[MetalCalhas HTTP\]'
