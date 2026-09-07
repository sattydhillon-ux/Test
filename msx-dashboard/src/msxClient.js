/** Client for the live MSX (Dynamics 365) Web API.
 *
 * Uses the OAuth2 client-credentials flow (MSAL) against Azure AD, then
 * calls the Dynamics 365 Web API (OData v4) to look up an Account by its
 * TPID field and pull related Opportunities.
 *
 * NOTE: Field/entity names (msp_tpid, opportunity schema, etc.) are the
 * common Dynamics 365 defaults but MAY differ in your MSX environment.
 * Confirm the real schema names with your MSX admin and adjust the queries
 * below.
 */
const { ConfidentialClientApplication } = require("@azure/msal-node");
const settings = require("./config");

class MsxAuthError extends Error {}
class MsxApiError extends Error {}

let msalApp = null;
function getMsalApp() {
  if (!msalApp) {
    msalApp = new ConfidentialClientApplication({
      auth: {
        clientId: settings.clientId,
        authority: `https://login.microsoftonline.com/${settings.tenantId}`,
        clientSecret: settings.clientSecret,
      },
    });
  }
  return msalApp;
}

async function getAccessToken() {
  try {
    const result = await getMsalApp().acquireTokenByClientCredential({
      scopes: [`${settings.orgUrl}/.default`],
    });
    if (!result || !result.accessToken) {
      throw new MsxAuthError("Failed to acquire MSX access token");
    }
    return result.accessToken;
  } catch (err) {
    throw new MsxAuthError(err.message || "Failed to acquire MSX access token");
  }
}

async function apiGet(path, params) {
  const token = await getAccessToken();
  const url = new URL(`${settings.orgUrl}/api/data/v9.2/${path}`);
  Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "OData-MaxVersion": "4.0",
      "OData-Version": "4.0",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new MsxApiError(`MSX API error ${res.status}: ${body}`);
  }
  return res.json();
}

async function getLiveDashboard(tpid) {
  const accountFilter = `${settings.tpidField} eq '${tpid}'`;
  const accountData = await apiGet("accounts", {
    $filter: accountFilter,
    $select: `accountid,name,${settings.tpidField},industrycode,address1_city,address1_stateorprovince`,
  });
  const accounts = accountData.value || [];
  if (accounts.length === 0) {
    throw new MsxApiError(`No account found in MSX for TPID ${tpid}`);
  }
  const account = accounts[0];

  const oppData = await apiGet("opportunities", {
    $filter: `_parentaccountid_value eq ${account.accountid}`,
    $select: "name,estimatedvalue,estimatedclosedate,stepname,closeprobability",
  });

  return {
    account,
    revenue_by_year: [], // Populate from your MSX revenue/consumption entity
    opportunities: oppData.value || [],
    rob_summary: {}, // Populate from your MSX ROB/consumption summary entity
    source: "live",
  };
}

module.exports = { getLiveDashboard, MsxAuthError, MsxApiError };
