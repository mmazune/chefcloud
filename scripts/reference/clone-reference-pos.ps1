# Clone or update reference POS repositories (PowerShell)
# Usage: .\scripts\reference\clone-reference-pos.ps1

$ErrorActionPreference = "Stop"

# Colors for output
function Write-Success { param($msg) Write-Host $msg -ForegroundColor Green }
function Write-Warning { param($msg) Write-Host $msg -ForegroundColor Yellow }
function Write-Error { param($msg) Write-Host $msg -ForegroundColor Red }

# Resolve repo root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path (Join-Path $ScriptDir "..\..")
$ReferenceDir = Join-Path $RepoRoot "reference-pos"

Write-Success "=== Nimbus POS - Reference Repos Sync ==="
Write-Host "Repo root: $RepoRoot"
Write-Host "Reference dir: $ReferenceDir"
Write-Host ""

# Create reference-pos if missing
if (-not (Test-Path $ReferenceDir)) {
    Write-Warning "Creating reference-pos directory..."
    New-Item -ItemType Directory -Path $ReferenceDir | Out-Null
}

Set-Location $ReferenceDir

# Repos to clone/update
$repos = @{
    "opensourcepos" = "https://github.com/opensourcepos/opensourcepos.git"
    "nexopos" = "https://github.com/Blair2004/NexoPOS.git"
    "pos-awesome" = "https://github.com/ucraft-com/POS-Awesome.git"
    "medusa-pos-starter" = "https://github.com/Agilo/medusa-pos-starter.git"
    "medusa-pos-react" = "https://github.com/pavlotsyhanok/medusa-pos-react.git"
    "store-pos" = "https://github.com/tngoman/Store-POS.git"
}

# Clone or update each repo
foreach ($repoName in $repos.Keys) {
    $repoUrl = $repos[$repoName]
    
    if (Test-Path $repoName) {
        Write-Warning "[$repoName] Updating existing repo..."
        Push-Location $repoName
        try {
            git fetch --all --prune 2>&1 | Out-Null
            $pullResult = git pull --ff-only 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Success "[$repoName] Updated successfully"
            } else {
                Write-Warning "[$repoName] Fast-forward failed, repo may have diverged (OK for shallow clones)"
            }
        } finally {
            Pop-Location
        }
    } else {
        Write-Warning "[$repoName] Cloning from $repoUrl..."
        $cloneResult = git clone --depth 1 $repoUrl $repoName 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "[$repoName] Cloned successfully"
        } else {
            Write-Error "[$repoName] Clone failed!"
            exit 1
        }
    }
    Write-Host ""
}

# Generate MANIFEST.json
Write-Warning "Generating MANIFEST.json..."

$manifest = @{
    generated = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    purpose = "Reference POS repositories for architecture pattern study - DO NOT COPY CODE without license review"
    repositories = @()
}

$repoOrder = @("opensourcepos", "nexopos", "pos-awesome", "medusa-pos-starter", "medusa-pos-react", "store-pos")

foreach ($repoName in $repoOrder) {
    if (-not (Test-Path $repoName)) {
        Write-Warning "Warning: $repoName directory not found, skipping..."
        continue
    }
    
    Push-Location $repoName
    
    # Extract metadata
    $url = git config --get remote.origin.url
    $commit = git rev-parse HEAD
    $branch = git rev-parse --abbrev-ref HEAD
    $defaultBranchOutput = git remote show origin 2>$null | Select-String "HEAD branch"
    $defaultBranch = if ($defaultBranchOutput) { 
        ($defaultBranchOutput -split ": ")[1].Trim() 
    } else { 
        $branch 
    }
    
    # Detect license file
    $licenseFile = ""
    $licenseType = "UNKNOWN"
    $licensePatterns = @("LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING", "COPYING.txt", "license.txt")
    foreach ($pattern in $licensePatterns) {
        if (Test-Path $pattern) {
            $licenseFile = $pattern
            break
        }
    }
    
    # Extract license type
    if ($licenseFile) {
        $licenseContent = Get-Content $licenseFile -First 5 | Out-String
        if ($licenseContent -match "MIT License") {
            $licenseType = "MIT"
        } elseif ($licenseContent -match "GNU GENERAL PUBLIC LICENSE") {
            if ($licenseContent -match "Version 3") {
                $licenseType = "GPL-3.0"
            } else {
                $licenseType = "GPL"
            }
        } elseif ($licenseContent -match "Apache License") {
            $licenseType = "Apache-2.0"
        }
    }
    
    # Determine notes
    $notes = switch ($repoName) {
        "opensourcepos" { "PHP/CodeIgniter POS - MIT license, safe for reference and inspiration" }
        "nexopos" { "Laravel/Vue POS - GPL-3.0 (COPYLEFT WARNING: reference only, do not copy code)" }
        "pos-awesome" { "Frappe/ERPNext POS - GPL-3.0 (COPYLEFT WARNING: reference only, do not copy code)" }
        "medusa-pos-starter" { "Medusa.js POS starter - MIT license, safe for reference and inspiration" }
        "medusa-pos-react" { "React Medusa POS - No license file found, assume proprietary/all rights reserved" }
        "store-pos" { "Laravel POS - No license file found, assume proprietary/all rights reserved" }
    }
    
    $manifest.repositories += @{
        name = $repoName
        url = $url
        defaultBranch = $defaultBranch
        commit = $commit
        licenseFile = $licenseFile
        licenseType = $licenseType
        notes = $notes
    }
    
    Pop-Location
}

# Add warnings
$manifest.warnings = @{
    GPL_REPOS = @("nexopos", "pos-awesome")
    COPYLEFT_NOTICE = "GPL-3.0 licensed repos (nexopos, pos-awesome) require derivative works to also be GPL-3.0. DO NOT COPY CODE from these repos into Nimbus POS unless we release Nimbus as GPL-3.0. Use for architecture study and design inspiration only."
    UNKNOWN_LICENSE_REPOS = @("medusa-pos-react", "store-pos")
    UNKNOWN_LICENSE_NOTICE = "Repos without license files should be assumed to be proprietary/all rights reserved. Do not copy any code from these repos."
}

# Write MANIFEST.json
$manifest | ConvertTo-Json -Depth 10 | Set-Content "MANIFEST.json"

Write-Success "MANIFEST.json generated successfully"
Write-Host ""

# Summary
Write-Success "=== Summary ==="
Write-Host "Reference repos synced to: $ReferenceDir"
Write-Host ""
Write-Host "Repos:"
foreach ($repoName in $repos.Keys) {
    if (Test-Path $repoName) {
        Push-Location $repoName
        $commitShort = git rev-parse --short HEAD
        Write-Success "  ✓ $repoName @ $commitShort"
        Pop-Location
    } else {
        Write-Error "  ✗ $repoName (missing)"
    }
}
Write-Host ""
Write-Warning "Next steps:"
Write-Host "  1. Review MANIFEST.json for license information"
Write-Host "  2. Read README.md for usage guidelines"
Write-Host "  3. Study architecture patterns (do not copy GPL code)"
Write-Host ""
Write-Success "Done!"
