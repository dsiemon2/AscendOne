$cargoPath = "C:\Users\bsiem\.cargo\bin"
$nodePath = "C:\Program Files\nodejs"
$npmPath = "C:\Users\bsiem\AppData\Roaming\npm"

$env:PATH = "$cargoPath;$nodePath;$npmPath;" + $env:PATH

Write-Host "PATH set. Cargo location: $(Get-Command cargo -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source)"
Write-Host "Node location: $(Get-Command node -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source)"

Set-Location "H:\Claude\LOA\app"
npm run tauri dev
