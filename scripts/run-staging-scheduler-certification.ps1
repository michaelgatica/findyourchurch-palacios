Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectId = "findyourchurch-staging-2026"
$selectedFirebaseProject = (& firebase.cmd use --json 2>$null | ConvertFrom-Json).result
if ($selectedFirebaseProject -ne $projectId -or $selectedFirebaseProject -eq "findyourchurch-24562") {
  throw "Refusing to run scheduler certification outside staging."
}

$previousSecret = $env:REGISTRATION_JOBS_CRON_SECRET
$previousAccessToken = $env:FYC_STAGING_GCLOUD_ACCESS_TOKEN
try {
  $env:REGISTRATION_JOBS_CRON_SECRET = (& gcloud.cmd secrets versions access latest `
    --secret=FYC_STAGING_SCHEDULER_TOKEN `
    --project=$projectId 2>$null)
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($env:REGISTRATION_JOBS_CRON_SECRET)) {
    throw "The staging scheduler secret could not be loaded into process memory."
  }
  $env:FYC_STAGING_GCLOUD_ACCESS_TOKEN = (& gcloud.cmd auth print-access-token 2>$null).Trim()
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($env:FYC_STAGING_GCLOUD_ACCESS_TOKEN)) {
    throw "A Google Cloud access token could not be loaded into process memory."
  }
  & npx.cmd tsx scripts/certify-staging-scheduler.ts
  if ($LASTEXITCODE -ne 0) {
    throw "The staging scheduler certification failed."
  }
} finally {
  if ($null -eq $previousSecret) {
    Remove-Item Env:REGISTRATION_JOBS_CRON_SECRET -ErrorAction SilentlyContinue
  } else {
    $env:REGISTRATION_JOBS_CRON_SECRET = $previousSecret
  }
  if ($null -eq $previousAccessToken) {
    Remove-Item Env:FYC_STAGING_GCLOUD_ACCESS_TOKEN -ErrorAction SilentlyContinue
  } else {
    $env:FYC_STAGING_GCLOUD_ACCESS_TOKEN = $previousAccessToken
  }
}
