Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectId = "findyourchurch-staging-2026"
$selectedFirebaseProject = (& firebase.cmd use --json 2>$null | ConvertFrom-Json).result
if ($selectedFirebaseProject -ne $projectId -or $selectedFirebaseProject -eq "findyourchurch-24562") {
  throw "Refusing to run the admin operations smoke test outside staging."
}

$previousApiKey = $env:FYC_STAGING_FIREBASE_API_KEY
$previousPassword = $env:FYC_STAGING_QA_PASSWORD
try {
  $env:FYC_STAGING_FIREBASE_API_KEY = (& gcloud.cmd secrets versions access latest `
    --secret=FYC_STAGING_FIREBASE_API_KEY `
    --project=$projectId 2>$null)
  $env:FYC_STAGING_QA_PASSWORD = (& gcloud.cmd secrets versions access latest `
    --secret=FYC_STAGING_QA_PASSWORD `
    --project=$projectId 2>$null)
  if (
    [string]::IsNullOrWhiteSpace($env:FYC_STAGING_FIREBASE_API_KEY) -or
    [string]::IsNullOrWhiteSpace($env:FYC_STAGING_QA_PASSWORD)
  ) {
    throw "The staging QA authentication secrets could not be loaded into process memory."
  }
  & npx.cmd tsx scripts/test-staging-admin-ops.ts
  if ($LASTEXITCODE -ne 0) {
    throw "The staging admin operations smoke test failed."
  }
} finally {
  if ($null -eq $previousApiKey) { Remove-Item Env:FYC_STAGING_FIREBASE_API_KEY -ErrorAction SilentlyContinue } else { $env:FYC_STAGING_FIREBASE_API_KEY = $previousApiKey }
  if ($null -eq $previousPassword) { Remove-Item Env:FYC_STAGING_QA_PASSWORD -ErrorAction SilentlyContinue } else { $env:FYC_STAGING_QA_PASSWORD = $previousPassword }
}
