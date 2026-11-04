# Build two isolated installers without changing the active branch or personal app.
param([string]$PreviousCommit = 'ab28016')
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$auditRoot = Join-Path $repoRoot 'desktop-test-results/acceptance'
$previousRoot = Join-Path $auditRoot 'previous'
if (Test-Path -LiteralPath $previousRoot) { throw 'Acceptance sources already exist; retain them and use the recorded artifacts.' }
New-Item -ItemType Directory -Path $previousRoot -Force | Out-Null
$previousSha = git -C $repoRoot rev-parse "$PreviousCommit^{commit}"
if ($LASTEXITCODE -ne 0) { throw 'Previous commit does not resolve' }
$candidateSha = git -C $repoRoot rev-parse HEAD
$archive = Join-Path $auditRoot 'previous.tar'
git -C $repoRoot archive $previousSha --format=tar --output=$archive
if ($LASTEXITCODE -ne 0) { throw 'Could not archive previous sources' }
tar -xf $archive -C $previousRoot
if ($LASTEXITCODE -ne 0) { throw 'Could not extract previous sources' }
New-Item -ItemType Junction -Path (Join-Path $previousRoot 'node_modules') -Target (Join-Path $repoRoot 'node_modules') | Out-Null
$configPath = Join-Path $auditRoot 'tauri.conf.json'
@{identifier='com.amirzulfadhli.flowplan-beta-acceptance'; productName='FlowPlan Beta Acceptance'} | ConvertTo-Json | Set-Content -LiteralPath $configPath
@{previous=$previousSha; candidate=$candidateSha; identity='com.amirzulfadhli.flowplan-beta-acceptance'; configuration='release, NSIS, no desktop-test'} | ConvertTo-Json | Set-Content (Join-Path $auditRoot 'sources.json')
. (Join-Path $PSScriptRoot 'windows-env.ps1')
$savedCargoTarget = $env:CARGO_TARGET_DIR
try {
    $env:CARGO_TARGET_DIR = Join-Path $repoRoot 'src-tauri/target'
    foreach ($build in @(@{root=$previousRoot; output='previous-setup.exe'}, @{root=$repoRoot; output='candidate-setup.exe'})) {
        Push-Location $build.root
        try {
            node node_modules/@tauri-apps/cli/tauri.js build --config $configPath -- --locked
            if ($LASTEXITCODE -ne 0) { throw 'Acceptance installer build failed' }
        } finally { Pop-Location }
        $bundles = @(Get-ChildItem -LiteralPath (Join-Path $env:CARGO_TARGET_DIR 'release/bundle/nsis') -Filter 'FlowPlan Beta Acceptance_*-setup.exe')
        if ($bundles.Count -ne 1) { throw 'Expected exactly one acceptance installer; inspect retained artifacts' }
        Copy-Item -LiteralPath $bundles[0].FullName -Destination (Join-Path $auditRoot $build.output)
    }
} finally { $env:CARGO_TARGET_DIR = $savedCargoTarget }
Write-Output 'Acceptance installers are ready. After audits, rebuild with npm run desktop:build before distribution.'
