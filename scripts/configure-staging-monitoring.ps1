Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectId = "findyourchurch-staging-2026"
$productionProjectId = "findyourchurch-24562"
$backendService = "community-hub-staging"
$uptimeCheckId = "community-hub-staging-website-ism-gwXP8h4"

$selectedFirebaseProject = (& firebase.cmd use).Trim()
if ($selectedFirebaseProject -ne $projectId -or $selectedFirebaseProject -eq $productionProjectId) {
  throw "Refusing to configure monitoring outside the dedicated staging project."
}

$channelJson = ((& gcloud.cmd beta monitoring channels list --project=$projectId --format=json) -join "`n")
$channelData = $channelJson | ConvertFrom-Json
$notificationChannels = @()
for ($index = 0; $index -lt $channelData.Count; $index += 1) {
  $channel = $channelData[$index]
  if ($channel.type -eq "email" -and $channel.enabled) {
    $notificationChannels += [string]$channel.name
  }
}
if ($notificationChannels.Count -ne 3) {
  throw "Expected exactly three enabled staging email notification channels."
}

$accessToken = & gcloud.cmd auth print-access-token
$headers = @{ Authorization = "Bearer $accessToken" }
$policyList = Invoke-RestMethod `
  -Headers $headers `
  -Uri "https://monitoring.googleapis.com/v3/projects/$projectId/alertPolicies?pageSize=100"
$existingDisplayNames = if (@($policyList | Get-Member -Name "alertPolicies").Count -gt 0) {
  @($policyList.alertPolicies | ForEach-Object { $_.displayName })
} else {
  @()
}

function New-Aggregation {
  param(
    [Parameter(Mandatory = $true)][string]$Period,
    [string]$Aligner = "ALIGN_SUM",
    [string]$Reducer = "REDUCE_SUM",
    [string[]]$GroupBy = @()
  )
  return @{
    alignmentPeriod = $Period
    perSeriesAligner = $Aligner
    crossSeriesReducer = $Reducer
    groupByFields = $GroupBy
  }
}

function New-CountCondition {
  param(
    [Parameter(Mandatory = $true)][string]$DisplayName,
    [Parameter(Mandatory = $true)][string]$Metric,
    [Parameter(Mandatory = $true)][double]$Threshold,
    [Parameter(Mandatory = $true)][string]$Window
  )
  return @{
    displayName = $DisplayName
    conditionThreshold = @{
      filter = "metric.type=`"logging.googleapis.com/user/$Metric`" AND resource.type=`"cloud_run_revision`""
      aggregations = @((New-Aggregation -Period $Window))
      comparison = "COMPARISON_GT"
      thresholdValue = $Threshold
      duration = "0s"
      trigger = @{ count = 1 }
    }
  }
}

function New-Policy {
  param(
    [Parameter(Mandatory = $true)][string]$DisplayName,
    [Parameter(Mandatory = $true)][string]$Severity,
    [Parameter(Mandatory = $true)][object[]]$Conditions,
    [Parameter(Mandatory = $true)][string]$Documentation
  )
  return @{
    displayName = $DisplayName
    documentation = @{ content = $Documentation; mimeType = "text/markdown" }
    userLabels = @{ service = "community-hub"; environment = "staging" }
    conditions = @($Conditions)
    combiner = "OR"
    enabled = $true
    notificationChannels = $notificationChannels
    severity = $Severity
    alertStrategy = @{
      notificationPrompts = @("OPENED", "CLOSED")
      autoClose = "604800s"
    }
  }
}

$policies = @()

$uptimeCondition = @{
  displayName = "Website unavailable for five minutes"
  conditionThreshold = @{
    filter = "metric.type=`"monitoring.googleapis.com/uptime_check/check_passed`" AND resource.type=`"uptime_url`" AND metric.label.check_id=`"$uptimeCheckId`""
    aggregations = @((New-Aggregation -Period "60s" -Aligner "ALIGN_NEXT_OLDER" -Reducer "REDUCE_FRACTION_TRUE" -GroupBy @("metric.label.check_id")))
    comparison = "COMPARISON_LT"
    thresholdValue = 0.5
    duration = "300s"
    trigger = @{ count = 1 }
    evaluationMissingData = "EVALUATION_MISSING_DATA_ACTIVE"
  }
}
$policies += New-Policy `
  -DisplayName "Community Hub - website unavailable" `
  -Severity "CRITICAL" `
  -Conditions @($uptimeCondition) `
  -Documentation "Critical. Confirm the staging site, App Hosting revision, Firebase status, and rollback readiness. Escalate immediately."

