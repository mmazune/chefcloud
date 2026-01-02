# Clone/Update Feature-Level Reference Repositories (PowerShell)
# Usage: .\scripts\reference\clone-reference-feature-repos.ps1
#
# This script:
# 1. Clones missing repos (shallow, depth=1)
# 2. Pulls updates for existing repos (fast-forward only)
# 3. Regenerates MANIFEST.json with current commit info

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent (Split-Path -Parent $ScriptDir)
$RefDir = Join-Path $RepoRoot "reference-feature-repos"

# Repo definitions: domain, name, url
$Repos = @(
    @{Domain="accounting"; Name="bigcapital"; Url="https://github.com/bigcapitalhq/bigcapital.git"},
    @{Domain="accounting"; Name="hledger"; Url="https://github.com/simonmichael/hledger.git"},
    @{Domain="accounting"; Name="beancount"; Url="https://github.com/beancount/beancount.git"},
    @{Domain="inventory-procurement"; Name="InvenTree"; Url="https://github.com/inventree/InvenTree.git"},
    @{Domain="inventory-procurement"; Name="medusa"; Url="https://github.com/medusajs/medusa.git"},
    @{Domain="reservations"; Name="TastyIgniter"; Url="https://github.com/tastyigniter/TastyIgniter.git"},
    @{Domain="reservations"; Name="easyappointments"; Url="https://github.com/alextselegidis/easyappointments.git"},
    @{Domain="reservations"; Name="cal.com"; Url="https://github.com/calcom/cal.com.git"},
    @{Domain="workforce"; Name="kimai"; Url="https://github.com/kimai/kimai.git"},
    @{Domain="billing-subscriptions"; Name="killbill"; Url="https://github.com/killbill/killbill.git"},
    @{Domain="billing-subscriptions"; Name="lago"; Url="https://github.com/getlago/lago.git"},
    @{Domain="ui-systems"; Name="appsmith"; Url="https://github.com/appsmithorg/appsmith.git"},
    @{Domain="ui-systems"; Name="tremor"; Url="https://github.com/tremorlabs/tremor.git"},
    @{Domain="qa-testing"; Name="playwright"; Url="https://github.com/microsoft/playwright.git"},
    @{Domain="qa-testing"; Name="cypress"; Url="https://github.com/cypress-io/cypress.git"},
    @{Domain="security"; Name="CheatSheetSeries"; Url="https://github.com/OWASP/CheatSheetSeries.git"},
    @{Domain="security"; Name="ASVS"; Url="https://github.com/OWASP/ASVS.git"},
    @{Domain="security"; Name="juice-shop"; Url="https://github.com/juice-shop/juice-shop.git"}
)

function Write-Info($message) {
    Write-Host "[INFO] $message" -ForegroundColor Green
}

function Write-Warn($message) {
    Write-Host "[WARN] $message" -ForegroundColor Yellow
}

function Write-Error($message) {
    Write-Host "[ERROR] $message" -ForegroundColor Red
}

function Create-Directories {
    Write-Info "Creating directory structure..."
    $domains = @("accounting", "inventory-procurement", "reservations", "workforce", 
                 "billing-subscriptions", "ui-systems", "qa-testing", "security")
    foreach ($domain in $domains) {
        $path = Join-Path $RefDir $domain
        if (-not (Test-Path $path)) {
            New-Item -ItemType Directory -Path $path -Force | Out-Null
        }
    }
}

function Process-Repo($domain, $name, $url) {
    $targetDir = Join-Path $RefDir $domain $name
    $gitDir = Join-Path $targetDir ".git"
    
    if (Test-Path $gitDir) {
        Write-Info "Updating $domain/$name..."
        Push-Location $targetDir
        try {
            git fetch origin --depth=1 2>&1 | Out-Null
            $branch = git rev-parse --abbrev-ref HEAD
            git reset --hard "origin/$branch" 2>&1 | Out-Null
        } catch {
            Write-Warn "Update failed for $name"
            Pop-Location
            return $false
        }
        Pop-Location
    } else {
        Write-Info "Cloning $domain/$name..."
        if (Test-Path $targetDir) {
            Remove-Item -Recurse -Force $targetDir
        }
        try {
            git clone --depth 1 $url $targetDir 2>&1 | Out-Null
        } catch {
            Write-Error "Clone failed for $name"
            return $false
        }
    }
    return $true
}

