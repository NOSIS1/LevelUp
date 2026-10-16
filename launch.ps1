param(
    [switch]$CheckOnly,
    [switch]$Build,
    [switch]$Clean,
    [switch]$InstallOnly,
    [switch]$Dev
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$arguments = @()
if ($CheckOnly) { $arguments += '--check' }
if ($Build) { $arguments += '--production' }
if ($Clean) { $arguments += '--clean' }
if ($InstallOnly) { $arguments += '--install-only' }
if ($Dev) { $arguments += '--dev' }
& node '.\scripts\setup.mjs' @arguments
exit $LASTEXITCODE
