# Generate Tauri signing keys for updater
# Run: powershell -File scripts/generate-keys.ps1
# Save the private key in GitHub Secrets as TAURI_SIGNING_PRIVATE_KEY and TAURI_SIGNING_PRIVATE_KEY_PASSWORD
# Save the public key in tauri.conf.json > plugins.updater.pubkey

Write-Host "Generating Tauri signing keys..." -ForegroundColor Yellow

# Check if cargo-tauri is available
$tauriCli = Get-Command "cargo" -ErrorAction SilentlyContinue
if (-not $tauriCli) {
    Write-Host "Rust/Cargo not found. Install from https://rustup.rs" -ForegroundColor Red
    exit 1
}

# Tauri v2 uses tauri signer generate
# If `tauri` CLI is installed globally or via cargo
$hasTauriCli = $null
try {
    $hasTauriCli = cargo tauri --version 2>&1 | Out-String
} catch {}

if ($hasTauriCli -match "tauri-cli") {
    cargo tauri signer generate -w tauri-updater-keys.json
    Write-Host "Keys generated in tauri-updater-keys.json" -ForegroundColor Green
    Write-Host ""
    Write-Host "IMPORTANT:" -ForegroundColor Red
    Write-Host "1. Add TAURI_SIGNING_PRIVATE_KEY and TAURI_SIGNING_PRIVATE_KEY_PASSWORD to GitHub Secrets"
    Write-Host "2. Update pubkey in client/src-tauri/tauri.conf.json > plugins.updater.pubkey"
    Write-Host "3. Keep tauri-updater-keys.json SECURE - never commit it to git"
} else {
    Write-Host "Tauri CLI not found. Install with: cargo install tauri-cli --version '^2'" -ForegroundColor Red
}