function Detect-License($licenseFile) {
    if (-not $licenseFile -or -not (Test-Path $licenseFile)) {
        return "UNKNOWN"
    }
    
    $content = Get-Content $licenseFile -Raw -ErrorAction SilentlyContinue
    if (-not $content) { return "UNKNOWN" }
    
    if ($content -match "Apache\s*License") { return "Apache-2.0" }
    if ($content -match "MIT License") { return "MIT" }
    if ($content -match "Permission is hereby granted, free of charge") { return "MIT" }
    if ($content -match "GNU AFFERO GENERAL PUBLIC LICENSE") { return "AGPL-3.0" }
    if ($content -match "GNU GENERAL PUBLIC LICENSE") {
        if ($content -match "Version 3") { return "GPL-3.0" }
        return "GPL-2.0"
    }
    if ($content -match "BSD") { return "BSD" }
    if ($content -match "Creative Commons") { return "CC-BY-4.0" }
    
    return "UNKNOWN"
}

function Generate-Manifest {
    Write-Info "Generating MANIFEST.json..."
    
    $manifestFile = Join-Path $RefDir "MANIFEST.json"
    $timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    $repoList = @()
    $permissive = 0
    $copyleft = 0
    $unknown = 0
    
    foreach ($repo in $Repos) {
        $targetDir = Join-Path $RefDir $repo.Domain $repo.Name
        $gitDir = Join-Path $targetDir ".git"
        
        if (Test-Path $gitDir) {
            Push-Location $targetDir
            $branch = git rev-parse --abbrev-ref HEAD 2>$null
            $commit = git rev-parse --short HEAD 2>$null
            
            $licenseFiles = Get-ChildItem -Path $targetDir -Name "LICENSE*","COPYING*","license*","copying*" -ErrorAction SilentlyContinue | Select-Object -First 1
            $licenseFile = if ($licenseFiles) { Join-Path $targetDir $licenseFiles } else { $null }
            $licenseType = Detect-License $licenseFile
            
            switch -Regex ($licenseType) {
                "MIT|Apache-2.0|BSD|CC-BY" { $permissive++ }
                "GPL|AGPL" { $copyleft++ }
                default { $unknown++ }
            }
            
            $repoList += @{
                name = $repo.Name
                url = $repo.Url
                domain = $repo.Domain
                licenseDetected = $licenseType
                licenseFilePath = if ($licenseFiles) { $licenseFiles } else { "" }
                headCommit = $commit
                defaultBranch = $branch
                notes = ""
            }
            Pop-Location
        }
    }
    
    $manifest = @{
        generatedAt = $timestamp
        description = "Feature-level reference repositories for architecture study and clean-room pattern extraction"
        licensePolicy = @{
            permissive = "MIT, Apache-2.0, BSD, CC-BY - Pattern adaptation allowed with attribution"
            copyleft = "GPL-*, AGPL-* - Architecture study only, no code copying"
            unknown = "View-only, no adaptation"
        }
        repos = $repoList
        summary = @{
            total = $repoList.Count
            permissive = $permissive
            copyleft = $copyleft
            unknown = $unknown
        }
    }
    
    $manifest | ConvertTo-Json -Depth 10 | Set-Content $manifestFile
    Write-Info "MANIFEST.json generated with $($repoList.Count) repos"
}

# Main execution
function Main {
    Write-Info "Starting reference repo sync..."
    
    Create-Directories
    
    $failed = 0
    foreach ($repo in $Repos) {
        $result = Process-Repo $repo.Domain $repo.Name $repo.Url
        if (-not $result) { $failed++ }
    }
    
    Generate-Manifest
    
    if ($failed -gt 0) {
        Write-Warn "$failed repos failed to clone/update"
        exit 1
    } else {
        Write-Info "All repos synced successfully!"
    }
}

Main
