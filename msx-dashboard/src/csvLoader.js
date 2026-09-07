/** Loads real AHS (TPID 5684700) data exported from MSX as CSV files.
 *
 * These CSVs live in a gitignored local folder (never committed — see
 * .gitignore) because they're classified "Highly Confidential - Microsoft
 * FTE". This loader reads them at request time; nothing is embedded in
 * source code or persisted anywhere else.
 */
const fs = require("fs");
const path = require("path");
const settings = require("./config");

/** Minimal CSV line parser supporting quoted fields containing commas. */
function parseCsvLine(line) {
  const fields = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      fields.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  fields.push(cur);
  return fields;
}

/** Reads a CSV export, skipping the confidentiality-notice preamble lines
 * before the real header row, and returns objects keyed by header. */
function readCsvRecords(fileName, headerLineIndex) {
  const filePath = path.join(settings.csvDataDir, fileName);
  if (!fs.existsSync(filePath)) return [];

  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/).filter((l) => l.length > 0);
  const header = parseCsvLine(lines[headerLineIndex]).map((h) => h.trim());
  const records = [];
  for (let i = headerLineIndex + 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length < 2) continue;
    const record = {};
    header.forEach((h, idx) => {
      record[h] = values[idx];
    });
    records.push(record);
  }
  return records;
}

function toNumber(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function formatMonth(yyyymmdd) {
  if (!yyyymmdd || yyyymmdd.length < 6) return yyyymmdd;
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}`;
}

function getMonthlyRevenue() {
  const rows = readCsvRecords("monthly_revenue.csv", 3);
  const byMonth = new Map();
  for (const r of rows) {
    const month = formatMonth(r["Month"]);
    byMonth.set(month, (byMonth.get(month) || 0) + toNumber(r["ACR"]));
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, acr]) => ({ month, acr: Math.round(acr * 100) / 100 }));
}

function getTopServices(limit = 15) {
  const rows = readCsvRecords("service_level_acr.csv", 3);
  if (rows.length === 0) return [];

  // Column headers embed a date range that changes per export
  // (e.g. "MoM (Jul 2026 - Aug 2026)"), so match by prefix instead of exact name.
  const keys = Object.keys(rows[0]);
  const totalAcrKey = keys.find((k) => k.startsWith("Total ACR"));
  const lastMonthKey = keys.find((k) => k.startsWith("Last Month ACR"));
  const momKey = keys.find((k) => k.startsWith("MoM"));
  const qoqKey = keys.find((k) => k.startsWith("QoQ"));
  const yoyKey = keys.find((k) => k.startsWith("YoY"));

  return rows
    .map((r) => ({
      service: r["Service or FRA group"],
      total_acr: toNumber(r[totalAcrKey]),
      last_month_acr: toNumber(r[lastMonthKey]),
      mom_pct: toNumber(r[momKey]),
      qoq_pct: toNumber(r[qoqKey]),
      yoy_pct: toNumber(r[yoyKey]),
    }))
    .filter((r) => r.service)
    .sort((a, b) => b.total_acr - a.total_acr)
    .slice(0, limit);
}

function getSubscriptionsSummary() {
  const rows = readCsvRecords("subscriptions.csv", 3);
  const statusCounts = {};
  let totalConsumptionUnits = 0;
  for (const r of rows) {
    const status = r["Status"] || "UNKNOWN";
    statusCounts[status] = (statusCounts[status] || 0) + 1;
    totalConsumptionUnits += toNumber(r["Consumption units"]);
  }
  const topSubscriptions = rows
    .map((r) => ({
      name: r["Subscription name"],
      status: r["Status"],
      workload_type: r["Workload type"],
      consumption_units: toNumber(r["Consumption units"]),
    }))
    .sort((a, b) => b.consumption_units - a.consumption_units)
    .slice(0, 10);

  return {
    total: rows.length,
    status_counts: statusCounts,
    total_consumption_units: Math.round(totalConsumptionUnits * 100) / 100,
    top_subscriptions: topSubscriptions,
  };
}

function getRecommendations() {
  const ri = readCsvRecords("ri_recommendations.csv", 4).map((r) => ({
    type: "Reserved Instance",
    description: `${r["RI Type"] || ""} (${r["SKU"] || ""})${r["Region"] && r["Region"] !== "All" ? " — " + r["Region"] : ""}`,
    term: r["Term"],
    net_savings: toNumber(r["RI - Net savings (3 year)"]),
    net_savings_pct: toNumber(r["RI - Net savings %"]),
    currency: r["Currency"],
  }));

  const sp = readCsvRecords("savings_plan_recommendations.csv", 3).map((r) => ({
    type: "Savings Plan",
    description: r["Savings plan type"] || "Savings Plan",
    term: r["Term"],
    net_savings: toNumber(r["Net savings"]),
    net_savings_pct: null,
    currency: r["Currency"],
  }));

  return [...ri, ...sp].sort((a, b) => b.net_savings - a.net_savings);
}

function getDashboard(tpid) {
  const monthlyRevenue = getMonthlyRevenue();
  const lastMonth = monthlyRevenue[monthlyRevenue.length - 1];
  const yearAgoIndex = monthlyRevenue.length - 13;
  const yearAgo = yearAgoIndex >= 0 ? monthlyRevenue[yearAgoIndex] : null;
  const last12 = monthlyRevenue.slice(-12);
  const totalTtm = last12.reduce((sum, m) => sum + m.acr, 0);
  const yoyGrowthPct = yearAgo && yearAgo.acr ? ((lastMonth.acr - yearAgo.acr) / yearAgo.acr) * 100 : null;

  const recommendations = getRecommendations();
  const totalPotentialSavings = recommendations.reduce((sum, r) => sum + r.net_savings, 0);

  return {
    account: {
      name: "Alberta Health Services",
      msp_tpid: tpid,
      segment: "Public Sector - Health",
      region: "Canada",
      data_as_of: lastMonth ? lastMonth.month : null,
    },
    revenue_by_month: monthlyRevenue,
    top_services: getTopServices(),
    subscriptions_summary: getSubscriptionsSummary(),
    recommendations,
    rob_summary: {
      last_month_acr: lastMonth ? lastMonth.acr : null,
      ttm_acr: Math.round(totalTtm * 100) / 100,
      yoy_growth_pct: yoyGrowthPct !== null ? Math.round(yoyGrowthPct * 100) / 100 : null,
      total_potential_savings: Math.round(totalPotentialSavings * 100) / 100,
    },
    source: "csv",
  };
}

module.exports = { getDashboard };
