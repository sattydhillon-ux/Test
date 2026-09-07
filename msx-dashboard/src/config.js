require("dotenv").config();

// Microsoft's own multi-tenant "Microsoft Azure PowerShell" first-party app.
// It's pre-consented in virtually every Microsoft Entra tenant, which lets
// device-code (delegated) sign-in work against most internal APIs, incl.
// Dataverse/Dynamics, without registering your own Azure AD app first.
// If your tenant blocks it (conditional access, etc.), set MSX_CLIENT_ID to
// a public client app your MSX admin registers/allows instead.
const DEFAULT_DEVICE_CODE_CLIENT_ID = "1950a258-227b-4e31-a9cf-717495945fc2";

const settings = {
  mode: (process.env.MSX_MODE || "mock").toLowerCase(),
  orgUrl: (process.env.MSX_ORG_URL || "https://microsoftsales.crm.dynamics.com").replace(/\/$/, ""),

  // "device_code" = delegated sign-in as you, no app registration needed (default).
  // "client_credentials" = service-to-service, needs a full Azure AD app registration + secret.
  authMode: (process.env.MSX_AUTH_MODE || "device_code").toLowerCase(),

  tenantId: process.env.MSX_TENANT_ID || "organizations",
  clientId: process.env.MSX_CLIENT_ID || DEFAULT_DEVICE_CODE_CLIENT_ID,
  clientSecret: process.env.MSX_CLIENT_SECRET || "",

  // Confirmed from the MSX Customer 360 view URL: entity is msp_customer360.
  entitySetName: process.env.MSX_ENTITY_SET || "msp_customer360s",
  tpidField: process.env.MSX_TPID_FIELD || "msp_tpid",
  targetTpid: process.env.MSX_TARGET_TPID || "5684700",

  // Opportunity entity/fields — unconfirmed schema guesses (standard Dataverse
  // "opportunity" entity). Adjust if your MSX org customizes these.
  opportunityEntitySet: process.env.MSX_OPPORTUNITY_ENTITY_SET || "opportunities",
  opportunityAccountLookupField: process.env.MSX_OPPORTUNITY_ACCOUNT_FIELD || "parentaccountid",
  opportunityAccountIdField: process.env.MSX_ACCOUNT_ID_FIELD || "accountid",

  // "csv" mode: read real exported MSX CSVs from a local (gitignored) folder
  // instead of calling any API. See data/ahs-5684700/README or .gitignore.
  csvDataDir: process.env.MSX_CSV_DATA_DIR || require("path").join(__dirname, "..", "data", "ahs-5684700"),

  // Used in csv mode to split the exported "account team" opportunities into
  // "mine" vs "team" for the Opportunities tabs. Matches the "Owner" column
  // in MSX opportunity exports.
  currentUserName: process.env.MSX_USER_NAME || "Satty Dhillon",

  get isLive() {
    return this.mode === "live";
  },
  get isCsv() {
    return this.mode === "csv";
  },
  get isDeviceCode() {
    return this.authMode === "device_code";
  },

  /** Returns a list of missing env vars required for live mode. */
  validateLiveConfig() {
    const missing = [];
    if (!this.orgUrl) missing.push("MSX_ORG_URL");
    if (this.isDeviceCode) {
      // clientId has a usable default; tenantId defaults to "organizations".
      return missing;
    }
    if (!this.tenantId) missing.push("MSX_TENANT_ID");
    if (!this.clientId) missing.push("MSX_CLIENT_ID");
    if (!this.clientSecret) missing.push("MSX_CLIENT_SECRET");
    return missing;
  },
};

module.exports = settings;
