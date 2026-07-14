param(
  [string]$ProjectId = "findyourchurch-staging-2026",
  [string]$Location = "us-central1",
  [string]$JobId = "community-hub-registration-jobs-staging",
  [string]$Schedule = "*/15 * * * *",
  [string]$TimeZone = "America/Chicago",
  [string]$TargetUrl = "https://community-hub-staging--findyourchurch-staging-2026.us-central1.hosted.app/api/jobs/registration"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$stagingProjectId = "findyourchurch-staging-2026"
$productionProjectId = "findyourchurch-24562"
$schedulerSecretName = "FYC_STAGING_SCHEDULER_TOKEN"

if ($ProjectId -ne $stagingProjectId -or $ProjectId -eq $productionProjectId) {
  throw "Refusing to configure Cloud Scheduler outside the dedicated staging project."
}

$selectedFirebaseProject = (& firebase.cmd use --json 2>$null | ConvertFrom-Json).result
if ($selectedFirebaseProject -ne $stagingProjectId) {
  throw "Firebase CLI must be explicitly selected to findyourchurch-staging-2026."
}

$targetUri = [Uri]$TargetUrl
if (
  $targetUri.Scheme -ne "https" -or
  $targetUri.Host -ne "community-hub-staging--findyourchurch-staging-2026.us-central1.hosted.app" -or
  $targetUri.AbsolutePath -ne "/api/jobs/registration"
) {
  throw "Refusing an unknown or non-staging scheduler target URL."
}

Write-Output "Verified Firebase and Google Cloud write target: findyourchurch-staging-2026."
& gcloud.cmd services enable cloudscheduler.googleapis.com --project=$ProjectId --quiet | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "Cloud Scheduler API enablement failed for the staging project."
}
Write-Output "Cloud Scheduler API is enabled for staging."

$schedulerSecret = $null
$accessToken = $null
$requestBody = $null

try {
  $schedulerSecret = (& gcloud.cmd secrets versions access latest --secret=$schedulerSecretName --project=$ProjectId 2>$null)
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($schedulerSecret)) {
    throw "The staging scheduler authentication secret is unavailable."
  }

  $accessToken = (& gcloud.cmd auth print-access-token 2>$null).Trim()
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($accessToken)) {
    throw "A Google Cloud access token could not be obtained."
  }

  $jobName = "projects/$ProjectId/locations/$Location/jobs/$JobId"
  $apiRoot = "https://cloudscheduler.googleapis.com/v1"
  $jobUrl = "$apiRoot/$jobName"
  $headers = @{
    Authorization = "Bearer $accessToken"
    "Content-Type" = "application/json"
  }
  $jobDefinition = @{
    name = $jobName
    description = "STAGING ONLY: dispatches due Community Ministry Hub registration jobs."
    schedule = $Schedule
    timeZone = $TimeZone
    attemptDeadline = "180s"
    httpTarget = @{
      uri = $TargetUrl
      httpMethod = "POST"
      headers = @{
        "x-cron-secret" = $schedulerSecret
        "x-fyc-environment" = "staging"
      }
    }
    retryConfig = @{
      retryCount = 3
      maxRetryDuration = "900s"
      minBackoffDuration = "30s"
      maxBackoffDuration = "300s"
      maxDoublings = 3
    }
  }
  $requestBody = $jobDefinition | ConvertTo-Json -Depth 8 -Compress

  $jobExists = $false
  try {
    Invoke-RestMethod -Method Get -Uri $jobUrl -Headers $headers | Out-Null
    $jobExists = $true
  } catch {
    if ($_.Exception.Response.StatusCode.value__ -ne 404) {
      throw "Cloud Scheduler job lookup failed without exposing response details."
    }
  }

  if ($jobExists) {
    $updateMask = "description,schedule,timeZone,attemptDeadline,httpTarget,retryConfig"
    Invoke-RestMethod -Method Patch -Uri "$jobUrl`?updateMask=$updateMask" -Headers $headers -Body $requestBody | Out-Null
    Write-Output "Updated staging scheduler job: $JobId."
  } else {
    $createUrl = "$apiRoot/projects/$ProjectId/locations/$Location/jobs"
    $created = $false
    for ($attempt = 1; $attempt -le 6 -and -not $created; $attempt += 1) {
      try {
        Invoke-RestMethod -Method Post -Uri $createUrl -Headers $headers -Body $requestBody | Out-Null
        $created = $true
      } catch {
        if ($attempt -eq 6) {
          throw "Cloud Scheduler job creation failed without exposing response details."
        }
        Start-Sleep -Seconds 5
      }
    }
    Write-Output "Created staging scheduler job: $JobId."
  }
} finally {
  $schedulerSecret = $null
  $accessToken = $null
  $requestBody = $null
}

& gcloud.cmd scheduler jobs describe $JobId `
  --project=$ProjectId `
  --location=$Location `
  --format="table(name.basename(),schedule,timeZone,state,httpTarget.uri,httpTarget.httpMethod)"
if ($LASTEXITCODE -ne 0) {
  throw "The staging scheduler job could not be verified."
}
