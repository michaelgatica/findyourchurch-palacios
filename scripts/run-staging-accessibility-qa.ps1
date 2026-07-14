param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$PlaywrightArguments
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectId = "findyourchurch-staging-2026"
$productionProjectId = "findyourchurch-24562"
$selectedFirebaseProject = (& firebase.cmd use --json 2>$null | ConvertFrom-Json).result
if ($selectedFirebaseProject -ne $projectId -or $selectedFirebaseProject -eq $productionProjectId) {
  throw "Refusing to run hosted accessibility QA outside the dedicated staging project."
}

$previousApiKey = $env:FYC_STAGING_FIREBASE_API_KEY
$previousPassword = $env:FYC_STAGING_QA_PASSWORD
$previousBaseUrl = $env:STAGING_BASE_URL
$previousOAuthToken = $env:FYC_STAGING_FIRESTORE_OAUTH_TOKEN
$previousApprovedRecipient = $env:FYC_STAGING_APPROVED_EMAIL_RECIPIENT

try {
  $env:FYC_STAGING_FIREBASE_API_KEY = (& gcloud.cmd secrets versions access latest `
    --secret=FYC_STAGING_FIREBASE_API_KEY `
    --project=$projectId 2>$null)
  $env:FYC_STAGING_QA_PASSWORD = (& gcloud.cmd secrets versions access latest `
    --secret=FYC_STAGING_QA_PASSWORD `
    --project=$projectId 2>$null)
  $env:FYC_STAGING_FIRESTORE_OAUTH_TOKEN = (& gcloud.cmd auth print-access-token 2>$null)
  $env:FYC_STAGING_APPROVED_EMAIL_RECIPIENT = (& gcloud.cmd secrets versions access latest `
    --secret=FYC_STAGING_TEST_EMAIL_TO `
    --project=$projectId 2>$null)
  $env:STAGING_BASE_URL = "https://community-hub-staging--findyourchurch-staging-2026.us-central1.hosted.app"
  if (
    [string]::IsNullOrWhiteSpace($env:FYC_STAGING_FIREBASE_API_KEY) -or
    [string]::IsNullOrWhiteSpace($env:FYC_STAGING_QA_PASSWORD) -or
    [string]::IsNullOrWhiteSpace($env:FYC_STAGING_FIRESTORE_OAUTH_TOKEN) -or
    [string]::IsNullOrWhiteSpace($env:FYC_STAGING_APPROVED_EMAIL_RECIPIENT)
  ) {
    throw "Staging QA authentication values could not be loaded into process memory."
  }

  & npx.cmd playwright test --config=playwright.staging.config.ts @PlaywrightArguments
  if ($LASTEXITCODE -ne 0) {
    throw "Hosted staging accessibility QA failed."
  }
} finally {
  if ($null -eq $previousApiKey) { Remove-Item Env:FYC_STAGING_FIREBASE_API_KEY -ErrorAction SilentlyContinue } else { $env:FYC_STAGING_FIREBASE_API_KEY = $previousApiKey }
  if ($null -eq $previousPassword) { Remove-Item Env:FYC_STAGING_QA_PASSWORD -ErrorAction SilentlyContinue } else { $env:FYC_STAGING_QA_PASSWORD = $previousPassword }
  if ($null -eq $previousBaseUrl) { Remove-Item Env:STAGING_BASE_URL -ErrorAction SilentlyContinue } else { $env:STAGING_BASE_URL = $previousBaseUrl }
  if ($null -eq $previousOAuthToken) { Remove-Item Env:FYC_STAGING_FIRESTORE_OAUTH_TOKEN -ErrorAction SilentlyContinue } else { $env:FYC_STAGING_FIRESTORE_OAUTH_TOKEN = $previousOAuthToken }
  if ($null -eq $previousApprovedRecipient) { Remove-Item Env:FYC_STAGING_APPROVED_EMAIL_RECIPIENT -ErrorAction SilentlyContinue } else { $env:FYC_STAGING_APPROVED_EMAIL_RECIPIENT = $previousApprovedRecipient }
}
