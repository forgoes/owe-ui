import { Auth0Client } from "@auth0/nextjs-auth0/server";

const REQUIRED_AUTH0_ENV_KEYS = [
  "AUTH0_DOMAIN",
  "AUTH0_CLIENT_ID",
  "AUTH0_CLIENT_SECRET",
  "AUTH0_SECRET",
  "AUTH0_AUDIENCE",
  "APP_BASE_URL",
] as const;

let cachedClient: Auth0Client | null = null;

export function assertAuth0Configured() {
  const missing = REQUIRED_AUTH0_ENV_KEYS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required Auth0 configuration: ${missing.join(", ")}`);
  }
}

export function getAuth0Client() {
  assertAuth0Configured();

  if (cachedClient) {
    return cachedClient;
  }

  cachedClient = new Auth0Client({
    authorizationParameters: {
      audience: process.env.AUTH0_AUDIENCE,
      scope: "openid profile email",
    },
  });
  return cachedClient;
}
