param(
    [string]$Filter = 'workspace',
    [string]$ManifestTool = ''
)

$ErrorActionPreference = 'Stop'

# Tauri links Common Controls v6 resources into application bins, but not Rust
# unit-test executables. Activate v6 only in the test runner, after Cargo links it.
if (-not $ManifestTool) {
    $installedTool = Get-Command mt.exe -ErrorAction SilentlyContinue
    if ($installedTool) {
        $ManifestTool = $installedTool.Source
    } else {
        $sdkBin = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits/10/bin'
        $sdkVersions = Get-ChildItem -LiteralPath $sdkBin -Directory |
            Where-Object { $_.Name -match '^\d+\.\d+\.\d+\.\d+$' } |
            Sort-Object { [version]$_.Name } -Descending
        foreach ($sdkVersion in $sdkVersions) {
            $candidate = Join-Path $sdkVersion.FullName 'x64/mt.exe'
            if (Test-Path -LiteralPath $candidate -PathType Leaf) {
                $ManifestTool = $candidate
                break
            }
        }
    }
}
if (-not $ManifestTool -or -not (Test-Path -LiteralPath $ManifestTool -PathType Leaf)) {
    throw 'Windows SDK mt.exe is required. Install the SDK or pass -ManifestTool with its path.'
}

$cargoManifest = Join-Path $PSScriptRoot 'Cargo.toml'
$testManifest = Join-Path $PSScriptRoot 'windows.manifest'
$executables = @(& cargo test --manifest-path $cargoManifest --lib --no-run --message-format=json | ForEach-Object {
    $message = $_ | ConvertFrom-Json
    if ($message.reason -eq 'compiler-message') {
        Write-Host $message.message.rendered
    } elseif ($message.reason -eq 'compiler-artifact' -and
        $message.target.name -eq 'friday_lib' -and $message.profile.test -and $message.executable) {
        $message.executable
    }
})
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
if ($executables.Count -ne 1) {
    throw "Expected one friday_lib unit-test executable, found $($executables.Count)."
}

$testExecutable = $executables[0]
Write-Host "Embedding Common Controls v6 into test runner: $testExecutable"
& $ManifestTool -manifest $testManifest "-outputresource:$testExecutable;#1"
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
& $testExecutable $Filter --nocapture
exit $LASTEXITCODE
