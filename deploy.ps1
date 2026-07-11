param([switch]$Full)

# -Full: also runs pnpm install (use when package.json changes)

$ErrorActionPreference = "Stop"
$plink = "C:\Program Files\PuTTY\plink.exe"
$conn = @("-batch", "-pw", "Omega1314", "-hostkey", "f5:db:e8:20:b7:b2:dc:91:6a:c2:ab:b3:cc:40:0a:e0", "spoon@192.168.1.50")
$serverDir = "/home/spoon/family-feudal"

Set-Location $PSScriptRoot

$status = git status --porcelain
if ($status) { Write-Error "Uncommitted changes: $status"; exit 1 }

Write-Host "Pushing to GitHub..."
# git writes its status (e.g. "Everything up-to-date") to stderr; under ErrorActionPreference=Stop
# PowerShell 5.1 turns that into a terminating NativeCommandError. Relax the preference just for
# the push so stderr only prints, then gate on the real exit code.
$ErrorActionPreference = "Continue"
git push 2>&1 | ForEach-Object { Write-Host $_ }
$pushExit = $LASTEXITCODE
$ErrorActionPreference = "Stop"
if ($pushExit -ne 0) { Write-Error "git push failed"; exit 1 }

Write-Host "Pulling on server..."
& $plink @conn "cd $serverDir && git pull"

if ($Full) {
    Write-Host "Installing dependencies on server..."
    & $plink @conn "cd $serverDir && pnpm install --frozen-lockfile"
}

Write-Host "Building on server..."
& $plink @conn "cd $serverDir && pnpm --filter @family-feudal/shared build && pnpm --filter @family-feudal/server build && pnpm --filter @family-feudal/client build"

Write-Host "Restarting service..."
& $plink @conn "systemctl --user restart family-feudal"

Write-Host "Waiting for startup..."
Start-Sleep 5

Write-Host "=== family-feudal status ==="
& $plink @conn "systemctl --user status family-feudal --no-pager -l && journalctl --user -u family-feudal -n 20 --no-pager"
