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

1. Get from your MSX admin / IT:
   - MSX org URL (e.g. `https://<org>.crm.dynamics.com`)
   - An Azure AD App Registration with the Dynamics CRM `user_impersonation`
     API permission → Tenant ID, Client ID, Client Secret
   - Confirmation of the TPID field's schema name on the Account entity
     (commonly `msp_tpid`, but may differ per environment)
2. Edit `.env`:
   ```
   MSX_MODE=live
   MSX_ORG_URL=https://<org>.crm.dynamics.com
   MSX_TENANT_ID=...
   MSX_CLIENT_ID=...
   MSX_CLIENT_SECRET=...
   MSX_TPID_FIELD=msp_tpid
   MSX_TARGET_TPID=5684700
   ```
3. Restart the server. The viewer UI needs no changes — it consumes
   `/api/dashboard` the same way in both modes.

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
