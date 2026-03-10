$env:PATH = "C:\Users\bsiem\.cargo\bin;C:\Program Files\nodejs;C:\Windows\system32;C:\Windows;C:\Windows\System32\Wbem;C:\Windows\System32\WindowsPowerShell\v1.0\;C:\Users\bsiem\AppData\Roaming\npm"
Set-Location "H:\Claude\LOA\app"
npm run tauri dev 2>&1 | Tee-Object -FilePath "H:\Claude\LOA\dev.log"
