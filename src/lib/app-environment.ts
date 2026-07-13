export const applicationEnvironments = ["development", "test", "staging", "production"] as const;

export type ApplicationEnvironment = (typeof applicationEnvironments)[number];

const productionHostnames = new Set([
  "findyourchurchpalacios.org",
  "www.findyourchurchpalacios.org",
]);

const knownProductionProjectIds = new Set([
  "findyourchurch-24562",
]);

function normalize(value?: string | null) {
  const trimmed = value?.trim().toLowerCase();
  return trimmed || undefined;
}

export function getApplicationEnvironment(): ApplicationEnvironment {
  const rawValue = normalize(process.env.APP_ENV ?? process.env.NEXT_PUBLIC_APP_ENV);

  if (rawValue && applicationEnvironments.includes(rawValue as ApplicationEnvironment)) {
    return rawValue as ApplicationEnvironment;
  }

  if (process.env.NODE_ENV === "production") {
    return "production";
  }

  if (process.env.NODE_ENV === "test") {
    return "test";
  }

  return "development";
}

export function isProductionAppEnvironment() {
  return getApplicationEnvironment() === "production";
}

export function getNonProductionEnvironmentLabel() {
  const environment = getApplicationEnvironment();
  return environment === "production" ? null : environment.toUpperCase();
}

export function getConfiguredProjectIds() {
  return [
    process.env.FIREBASE_PROJECT_ID,
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    process.env.GOOGLE_CLOUD_PROJECT,
    process.env.GCLOUD_PROJECT,
  ]
    .map(normalize)
    .filter((value): value is string => Boolean(value));
}

export function assertSafeNonProductionTarget(context: string) {
  const environment = getApplicationEnvironment();
  const projectIds = getConfiguredProjectIds();
  const explicitProductionProjectId = normalize(process.env.PRODUCTION_FIREBASE_PROJECT_ID);
  const productionProjectIds = explicitProductionProjectId
    ? new Set([...knownProductionProjectIds, explicitProductionProjectId])
    : knownProductionProjectIds;

  if (environment === "production") {
    throw new Error(`${context} refused to run because APP_ENV/NEXT_PUBLIC_APP_ENV is production.`);
  }

  const productionProject = projectIds.find((projectId) => productionProjectIds.has(projectId));
  if (productionProject) {
    throw new Error(`${context} refused to run against production Firebase project "${productionProject}".`);
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) {
    try {
      const hostname = new URL(siteUrl).hostname.toLowerCase();
      if (productionHostnames.has(hostname)) {
        throw new Error(`${context} refused to run with production site URL "${siteUrl}".`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("refused to run")) {
        throw error;
      }
    }
  }

  return {
    environment,
    projectIds,
  };
}
