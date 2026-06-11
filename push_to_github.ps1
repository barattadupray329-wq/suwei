# ============================================================
# Push project to GitHub (PowerShell 5.1 safe)
# ============================================================
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

# Ensure git is available in current session
if (Test-Path "C:\Program Files\Git\cmd\git.exe") {
    $env:Path += ";C:\Program Files\Git\cmd"
}

Write-Host "Step 1/5: Check Git..."
git --version
if ($LASTEXITCODE -ne 0) {
    throw "Git is not available."
}

Write-Host ""
Write-Host "Step 2/5: Configure Git identity..."
$name = git config --get user.name
$email = git config --get user.email

if (-not $name) {
    $name = Read-Host "Enter git user.name"
    git config --global user.name "$name"
}
if (-not $email) {
    $email = Read-Host "Enter git user.email"
    git config --global user.email "$email"
}
Write-Host "Using identity: $name <$email>"

Write-Host ""
Write-Host "Step 3/5: Init/Add/Commit..."
if (-not (Test-Path ".git")) {
    git init
}
git add .
git commit -m "feat: Rental Management System V2 setup

- dark theme UI
- AI assistant module
- dashboard and rental workflows
- CSV import/export

Co-Authored-By: Oz <oz-agent@warp.dev>"
if ($LASTEXITCODE -ne 0) {
    Write-Host "No new commit created (possibly no changes), continue..."
}

Write-Host ""
Write-Host "Step 4/5: Set remote..."
$repoUrl = Read-Host "Enter GitHub repository HTTPS URL (e.g. https://github.com/<user>/<repo>.git)"
if (-not $repoUrl) {
    throw "Repository URL is required."
}
$existingRemote = git remote get-url origin 2>$null
if ($existingRemote) {
    git remote set-url origin "$repoUrl"
} else {
    git remote add origin "$repoUrl"
}

Write-Host ""
Write-Host "Step 5/5: Push..."
git branch -M main
git push -u origin main
if ($LASTEXITCODE -ne 0) {
    throw "Push failed. Please complete GitHub auth prompt then retry."
}

Write-Host ""
Write-Host "SUCCESS: Project pushed to $repoUrl"
