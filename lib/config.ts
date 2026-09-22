// Server-side settings read from the environment. Never import this from a client component.
export const config = {
  engineUrl: (process.env.ENGINE_URL ?? "http://127.0.0.1:8088").replace(/\/$/, ""),
  engineApiKey: process.env.ENGINE_API_KEY ?? "",
  appUrl: (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  // Development only: lets clients monitor loopback / private addresses.
  allowPrivateTargets: process.env.ALLOW_PRIVATE_TARGETS === "true",
  // Optional: set REQUIRE_ADMIN_MFA=true to force admins to set up an authenticator app before they can use the dashboard.
  // Off by default: sign-in uses email + password, with Clerk's email code on a new device.
  requireAdminMfa: process.env.REQUIRE_ADMIN_MFA === "true",
  // Optional: where the "Customer support" button in the top bar goes (a mailto:, WhatsApp or help-desk link). Hidden when empty.
  supportUrl: process.env.SUPPORT_URL ?? "",
  // Optional: turns on the AI analysis in the incident detail sheet. GEMINI_MODEL picks the model.
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-3.6-flash",
};

// Safety caps that are not part of any plan (they only stop runaway usage).
export const LIMITS = {
  alertRulesPerOrg: 500,
  channelsPerOrg: 20,
  credentialsPerOrg: 100,
  maxMonthsPerPayment: 36,
};
