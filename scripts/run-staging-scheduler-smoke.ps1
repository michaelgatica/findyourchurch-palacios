Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectId = "findyourchurch-staging-2026"
$productionProjectId = "findyourchurch-24562"
$selectedFirebaseProject = (& firebase.cmd use --json 2>$null | ConvertFrom-Json).result
if ($selectedFirebaseProject -ne $projectId -or $selectedFirebaseProject -eq $productionProjectId) {
  throw "Refusing to run the hosted scheduler smoke test outside staging."
}

$previousSecret = $env:REGISTRATION_JOBS_CRON_SECRET
try {
  $env:REGISTRATION_JOBS_CRON_SECRET = (& gcloud.cmd secrets versions access latest `
    --secret=FYC_STAGING_SCHEDULER_TOKEN `
    --project=$projectId 2>$null)
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($env:REGISTRATION_JOBS_CRON_SECRET)) {
    throw "The staging scheduler secret could not be loaded into process memory."
  }
  & npx.cmd tsx scripts/test-staging-scheduler-hosted.ts
  if ($LASTEXITCODE -ne 0) {
    throw "The hosted staging scheduler smoke test failed."
  }
} finally {
  if ($null -eq $previousSecret) {
    Remove-Item Env:REGISTRATION_JOBS_CRON_SECRET -ErrorAction SilentlyContinue
  } else {
    $env:REGISTRATION_JOBS_CRON_SECRET = $previousSecret
  }
}
