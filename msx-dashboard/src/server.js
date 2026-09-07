const path = require("path");
const express = require("express");
const settings = require("./config");
const { getMockDashboard } = require("./mockData");
const { getLiveDashboard, MsxAuthError, MsxApiError } = require("./msxClient");

const app = express();

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", mode: settings.mode });
});

app.get("/api/dashboard", async (req, res) => {
  const targetTpid = req.query.tpid || settings.targetTpid;

  if (!settings.isLive) {
    const data = getMockDashboard();
    data.account.msp_tpid = targetTpid;
    return res.json(data);
  }

  const missing = settings.validateLiveConfig();
  if (missing.length > 0) {
    return res.status(500).json({
      detail: `MSX_MODE=live but missing config: ${missing.join(", ")}`,
    });
  }

  try {
    const data = await getLiveDashboard(targetTpid);
    res.json(data);
  } catch (err) {
    if (err instanceof MsxAuthError) {
      return res.status(401).json({ detail: err.message });
    }
    if (err instanceof MsxApiError) {
      return res.status(502).json({ detail: err.message });
    }
    console.error(err);
    res.status(500).json({ detail: "Unexpected server error" });
  }
});

app.use(express.static(path.join(__dirname, "..", "static")));

const port = process.env.PORT || 8000;
app.listen(port, () => {
  console.log(`MSX dashboard running at http://127.0.0.1:${port} (mode: ${settings.mode})`);
});
