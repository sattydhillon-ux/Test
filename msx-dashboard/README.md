# MSX Account Dashboard — Alberta Health Services (TPID 5684700)

A small API + viewer that displays account, ROB (Run of Business), revenue,
and opportunity data for an MSX account, defaulting to Alberta Health
Services (TPID `5684700`).

Ships in **mock mode** out of the box so you can preview the viewer with
sample data immediately, with a **live mode** ready to connect to the real
MSX (Dynamics 365) Web API once you have credentials.

## Quick start (mock data)

```powershell
cd msx-dashboard
npm install
copy .env.example .env
npm start
```

Open http://127.0.0.1:8000 in your browser.

## Switching to live MSX data

Your MSX org URL and the account entity are already pre-filled based on the
Customer 360 view link you shared:
- Org URL: `https://microsoftsales.crm.dynamics.com`
- Entity: `msp_customer360s` (schema/field names are best-effort — confirm
  with your MSX admin and adjust `MSX_ENTITY_SET`/`MSX_TPID_FIELD` if needed)

1. Edit `.env`:
   ```
   MSX_MODE=live
   ```
   That's it for a first try — `MSX_AUTH_MODE=device_code` is the default,
   which signs in as **you** and needs no Azure AD app registration.
2. Run `npm start`, then open http://127.0.0.1:8000/api/dashboard?tpid=5684700
   (or the viewer). On first call, watch the **server console** — it prints
   something like:
   ```
   [MSX auth] To sign in, use a web browser to open the page
   https://microsoft.com/devicelogin and enter the code ABC-DEF-GHI to authenticate.
   ```
   Open that URL, enter the code, sign in with your Microsoft corporate
   account (MFA as usual). The token is cached in memory and silently
   refreshed until it expires — you'll be prompted again via the console
   when that happens.
3. If device-code sign-in is blocked in your tenant (conditional access
   policies, etc.), fall back to `client_credentials` mode instead:
   ```
   MSX_AUTH_MODE=client_credentials
   MSX_TENANT_ID=...
   MSX_CLIENT_ID=...
   MSX_CLIENT_SECRET=...
   ```
   (needs an admin to create an Azure AD app registration with API
   permission to this Dynamics instance).

The viewer UI needs no changes for either mode — it renders whatever fields
`/api/dashboard` returns, including any fields on the live record it doesn't
explicitly recognize yet (so nothing gets silently dropped while you confirm
the exact `msp_customer360` schema).

## Project layout

```
msx-dashboard/
  src/
    server.js       Express app + /api/dashboard, /api/health routes
    config.js       Loads settings from .env
    msxClient.js     Live MSX (Dynamics 365) Web API client (MSAL auth)
    mockData.js      Sample data for Alberta Health Services
  static/
    index.html, app.js, style.css   Viewer UI
  package.json
  .env.example
```

## Notes / limitations

- `msxClient.js` uses standard Dynamics 365 entity/field names as a
  starting point (`accounts`, `opportunities`, `_parentaccountid_value`,
  etc.). Your MSX environment may customize these — adjust the `$select`/
  `$filter` queries in `msxClient.js` once you can confirm the real schema.
- Revenue-by-year and ROB summary have no confirmed MSX entity mapped yet
  (`getLiveDashboard` returns them empty) — plug in the correct
  consumption/revenue entity once identified.
- Auth uses the client-credentials (service-to-service) flow. If your MSX
  access instead requires interactive/delegated sign-in (per-user MFA), the
  auth flow in `msxClient.js` will need to change to MSAL's interactive or
  device-code flow instead.
