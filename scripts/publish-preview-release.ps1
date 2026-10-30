param([switch]$VerifyOnly)

# Publishes the prepared preview. Does not stage other development changes,
# overwrite release assets, force-push, or replace an existing release.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$OutputEncoding = [Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$fridayRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$fridayPackage = Join-Path $fridayRoot 'scratch\release-upload'
$manifestPath = Join-Path $fridayPackage 'release-manifest.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$allowedDocs = @(
    'README.md', 'android-client/README.md', 'docs/plans/release-downloads.md',
    'docs/releases/INSTALL.md', 'docs/releases/preview-2026-10-30.md',
    'scripts/create-release-covers.py', 'scripts/prepare-preview-release.py',
    'scripts/publish-preview-release.ps1', 'scripts/verify-release-readme.mjs',
    'docs/images/releases/friday-windows-exe-cover.png',
    'docs/images/releases/friday-windows-msi-cover.png',
    'docs/images/releases/friday-android-cover.png',
    'docs/images/releases/friday-release-cover.png'
)
if ($manifest.repository -ne 'anes-jpg/friday' -or $manifest.tag -ne 'v1.0.0-preview.20261030') {
    throw 'Unexpected repository or release tag.'
}
if ($manifest.repositoryBaseCommit -notmatch '^[a-f0-9]{40}$') { throw 'Invalid base commit.' }

