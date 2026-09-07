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

async function getWhoAmI() {
  const result = await apiGet("WhoAmI()");
  return result.UserId;
}

/** Team IDs the given user is a member of. */
async function getUserTeamIds(userId) {
  const result = await apiGet(`systemusers(${userId})/teammembership_association`, {
    $select: "teamid",
  });
  return (result.value || []).map((t) => t.teamid);
}

/** All user IDs who are members of any of the given teams (excludes duplicates). */
async function getTeamMemberUserIds(teamIds) {
  const ids = new Set();
  for (const teamId of teamIds) {
    const result = await apiGet(`teams(${teamId})/teammembership_association`, {
      $select: "systemuserid",
    });
    (result.value || []).forEach((u) => ids.add(u.systemuserid));
  }
  return ids;
}

/** Opportunities for the account, bucketed into mine / my team's / highest value.
 * NOTE: opportunity entity/field names (parentaccountid, ownerid, estimatedvalue,
 * etc.) are the standard Dataverse "opportunity" schema — confirm with your MSX
 * admin if your org customizes them (see MSX_OPPORTUNITY_* env vars). */
async function getOpportunitiesForAccount(accountId) {
  const oppFilter = `_${settings.opportunityAccountLookupField}_value eq ${accountId} and statecode eq 0`;
  const oppData = await apiGet(settings.opportunityEntitySet, {
    $filter: oppFilter,
    $select: "name,estimatedvalue,estimatedclosedate,closeprobability,statuscode,_ownerid_value",
    $expand: "ownerid($select=fullname)",
    $orderby: "estimatedvalue desc",
  });
  const opportunities = (oppData.value || []).map((o) => ({
    name: o.name,
    estimated_value: o.estimatedvalue,
    close_date: o.estimatedclosedate,
    probability: o.closeprobability,
    stage: o["stepname"] || o.statuscode,
    owner_id: o._ownerid_value,
    owner_name: o["ownerid"] && o["ownerid"].fullname,
  }));

  let myUserId = null;
  let teamMemberIds = new Set();
  try {
    myUserId = await getWhoAmI();
    const teamIds = await getUserTeamIds(myUserId);
    teamMemberIds = await getTeamMemberUserIds(teamIds);
  } catch (err) {
    // If WhoAmI/team lookups fail (permissions, schema mismatch), still return
    // the highest-value bucket — just skip the mine/team buckets.
    console.error("Failed to resolve current user/team for opportunity buckets:", err.message);
  }

  const mine = myUserId ? opportunities.filter((o) => o.owner_id === myUserId) : [];
  const team = myUserId
    ? opportunities.filter((o) => o.owner_id !== myUserId && teamMemberIds.has(o.owner_id))
    : [];
  const highestValue = [...opportunities].sort((a, b) => (b.estimated_value || 0) - (a.estimated_value || 0));

  return { mine, team, highest_value: highestValue };
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

  let opportunitiesByOwner = { mine: [], team: [], highest_value: [] };
  const accountId = record[settings.opportunityAccountIdField];
  if (accountId) {
    try {
      opportunitiesByOwner = await getOpportunitiesForAccount(accountId);
    } catch (err) {
      console.error("Failed to fetch opportunities:", err.message);
    }
  }

  return {
    account: record,
    revenue_by_year: [], // Populate from your MSX revenue/consumption entity
    opportunities: [], // Populate from your MSX opportunity/pipeline entity, filtered by this account
    opportunities_by_owner: opportunitiesByOwner,
    rob_summary: {}, // Populate from your MSX ROB/consumption summary entity
    source: "live",
  };
}

module.exports = { getLiveDashboard, MsxAuthError, MsxApiError };
