import { getApplicationEnvironment, getConfiguredProjectIds } from "@/lib/app-environment";
import { getSiteUrl } from "@/lib/config/site";
import {
  getConfiguredEmailProvider,
  getEmailConfigurationProblems,
} from "@/lib/services/email-service";

function isProductionEnvironment() {
  return getApplicationEnvironment() === "production";
}

export type ConfigCheckStatus = "pass" | "warn" | "fail";

export interface ConfigCheckResult {
  key: string;
  label: string;
  status: ConfigCheckStatus;
  scope: "required" | "recommended" | "optional" | "development";
  message: string;
}

function hasEnv(name: string) {
  return Boolean(process.env[name]?.trim());
}

function checkEnv(name: string, label: string, scope: ConfigCheckResult["scope"], productionRequired = false): ConfigCheckResult {
  const exists = hasEnv(name);
  const status: ConfigCheckStatus = exists ? "pass" : productionRequired && isProductionEnvironment() ? "fail" : scope === "required" ? "warn" : "warn";
  return {
    key: name,
    label,
    scope,
    status,
    message: exists ? "Configured." : "Missing or blank. Secret values are not printed.",
  };
}

export function getProductionConfigurationReport(): ConfigCheckResult[] {
  const siteUrl = getSiteUrl();
  const appEnvironment = getApplicationEnvironment();
  const configuredProjectIds = getConfiguredProjectIds();
  const emailProvider = getConfiguredEmailProvider();
  const checks: ConfigCheckResult[] = [
    checkEnv("APP_ENV", "Application environment", "required", true),
    checkEnv("NEXT_PUBLIC_SITE_URL", "Public site URL / canonical host", "required", true),
    checkEnv("NEXT_PUBLIC_FIREBASE_API_KEY", "Firebase client API key", "required", true),
    checkEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "Firebase Auth domain", "required", true),
    checkEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "Firebase client project ID", "required", true),
    checkEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", "Firebase client Storage bucket", "required", true),
    checkEnv("NEXT_PUBLIC_FIREBASE_APP_ID", "Firebase app ID", "required", true),
    checkEnv("FIREBASE_PROJECT_ID", "Firebase Admin project ID", "required", true),
    checkEnv("FIREBASE_STORAGE_BUCKET", "Firebase Admin Storage bucket", "required", true),
    checkEnv("EMAIL_PROVIDER", "Email provider", "required", true),
    checkEnv("EMAIL_FROM", "Email sender", "required", true),
    checkEnv("ADMIN_NOTIFICATION_EMAIL", "Admin notification recipients", "required", true),
    checkEnv("REGISTRATION_TOKEN_SECRET", "Registration token secret", "required", true),
    checkEnv("REGISTRATION_JOBS_CRON_SECRET", "Registration scheduler secret", "required", true),
    checkEnv("LISTING_VERIFICATION_CRON_SECRET", "Listing verification scheduler secret", "recommended"),
    checkEnv("SMTP_REPLY_TO", "SMTP reply-to address", "recommended"),
    checkEnv("EXPORT_SIGNING_SECRET", "Export signing or revocation secret", "recommended"),
    checkEnv("RETENTION_JOB_ENABLED", "Registration retention cleanup flag", "recommended"),
    checkEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "Analytics measurement ID", "optional"),
    checkEnv("NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION", "Google Search Console verification", "optional"),
    checkEnv("ERROR_MONITORING_DSN", "Error monitoring DSN", "recommended"),
    checkEnv("APP_CHECK_SITE_KEY", "Firebase App Check site key", "recommended"),
  ];

  if (process.env.NEXT_PUBLIC_APP_ENV && process.env.NEXT_PUBLIC_APP_ENV !== appEnvironment) {
    checks.push({
      key: "NEXT_PUBLIC_APP_ENV",
      label: "Public application environment",
      scope: "recommended",
      status: "warn",
      message: "NEXT_PUBLIC_APP_ENV does not match APP_ENV.",
    });
  }

  if (appEnvironment === "staging") {
    checks.push({
      key: "APP_ENV",
      label: "Staging environment mode",
      scope: "required",
      status: "pass",
      message: "Staging mode is active. Admin users should see a nonproduction banner.",
    });
  }

  if (siteUrl.startsWith("http://") && isProductionEnvironment()) {
    checks.push({
      key: "NEXT_PUBLIC_SITE_URL",
      label: "HTTPS canonical host",
      scope: "required",
      status: "fail",
      message: "Production canonical URLs must use HTTPS.",
    });
  }

  if (
    appEnvironment === "staging" &&
    configuredProjectIds.some((projectId) => projectId === "findyourchurch-24562")
  ) {
    checks.push({
      key: "FIREBASE_PROJECT_ID",
      label: "Staging Firebase project",
      scope: "required",
      status: "fail",
      message: "Staging must not point at the known production Firebase project.",
    });
  }

  if (emailProvider === "smtp") {
    checks.push(
      checkEnv("SMTP_HOST", "SMTP host", "required", true),
      checkEnv("SMTP_PORT", "SMTP port", "required", true),
      checkEnv("SMTP_USER", "SMTP user", "required", true),
      checkEnv("SMTP_PASSWORD", "SMTP password", "required", true),
    );

    if (appEnvironment === "staging") {
      checks.push(
        checkEnv("TEST_EMAIL_TO", "Approved staging email test recipient", "required", true),
        checkEnv("ALLOW_REAL_EMAIL_TEST", "Staging email send approval flag", "required", true),
      );
    }
  }

  const emailConfigurationProblems = getEmailConfigurationProblems(emailProvider);
  checks.push({
    key: "EMAIL_CONFIGURATION",
    label: "Email configuration validation",
    scope: "required",
    status: emailConfigurationProblems.length === 0 ? "pass" : "fail",
    message: emailConfigurationProblems.length === 0
      ? "Provider, sender, reply-to, administrator, and delivery settings are valid."
      : emailConfigurationProblems.join(" Secret values are not printed. "),
  });

  if (emailProvider === "console" && isProductionEnvironment()) {
    checks.push({
      key: "EMAIL_PROVIDER",
      label: "Production email provider",
      scope: "required",
      status: "fail",
      message: "Production must not use EMAIL_PROVIDER=console.",
    });
  }

  return checks;
}

export function getProductionConfigurationSummary() {
  const checks = getProductionConfigurationReport();
  return {
    checks,
    failed: checks.filter((check) => check.status === "fail").length,
    warnings: checks.filter((check) => check.status === "warn").length,
    passed: checks.filter((check) => check.status === "pass").length,
  };
}
