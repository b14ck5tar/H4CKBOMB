# Saves one API key into .env.local without ever showing it on screen.
# Usage: powershell -ExecutionPolicy Bypass -File scripts/set-key.ps1 ELEVENLABS_API_KEY
param([Parameter(Mandatory = $true)][string]$Name)

$envFile = Join-Path (Split-Path $PSScriptRoot -Parent) ".env.local"
$secure = Read-Host "Paste $Name (hidden), then press Enter" -AsSecureString
$value = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)).Trim()
if (-not $value) { Write-Host "Nothing pasted. No change."; exit 1 }

$lines = @()
if (Test-Path $envFile) { $lines = @(Get-Content $envFile | Where-Object { $_ -notmatch "^$Name=" }) }
$lines += "$Name=$value"
[IO.File]::WriteAllLines($envFile, $lines, (New-Object Text.UTF8Encoding $false))
$value = $null
Write-Host "Saved $Name to .env.local ($($lines.Count) lines). Tell Claude 'saved'."