function Get-Sha256([string]$Path) {
    (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}
function Get-PackagePath([string]$Name) {
    if ($Name -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]*$') { throw 'Invalid asset filename.' }
    Join-Path $fridayPackage $Name
}
function Invoke-Git([string[]]$Arguments) {
    $result = & git -C $fridayRoot @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Git failed: $($Arguments[0])" }
    $result
}

$expected = [ordered]@{}
foreach ($record in $manifest.assets) {
    $path = Get-PackagePath $record.name
    if ($expected.Contains($record.name)) { throw 'Duplicate asset in manifest.' }
    if ((Get-Item -LiteralPath $path).Length -ne $record.size -or
        (Get-Sha256 $path) -ne $record.sha256) { throw "File verification failed: $($record.name)" }
    $expected[$record.name] = $record
}
foreach ($name in @('release-manifest.json', 'SHA256SUMS.txt')) {
    $path = Get-PackagePath $name
    $expected[$name] = [pscustomobject]@{ name = $name; size = (Get-Item -LiteralPath $path).Length; sha256 = Get-Sha256 $path }
}
$checksumNames = @{}
foreach ($line in Get-Content -LiteralPath (Get-PackagePath 'SHA256SUMS.txt')) {
    if ($line -notmatch '^([a-f0-9]{64})  ([A-Za-z0-9][A-Za-z0-9._-]*)$') { throw 'Invalid checksum entry.' }
    $digest, $name = $Matches[1], $Matches[2]
    if (-not $expected.Contains($name) -or $checksumNames.ContainsKey($name) -or
        $expected[$name].sha256 -ne $digest) { throw "Checksum mismatch: $name" }
    $checksumNames[$name] = $true
}
if ($checksumNames.Count -ne $expected.Count - 1) { throw 'Incomplete checksum manifest.' }
$documentNames = @($manifest.documentsToPublish | ForEach-Object { $_.name })
if (@(Compare-Object $allowedDocs $documentNames).Count -ne 0) { throw 'Unexpected documentation scope.' }
foreach ($record in $manifest.documentsToPublish) {
    $path = Join-Path $fridayRoot $record.name
    if ((Get-Sha256 $path) -ne $record.sha256) { throw "Documentation changed: $($record.name). Reprepare the package." }
}
$notesPath = Get-PackagePath 'RELEASE-NOTES.md'
if ((Get-Sha256 $notesPath) -ne (Get-Sha256 (Join-Path $fridayRoot 'docs/releases/preview-2026-10-30.md'))) {
    throw 'Release notes changed after packaging.'
}
Write-Host "Verified $($expected.Count) upload files and $($documentNames.Count) documentation files."
if ($VerifyOnly) { return }

$gh = (Get-Command gh -CommandType Application).Source
function Invoke-Gh([string[]]$Arguments) {
    $result = & $gh @Arguments
    if ($LASTEXITCODE -ne 0) { throw "GitHub CLI failed: $($Arguments[0]). No assets were overwritten." }
    $result
}
function Read-Release {
    $id = Invoke-Gh -Arguments @('release', 'view', $manifest.tag, '--repo', $manifest.repository,
        '--json', 'databaseId', '--jq', '.databaseId')
    (Invoke-Gh -Arguments @('api', "repos/$($manifest.repository)/releases/$id") | Out-String) | ConvertFrom-Json
}
function Verify-RemoteAsset($Asset, $Record) {
    if ($Asset.size -ne $Record.size) { throw "Remote size mismatch: $($Record.name)" }
    $digestProperty = $Asset.PSObject.Properties['digest']
    if ($null -ne $digestProperty -and $digestProperty.Value -match '^sha256:([a-f0-9]{64})$') {
        if ($Matches[1] -ne $Record.sha256) { throw "Remote digest mismatch: $($Record.name)" }
        return
    }
    # Older API responses may omit a digest. Verify downloaded bytes in that case.
    $verificationFolder = Join-Path $fridayPackage ('remote-check-' + [Guid]::NewGuid().ToString('N'))
    $null = New-Item -ItemType Directory -Path $verificationFolder
    $null = Invoke-Gh -Arguments @('release', 'download', $manifest.tag, '--repo', $manifest.repository,
        '--pattern', $Record.name, '--dir', $verificationFolder)
    if ((Get-Sha256 (Join-Path $verificationFolder $Record.name)) -ne $Record.sha256) {
        throw "Remote file hash mismatch: $($Record.name)"
    }
}

$null = Invoke-Gh -Arguments @('auth', 'status', '--hostname', 'github.com')
$releases = (Invoke-Gh -Arguments @('release', 'list', '--repo', $manifest.repository,
    '--limit', '1000', '--json', 'tagName') | Out-String) | ConvertFrom-Json
$release = $null
if (@($releases | Where-Object { $_.tagName -eq $manifest.tag }).Count -gt 0) { $release = Read-Release }
if ((Invoke-Git -Arguments @('remote', 'get-url', 'origin')).Trim() -ne 'https://github.com/anes-jpg/friday.git') {
    throw 'The origin remote changed.'
}
if ((Invoke-Git -Arguments @('branch', '--show-current')).Trim() -ne 'master') { throw 'Run this from the master checkout.' }
if (@(Invoke-Git -Arguments @('diff', '--cached', '--name-only')).Count -gt 0) {
    throw 'The index has staged changes. Preserve or commit them before running the uploader.'
}
$head = (Invoke-Git -Arguments @('rev-parse', 'HEAD')).Trim()
$statePath = Join-Path $fridayPackage 'publish-state.json'
$state = $null
if (Test-Path -LiteralPath $statePath) {
    $state = Get-Content -LiteralPath $statePath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($state.manifestSha256 -ne (Get-Sha256 $manifestPath)) { throw 'The prepared package changed after publication started.' }
}
if ($head -ne $manifest.repositoryBaseCommit) {
    if ($null -eq $state -or $head -ne $state.documentationCommit) {
        throw 'Repository HEAD changed. Reprepare the release before publishing.'
    }
} elseif ($null -eq $state) {
    $changes = @(Invoke-Git (@('status', '--porcelain', '--') + $documentNames))
    if ($changes.Count -gt 0) {
        if ($null -ne $release) { throw 'A release exists before the expected documentation commit. Inspect it before continuing.' }
        $null = Invoke-Git (@('diff', '--check', '--') + $documentNames)
        $null = Invoke-Git (@('add', '--') + $documentNames)
        $null = Invoke-Git -Arguments @('commit', '-m', 'Add Windows and Android preview downloads and package covers')
        $head = (Invoke-Git -Arguments @('rev-parse', 'HEAD')).Trim()
    }
    $state = [pscustomobject]@{ manifestSha256 = Get-Sha256 $manifestPath; documentationCommit = $head }
    $state | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding UTF8
}
if ($null -ne $release -and $release.target_commitish -ne $head) { throw 'The release targets a different commit.' }
$null = Invoke-Git -Arguments @('push', 'origin', 'HEAD:master')

if ($null -eq $release) {
    $null = Invoke-Gh -Arguments @('release', 'create', $manifest.tag, '--repo', $manifest.repository,
        '--draft', '--prerelease', '--latest=false', '--target', $head,
        '--title', $manifest.title, '--notes-file', $notesPath)
    $release = Read-Release
}
if (-not $release.prerelease -or $release.target_commitish -ne $head) { throw 'Release metadata does not match this preview.' }
$expectedNotes = (Get-Content -LiteralPath $notesPath -Raw -Encoding UTF8).Replace("`r`n", "`n").Trim()
if ($release.body.Replace("`r`n", "`n").Trim() -ne $expectedNotes) { throw 'Existing release notes differ from the prepared notes.' }
foreach ($asset in $release.assets) {
    if (-not $expected.Contains($asset.name)) { throw "Unexpected existing asset: $($asset.name)" }
}
foreach ($record in $expected.Values) {
    $existing = @($release.assets | Where-Object { $_.name -eq $record.name })
    if ($existing.Count -gt 0) {
        Verify-RemoteAsset $existing[0] $record
    } else {
        if (-not $release.draft) { throw 'The published release has missing files; inspect it before changing it.' }
        Write-Host "Uploading $($record.name)..."
        $null = Invoke-Gh -Arguments @('release', 'upload', $manifest.tag, (Get-PackagePath $record.name), '--repo', $manifest.repository)
    }
}
$release = Read-Release
if (@($release.assets).Count -ne $expected.Count) { throw 'Remote asset count does not match.' }
foreach ($record in $expected.Values) {
    $asset = @($release.assets | Where-Object { $_.name -eq $record.name })
    if ($asset.Count -ne 1) { throw "Missing or duplicate remote asset: $($record.name)" }
    Verify-RemoteAsset $asset[0] $record
}
if ($release.draft) {
    $null = Invoke-Gh -Arguments @('release', 'edit', $manifest.tag, '--repo', $manifest.repository,
        '--draft=false', '--prerelease', '--latest=false')
}
$release = Read-Release
if ($release.draft -or -not $release.prerelease) { throw 'Preview publication was not confirmed.' }
$release | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $fridayPackage 'published-release.json') -Encoding UTF8
Write-Host "Published and verified: $($release.html_url)"