$ratioAggregation = New-Aggregation `
  -Period "300s" `
  -Aligner "ALIGN_RATE" `
  -Reducer "REDUCE_SUM" `
  -GroupBy @("resource.label.service_name")
$serverErrorCondition = @{
  displayName = "5xx response ratio above 5 percent for five minutes"
  conditionThreshold = @{
    filter = "metric.type=`"run.googleapis.com/request_count`" AND resource.type=`"cloud_run_revision`" AND resource.label.service_name=`"$backendService`" AND metric.label.response_code_class=`"5xx`""
    denominatorFilter = "metric.type=`"run.googleapis.com/request_count`" AND resource.type=`"cloud_run_revision`" AND resource.label.service_name=`"$backendService`""
    aggregations = @($ratioAggregation)
    denominatorAggregations = @($ratioAggregation)
    comparison = "COMPARISON_GT"
    thresholdValue = 0.05
    duration = "300s"
    trigger = @{ count = 1 }
  }
}
$policies += New-Policy `
  -DisplayName "Community Hub - server error rate above 5 percent" `
  -Severity "CRITICAL" `
  -Conditions @($serverErrorCondition) `
  -Documentation "Critical. Inspect Error Reporting and Cloud Run request logs, pause launch activity, and roll back if tied to a new revision."

$policies += New-Policy `
  -DisplayName "Community Hub - security isolation test failure" `
  -Severity "CRITICAL" `
  -Conditions @((New-CountCondition -DisplayName "Any cross-church or private-data isolation failure" -Metric "community_hub_security_isolation_failures" -Threshold 0 -Window "60s")) `
  -Documentation "Critical. Treat as a launch stop, disable affected access, preserve logs, and notify the security owner."

$policies += New-Policy `
  -DisplayName "Community Hub - registration count inconsistency" `
  -Severity "CRITICAL" `
  -Conditions @((New-CountCondition -DisplayName "Any registration-count inconsistency or capacity exceedance" -Metric "community_hub_registration_count_inconsistencies" -Threshold 0 -Window "60s")) `
  -Documentation "Critical. Pause new registrations for the affected event and reconcile aggregate counts before reopening."

$policies += New-Policy `
  -DisplayName "Community Hub - Scheduler failed twice" `
  -Severity "CRITICAL" `
  -Conditions @((New-CountCondition -DisplayName "Two terminal Scheduler failures in 15 minutes" -Metric "community_hub_scheduler_failures" -Threshold 1 -Window "900s")) `
  -Documentation "Critical. Pause the affected job if necessary, inspect safe correlation IDs, and use the documented manual fallback."

$backupConditions = @()
$backupConditions += New-CountCondition `
  -DisplayName "Any explicit Firestore backup verification failure" `
  -Metric "community_hub_firestore_backup_failures" `
  -Threshold 0 `
  -Window "3600s"
$backupConditions += @{
  displayName = "No expected Firestore backup storage metric for 24 hours"
  conditionAbsent = @{
    filter = "metric.type=`"firestore.googleapis.com/storage/backups_storage_bytes`" AND resource.type=`"firestore.googleapis.com/Database`""
    duration = "84600s"
    aggregations = @(@{ alignmentPeriod = "3600s"; perSeriesAligner = "ALIGN_MAX" })
  }
}
$policies += New-Policy `
  -DisplayName "Community Hub - Firestore backup missing or failed" `
  -Severity "CRITICAL" `
  -Conditions $backupConditions `
  -Documentation "Critical. Verify both backup schedules, inspect the latest backup, and do not continue launch until recoverability is restored."

$policies += New-Policy `
  -DisplayName "Community Hub - repeated email delivery failures" `
  -Severity "ERROR" `
  -Conditions @((New-CountCondition -DisplayName "Three email-delivery failures in 15 minutes" -Metric "community_hub_email_failures" -Threshold 2 -Window "900s")) `
  -Documentation "High. Inspect provider status and sanitized email failure logs; pause outbound email and use the documented manual fallback if failures continue."

$policies += New-Policy `
  -DisplayName "Community Hub - cleanup failure" `
  -Severity "ERROR" `
  -Conditions @((New-CountCondition -DisplayName "Any export or retention cleanup failure" -Metric "community_hub_cleanup_failures" -Threshold 0 -Window "300s")) `
  -Documentation "High. Inspect the failed bounded job, retry safely, and verify private exports or retained registrations do not remain beyond policy."

