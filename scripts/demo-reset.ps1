# ChefCloud Zero-Touch Demo Reset (PowerShell)
# Runs complete demo setup and verification

$ErrorActionPreference = "Stop"

Write-Host "🚀 ChefCloud Zero-Touch Demo Reset" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Change to repo root
Set-Location $PSScriptRoot\..

# Step 1: Check prerequisites
Write-Host "📋 Step 1/6: Checking prerequisites..." -ForegroundColor Yellow
try {
    $null = Get-Command node -ErrorAction Stop
    $null = Get-Command pnpm -ErrorAction Stop
    Write-Host "✅ Prerequisites OK" -ForegroundColor Green
} catch {
    Write-Host "❌ Missing prerequisites. Please install Node.js 18+ and pnpm" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 2: Install dependencies
Write-Host "📦 Step 2/6: Installing dependencies..." -ForegroundColor Yellow
pnpm install --frozen-lockfile
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Dependencies installed" -ForegroundColor Green
Write-Host ""

# Step 3: Build packages
Write-Host "🔨 Step 3/6: Building packages..." -ForegroundColor Yellow
Set-Location packages\db
pnpm build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to build db package" -ForegroundColor Red
    exit 1
}
Set-Location ..\..\services\api
pnpm build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to build api service" -ForegroundColor Red
    exit 1
}
Set-Location ..\..
Write-Host "✅ Build complete" -ForegroundColor Green
Write-Host ""

# Step 4: Run migrations
Write-Host "🗄️  Step 4/6: Running database migrations..." -ForegroundColor Yellow
Set-Location packages\db
pnpm prisma migrate deploy
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to run migrations" -ForegroundColor Red
    exit 1
}
Set-Location ..\..
Write-Host "✅ Migrations applied" -ForegroundColor Green
Write-Host ""

# Step 5: Seed demo data
Write-Host "🌱 Step 5/6: Seeding demo data..." -ForegroundColor Yellow
Set-Location services\api
$env:NODE_ENV = "development"
$env:SEED_DEMO_DATA = "true"
pnpm tsx prisma/seed.ts
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to seed demo data" -ForegroundColor Red
    exit 1
}
Set-Location ..\..
Write-Host "✅ Demo data seeded" -ForegroundColor Green
Write-Host ""

# Step 6: Run verifiers
Write-Host "🧪 Step 6/6: Running verification tests..." -ForegroundColor Yellow
Write-Host ""

# Start API server in background
Write-Host "Starting API server..." -ForegroundColor Cyan
Set-Location services\api
$apiProcess = Start-Process -NoNewWindow -FilePath "node" -ArgumentList "dist/src/main.js" -PassThru
Set-Location ..\..

# Wait for server to be ready
Write-Host "Waiting for API server to start..." -ForegroundColor Cyan
Start-Sleep -Seconds 10

# Check if server is running
try {
    $null = Invoke-RestMethod -Uri "http://localhost:3001/health" -ErrorAction SilentlyContinue
} catch {
    Write-Host "⚠️  Health endpoint not responding, waiting longer..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
}

# Run demo health verifier
Write-Host ""
Write-Host "Running demo health check..." -ForegroundColor Cyan
Set-Location services\api
pnpm tsx ../../scripts/verify-demo-health.ts
$healthPass = $LASTEXITCODE -eq 0
if ($healthPass) {
    Write-Host "✅ Demo health check PASSED" -ForegroundColor Green
} else {
    Write-Host "❌ Demo health check FAILED" -ForegroundColor Red
}
Set-Location ..\..

# Run role coverage verifier
Write-Host ""
Write-Host "Running role coverage verification..." -ForegroundColor Cyan
Set-Location services\api
pnpm tsx ../../scripts/verify-role-coverage.ts --out ../../instructions/M7.6_VERIFY_OUTPUT.txt
$coveragePass = $LASTEXITCODE -eq 0
if ($coveragePass) {
    Write-Host "✅ Role coverage verification PASSED" -ForegroundColor Green
} else {
    Write-Host "❌ Role coverage verification FAILED" -ForegroundColor Red
}
Set-Location ..\..

# Kill API server
Stop-Process -Id $apiProcess.Id -Force -ErrorAction SilentlyContinue

# Summary
Write-Host ""
Write-Host "====================================" -ForegroundColor Cyan
Write-Host "📊 VERIFICATION SUMMARY" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

if ($healthPass -and $coveragePass) {
    Write-Host "✅ ALL TESTS PASSED" -ForegroundColor Green
    Write-Host ""
    Write-Host "Demo is ready! You can now:" -ForegroundColor White
    Write-Host "  1. Start API: cd services\api; pnpm start" -ForegroundColor White
    Write-Host "  2. Start Web: cd apps\web; pnpm dev" -ForegroundColor White
    Write-Host "  3. Login with test credentials (see instructions\M7.6_FRESH_START_GUIDE.md)" -ForegroundColor White
    exit 0
} else {
    Write-Host "❌ SOME TESTS FAILED" -ForegroundColor Red
    Write-Host ""
    Write-Host "Check the output above for details." -ForegroundColor White
    Write-Host "See instructions\M7.6_FRESH_START_GUIDE.md for troubleshooting." -ForegroundColor White
    exit 1
}
