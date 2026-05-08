# Package source for course submission (excludes node_modules, .env, local DB, etc.)
# Run from repo root:  .\scripts\package-source-for-submission.ps1
# Optional: -FolderName "StudentID-Name-Final"  -ZipName "out.zip"

param(
    [string]$FolderName = "MedBrief-final-project",
    [string]$ZipName = ""
)

$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ParentDir = Split-Path -Parent $ProjectRoot

if (-not $ZipName) { $ZipName = "${FolderName}.zip" }
$ZipPath = Join-Path $ParentDir $ZipName
$StageParent = Join-Path $ParentDir "._submit_pack_tmp"
$StageRoot = Join-Path $StageParent $FolderName

Write-Host "Source: $ProjectRoot"
Write-Host "Zip out: $ZipPath"

if (Test-Path $StageParent) {
    Remove-Item -LiteralPath $StageParent -Recurse -Force
}
New-Item -ItemType Directory -Path $StageRoot -Force | Out-Null

$excludeDirs = @(
    "node_modules", "__pycache__", ".pytest_cache", ".venv", "venv",
    ".git", "dist", "build", "coverage", "htmlcov",
    ".cursor", ".idea", "._submit_pack_tmp"
) | ForEach-Object { "/XD", $_ }

$excludeFiles = @(
    ".env", ".env.local", ".env.development", ".env.production",
    ".env.development.local", ".env.production.local"
) | ForEach-Object { "/XF", $_ }

$robocopyArgs = @(
    $ProjectRoot, $StageRoot, "/E", "/NFL", "/NDL", "/NJH", "/NJS", "/nc", "/ns", "/np"
) + $excludeDirs + $excludeFiles

& robocopy @robocopyArgs
$rc = $LASTEXITCODE
if ($rc -ge 8) { throw "robocopy failed, exit code: $rc" }

$sessionsDb = Join-Path $StageRoot "server\data\sessions.db"
Remove-Item -LiteralPath $sessionsDb -Force -ErrorAction SilentlyContinue
$memoryGlob = Join-Path $StageRoot "server\data\memory\*.json"
Get-ChildItem -Path $memoryGlob -ErrorAction SilentlyContinue | Remove-Item -Force

$memDir = Join-Path $StageRoot "server\data\memory"
if (-not (Test-Path $memDir)) {
    New-Item -ItemType Directory -Path $memDir -Force | Out-Null
}
Set-Content -Path (Join-Path $memDir ".gitkeep") -Value "" -Encoding utf8

$readmeLines = @(
    "================================================================================",
    "Course final project - source bundle (auto-generated)",
    "================================================================================",
    "Excluded: node_modules, __pycache__, .pytest_cache, venv, .git, dist, .env,",
    "          server/data/sessions.db, server/data/memory/*.json",
    "",
    "Reviewers should run:  npm install",
    "                       cd server && pip install -r requirements.txt",
    "Setup: copy server/.env.example to server/.env (optional API key)",
    "",
    "Chinese checklist: see docs/课程提交-打包说明.txt in this folder.",
    "Rename this folder to: StudentID-Name-FinalProject",
    "Add PDF report per course rules; zip everything with the required filename.",
    "================================================================================"
)
$noticePath = Join-Path $StageRoot "SUBMIT_README.txt"
Set-Content -LiteralPath $noticePath -Value $readmeLines -Encoding utf8

if (Test-Path $ZipPath) {
    Remove-Item -LiteralPath $ZipPath -Force
}
Compress-Archive -LiteralPath $StageRoot -DestinationPath $ZipPath -CompressionLevel Optimal -Force
Remove-Item -LiteralPath $StageParent -Recurse -Force

Write-Host "OK: $ZipPath"
Write-Host "Rename zip to your StudentID-Name-FinalProject.zip and include PDF if required."
