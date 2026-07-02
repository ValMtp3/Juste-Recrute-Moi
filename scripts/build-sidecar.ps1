$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
pnpm build:sidecar
