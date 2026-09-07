/** Client for the live MSX (Dynamics 365 / Dataverse) Web API.
 *
 * Supports two auth modes (see MSX_AUTH_MODE in .env):
 *
 *  - "device_code" (default): delegated sign-in as you. No Azure AD app
 *    registration needed — on first API call the server prints a URL + code
 *    to its console; open the URL, enter the code, sign in with your
 *    Microsoft corporate account. The token is cached in memory and reused
 *    (silently refreshed) until it expires, at which point you'll be
 *    prompted again via the console.
 *
 *  - "client_credentials": service-to-service auth using a full Azure AD
 *    app registration (Client ID/Secret). Needs an admin to set that up.
 *
 * NOTE: Entity/field names (msp_customer360, msp_tpid, opportunity schema,
 * etc.) are best-effort based on the MSX Customer 360 view URL you shared.
 * Confirm exact field schema names (Settings > Customizations, or ask your
 * MSX admin) and adjust the queries below if needed.
 */
const { PublicClientApplication, ConfidentialClientApplication } = require("@azure/msal-node");
const settings = require("./config");

class MsxAuthError extends Error {}
class MsxApiError extends Error {}

let confidentialApp = null;
function getConfidentialApp() {
  if (!confidentialApp) {
    confidentialApp = new ConfidentialClientApplication({
      auth: {
        clientId: settings.clientId,
        authority: `https://login.microsoftonline.com/${settings.tenantId}`,
        clientSecret: settings.clientSecret,
      },
    });
  }
  return confidentialApp;
}

let publicApp = null;
function getPublicApp() {
  if (!publicApp) {
    publicApp = new PublicClientApplication({
      auth: {
        clientId: settings.clientId,
        authority: `https://login.microsoftonline.com/${settings.tenantId}`,
      },
    });
  }
  return publicApp;
}

// In-memory cache of the signed-in account, so we can try a silent token
// refresh before falling back to a fresh device-code prompt.
let cachedAccount = null;

// If a device-code sign-in is already in progress, concurrent callers must
// await THIS SAME promise instead of starting their own flow — otherwise
// each concurrent request mints a new code and invalidates the previous one
// before the user can finish signing in with it.
let inFlightDeviceCodeSignIn = null;

async function getAccessTokenDeviceCode() {
  const app = getPublicApp();
  const scopes = [`${settings.orgUrl}/.default`];

  if (cachedAccount) {
    try {
      const silent = await app.acquireTokenSilent({ account: cachedAccount, scopes });
      return silent.accessToken;
    } catch {
      // Silent refresh failed (expired/revoked) — fall through to device code.
      cachedAccount = null;
    }
  }

  if (inFlightDeviceCodeSignIn) {
    return inFlightDeviceCodeSignIn;
  }

  inFlightDeviceCodeSignIn = (async () => {
    try {
      const result = await app.acquireTokenByDeviceCode({
        scopes,
        deviceCodeCallback: (response) => {
          // eslint-disable-next-line no-console
          console.log(`\n[MSX auth] ${response.message}\n`);
        },
      });
      cachedAccount = result.account;
      return result.accessToken;
    } catch (err) {
      throw new MsxAuthError(err.message || "Device code sign-in failed");
    } finally {
      inFlightDeviceCodeSignIn = null;
    }
  })();

  return inFlightDeviceCodeSignIn;
}

async function getAccessTokenClientCredentials() {
  try {
    const result = await getConfidentialApp().acquireTokenByClientCredential({
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

function getAccessToken() {
  return settings.isDeviceCode ? getAccessTokenDeviceCode() : getAccessTokenClientCredentials();
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
  const filter = `${settings.tpidField} eq '${tpid}'`;
  const customerData = await apiGet(settings.entitySetName, {
    $filter: filter,
  });
  const records = customerData.value || [];
  if (records.length === 0) {
    throw new MsxApiError(
      `No record found in MSX entity "${settings.entitySetName}" for TPID ${tpid}. ` +
        `Confirm the entity set name and field ${settings.tpidField} with your MSX admin.`
    );
  }
  const record = records[0];

  return {
    account: record,
    revenue_by_year: [], // Populate from your MSX revenue/consumption entity
    opportunities: [], // Populate from your MSX opportunity/pipeline entity, filtered by this account
    rob_summary: {}, // Populate from your MSX ROB/consumption summary entity
    source: "live",
  };
}

module.exports = { getLiveDashboard, MsxAuthError, MsxApiError };