$registrationAggregation = New-Aggregation -Period "600s" -Aligner "ALIGN_RATE" -Reducer "REDUCE_SUM"
$registrationFailureCondition = @{
  displayName = "Registration failures exceed 10 percent for ten minutes"
  conditionThreshold = @{
    filter = "metric.type=`"logging.googleapis.com/user/community_hub_registration_failures`" AND resource.type=`"cloud_run_revision`""
    denominatorFilter = "metric.type=`"logging.googleapis.com/user/community_hub_registration_attempts`" AND resource.type=`"cloud_run_revision`""
    aggregations = @($registrationAggregation)
    denominatorAggregations = @($registrationAggregation)
    comparison = "COMPARISON_GT"
    thresholdValue = 0.10
    duration = "600s"
    trigger = @{ count = 1 }
  }
}
$policies += New-Policy `
  -DisplayName "Community Hub - registration failure rate above 10 percent" `
  -Severity "ERROR" `
  -Conditions @($registrationFailureCondition) `
  -Documentation "High. Check configuration, capacity transactions, App Check, rate limiting, and Firestore availability before asking users to retry."

$policies += New-Policy `
  -DisplayName "Community Hub - application configuration failure" `
  -Severity "ERROR" `
  -Conditions @((New-CountCondition -DisplayName "Any post-deployment configuration validation failure" -Metric "community_hub_configuration_failures" -Threshold 0 -Window "60s")) `
  -Documentation "High. Keep the affected revision closed, verify Secret Manager bindings and required variables, and roll back if unresolved."

$policies += New-Policy `
  -DisplayName "Community Hub - Storage failure" `
  -Severity "ERROR" `
  -Conditions @((New-CountCondition -DisplayName "Any monitored Storage operation failure" -Metric "community_hub_storage_failures" -Threshold 0 -Window "300s")) `
  -Documentation "High. Verify bucket access, rules, service-account permissions, and flyer fallback behavior."

$latencyCondition = @{
  displayName = "p95 response latency above 2 seconds for ten minutes"
  conditionThreshold = @{
    filter = "metric.type=`"run.googleapis.com/request_latencies`" AND resource.type=`"cloud_run_revision`" AND resource.label.service_name=`"$backendService`""
    aggregations = @((New-Aggregation -Period "600s" -Aligner "ALIGN_PERCENTILE_95" -Reducer "REDUCE_MAX" -GroupBy @("resource.label.service_name")))
    comparison = "COMPARISON_GT"
    thresholdValue = 2000
    duration = "600s"
    trigger = @{ count = 1 }
  }
}
$policies += New-Policy `
  -DisplayName "Community Hub - response time above two seconds" `
  -Severity "WARNING" `
  -Conditions @($latencyCondition) `
  -Documentation "Warning. Inspect slow routes, Firestore reads, export work, and recent revisions; escalate if user workflows are impaired."

$policies += New-Policy `
  -DisplayName "Community Hub - unusual authorization or rate-limit volume" `
  -Severity "WARNING" `
  -Conditions @((New-CountCondition -DisplayName "More than 20 denials or rate-limit events in 15 minutes" -Metric "community_hub_authorization_or_rate_limit_events" -Threshold 20 -Window "900s")) `
  -Documentation "Warning. Inspect source patterns and affected routes without logging tokens, registration answers, or personal data."

$results = @()
foreach ($policy in $policies) {
  if ($existingDisplayNames -contains $policy.displayName) {
    $results += [pscustomobject]@{ DisplayName = $policy.displayName; Created = $false }
    continue
  }

  $body = $policy | ConvertTo-Json -Depth 20 -Compress
  try {
    $created = Invoke-RestMethod `
      -Method Post `
      -Headers $headers `
      -ContentType "application/json" `
      -Uri "https://monitoring.googleapis.com/v3/projects/$projectId/alertPolicies" `
      -Body $body
  } catch {
    $detail = $_.Exception.Message
    if ($_.Exception.Response) {
      $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
      $detail = $reader.ReadToEnd()
      $reader.Dispose()
    }
    throw "Unable to create '$($policy.displayName)': $detail"
  }
  $results += [pscustomobject]@{
    DisplayName = $created.displayName
    Created = $true
  }
}

$results | Format-Table -AutoSize
