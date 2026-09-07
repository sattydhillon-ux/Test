require("dotenv").config();

const settings = {
  mode: (process.env.MSX_MODE || "mock").toLowerCase(),
  orgUrl: (process.env.MSX_ORG_URL || "").replace(/\/$/, ""),
  tenantId: process.env.MSX_TENANT_ID || "",
  clientId: process.env.MSX_CLIENT_ID || "",
  clientSecret: process.env.MSX_CLIENT_SECRET || "",
  tpidField: process.env.MSX_TPID_FIELD || "msp_tpid",
  targetTpid: process.env.MSX_TARGET_TPID || "5684700",

  get isLive() {
    return this.mode === "live";
  },

  /** Returns a list of missing env vars required for live mode. */
  validateLiveConfig() {
    const missing = [];
    if (!this.orgUrl) missing.push("MSX_ORG_URL");
    if (!this.tenantId) missing.push("MSX_TENANT_ID");
    if (!this.clientId) missing.push("MSX_CLIENT_ID");
    if (!this.clientSecret) missing.push("MSX_CLIENT_SECRET");
    return missing;
  },
};

module.exports = settings;
