$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
node .\scripts\setup.mjs @args
exit $LASTEXITCODE
