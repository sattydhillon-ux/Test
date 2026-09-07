const params = new URLSearchParams(window.location.search);
const tpid = params.get("tpid") || "5684700";

async function loadDashboard() {
  try {
    const res = await fetch(`/api/dashboard?tpid=${encodeURIComponent(tpid)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Request failed (${res.status})`);
    }
    const data = await res.json();
    render(data);
  } catch (e) {
    document.querySelector("main").innerHTML = `<div class="error">Failed to load dashboard: ${e.message}</div>`;
  }
}

function render(data) {
  const { source } = data;
  const badge = document.getElementById("mode-badge");
  badge.textContent = source === "live" ? "Live MSX Data" : source === "csv" ? "Real Export (CSV)" : "Mock Data";

  if (source === "csv") {
    renderCsvDashboard(data);
  } else {
    renderMockOrLiveDashboard(data);
  }
}

function toggle(id, show) {
  document.getElementById(id).style.display = show ? "" : "none";
}

function renderCsvDashboard(data) {
  const { account, revenue_by_month, top_services, subscriptions_summary, recommendations, rob_summary } = data;

  document.getElementById("account-name").textContent = account.name || "Unknown Account";

  const details = document.getElementById("account-details");
  const fields = [
    ["TPID", account.msp_tpid],
    ["Segment", account.segment],
    ["Region", account.region],
    ["Data as of", account.data_as_of],
  ].filter(([, v]) => v);
  details.innerHTML = fields.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");

  const stats = document.getElementById("rob-stats");
  const statFields = [
    ["Last Month ACR", formatCurrency(rob_summary.last_month_acr)],
    ["TTM ACR", formatCurrency(rob_summary.ttm_acr)],
    ["YoY Growth", rob_summary.yoy_growth_pct !== null ? `${rob_summary.yoy_growth_pct}%` : "N/A"],
    ["Potential Savings (3yr)", formatCurrency(rob_summary.total_potential_savings)],
  ];
  stats.innerHTML = statFields.map(([label, value]) =>
    `<div class="stat"><div class="value">${value}</div><div class="label">${label}</div></div>`).join("");

  document.getElementById("revenue-card-title").textContent = "Monthly Azure Consumed Revenue (ACR)";
  document.getElementById("revenue-table-head").innerHTML = "<th>Month</th><th>ACR</th>";
  const revBody = document.querySelector("#revenue-table tbody");
  revBody.innerHTML = (revenue_by_month || []).map(r => `
    <tr><td>${r.month}</td><td>${formatCurrency(r.acr)}</td></tr>`).join("") ||
    `<tr><td colspan="2">No revenue data available.</td></tr>`;

  toggle("opportunities-card", false);

  toggle("services-card", true);
  const svcBody = document.querySelector("#services-table tbody");
  svcBody.innerHTML = (top_services || []).map(s => `
    <tr>
      <td>${s.service}</td>
      <td>${formatCurrency(s.total_acr)}</td>
      <td>${formatCurrency(s.last_month_acr)}</td>
      <td>${s.mom_pct}%</td>
      <td>${s.qoq_pct}%</td>
      <td>${s.yoy_pct}%</td>
    </tr>`).join("") || `<tr><td colspan="6">No service data available.</td></tr>`;

  toggle("subscriptions-card", true);
  const subStats = document.getElementById("subscriptions-stats");
  const statusEntries = Object.entries(subscriptions_summary.status_counts || {});
  subStats.innerHTML = [
    ["Total Subscriptions", subscriptions_summary.total],
    ...statusEntries.map(([status, count]) => [status, count]),
  ].map(([label, value]) => `<div class="stat"><div class="value">${value}</div><div class="label">${label}</div></div>`).join("");

  const subBody = document.querySelector("#subscriptions-table tbody");
  subBody.innerHTML = (subscriptions_summary.top_subscriptions || []).map(s => `
    <tr>
      <td>${s.name}</td>
      <td>${s.status}</td>
      <td>${s.workload_type}</td>
      <td>${Number(s.consumption_units).toLocaleString()}</td>
    </tr>`).join("") || `<tr><td colspan="4">No subscription data available.</td></tr>`;

  toggle("recommendations-card", true);
  const recBody = document.querySelector("#recommendations-table tbody");
  recBody.innerHTML = (recommendations || []).map(r => `
    <tr>
      <td>${r.type}</td>
      <td>${r.description}</td>
      <td>${r.term || ""}</td>
      <td>${formatCurrency(r.net_savings, r.currency)}</td>
      <td>${r.net_savings_pct !== null && r.net_savings_pct !== undefined ? r.net_savings_pct + "%" : ""}</td>
    </tr>`).join("") || `<tr><td colspan="5">No recommendations available.</td></tr>`;

  if (data.azure_forecast) {
    toggle("forecast-card", true);
    renderAzureForecast(data.azure_forecast);
  }

  if (data.service_trends) {
    toggle("trends-card", true);
    renderServiceTrends(data.service_trends);
  }
}

let forecastChart = null;
let forecastState = null;

function renderAzureForecast(forecast) {
  forecastState = forecast;
  document.getElementById("forecast-note").textContent =
    `${forecast.source_note} Updated ${forecast.updated_as_of}.`;

  document.querySelectorAll("#forecast-tabs .tab-btn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll("#forecast-tabs .tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      drawForecastChart(btn.dataset.series);
    };
  });

  drawForecastChart("consumption_revenue");
}

function drawForecastChart(seriesKey) {
  const series = forecastState[seriesKey] || [];
  const forecastStart = series.findIndex(p => p.is_forecast);
  const historical = series.map(p => (p.is_forecast ? null : p.value));
  const forecastPts = series.map((p, i) => (p.is_forecast || i === forecastStart - 1 ? p.value : null));
  const isRevenue = seriesKey === "consumption_revenue";

  const ctx = document.getElementById("forecast-chart").getContext("2d");
  if (forecastChart) forecastChart.destroy();
  forecastChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: series.map(p => p.month),
      datasets: [
        {
          label: isRevenue ? "Historical ACR (no adjustments)" : "Historical CU (no adjustments)",
          data: historical,
          borderColor: isRevenue ? "#0a2f66" : "#1e5c1e",
          backgroundColor: "transparent",
          spanGaps: false,
          pointRadius: 2,
          tension: 0.25,
        },
        {
          label: "Machine learning forecast",
          data: forecastPts,
          borderColor: isRevenue ? "#5b9bd5" : "#7fbf7f",
          backgroundColor: "transparent",
          spanGaps: false,
          pointRadius: 2,
          tension: 0.25,
        },
      ],
    },
    options: {
      responsive: true,
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { position: "bottom" } },
      scales: {
        y: {
          ticks: {
            callback: v => (isRevenue ? formatCurrency(v) : Number(v).toLocaleString()),
          },
        },
      },
    },
  });
}

function formatCurrency(value, currency) {
  if (value === null || value === undefined) return "N/A";
  const prefix = currency && currency !== "CAD" ? `${currency} ` : "$";
  return `${prefix}${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function renderMockOrLiveDashboard(data) {
  const { account, revenue_by_year, opportunities, rob_summary, source } = data;

  toggle("services-card", false);
  toggle("subscriptions-card", false);
  toggle("recommendations-card", false);
  toggle("opportunities-card", true);
  document.getElementById("revenue-card-title").textContent = "Revenue by Fiscal Year";
  document.getElementById("revenue-table-head").innerHTML =
    "<th>Fiscal Year</th><th>Actual ($M)</th><th>Target ($M)</th><th>Attainment</th>";

  const displayName =
    account.name || account.msp_name || account.msp_customer360name || guessNameField(account) || "Unknown Account";
  document.getElementById("account-name").textContent = displayName;

  const details = document.getElementById("account-details");
  const knownFields = [
    ["TPID", account.msp_tpid || account.tpid],
    ["Industry", account.industry || account.industrycode],
    ["Segment", account.segment],
    ["Region", account.region],
    ["City", account.city || account.address1_city],
    ["State/Province", account.state || account.address1_stateorprovince],
    ["Account Owner", account.account_owner],
  ].filter(([, v]) => v !== undefined && v !== null && v !== "");

  // Live mode: the real msp_customer360 schema is unconfirmed, so also show
  // any other non-empty, non-system fields we didn't already map above,
  // instead of silently dropping data we don't recognize yet.
  const knownKeys = new Set(["name", "msp_tpid", "tpid", "industry", "industrycode", "segment", "region", "city",
    "address1_city", "state", "address1_stateorprovince", "account_owner"]);
  const extraFields = source === "live"
    ? Object.entries(account)
        .filter(([k, v]) => !knownKeys.has(k) && !k.startsWith("_") && !k.endsWith("@odata.type") &&
          v !== null && v !== undefined && v !== "" && typeof v !== "object")
    : [];

  details.innerHTML = [...knownFields, ...extraFields]
    .map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`)
    .join("");

  const stats = document.getElementById("rob-stats");
  const statFields = [
    ["Consumed Revenue (TTM, $M)", rob_summary.consumed_revenue_ttm],
    ["Target (TTM, $M)", rob_summary.target_ttm],
    ["Attainment %", rob_summary.attainment_pct],
    ["Pipeline Coverage", rob_summary.pipeline_coverage],
  ].filter(([, v]) => v !== undefined && v !== null);
  stats.innerHTML = statFields.length
    ? statFields.map(([label, value]) => `<div class="stat"><div class="value">${value}</div><div class="label">${label}</div></div>`).join("")
    : `<div class="label">No ROB summary data available.</div>`;

  const revBody = document.querySelector("#revenue-table tbody");
  revBody.innerHTML = (revenue_by_year || []).map(r => `
    <tr>
      <td>${r.fiscal_year}</td>
      <td>${r.actual}</td>
      <td>${r.target}</td>
      <td>${((r.actual / r.target) * 100).toFixed(1)}%</td>
    </tr>`).join("") || `<tr><td colspan="4">No revenue data available.</td></tr>`;

  const oppBody = document.querySelector("#opportunities-table tbody");
  oppBody.innerHTML = (opportunities || []).map(o => `
    <tr>
      <td>${o.name}</td>
      <td>${o.stage || o.stepname || ""}</td>
      <td>$${Number(o.estimated_value ?? o.estimatedvalue ?? 0).toLocaleString()}</td>
      <td>${o.close_date || o.estimatedclosedate || ""}</td>
      <td>${o.probability ?? o.closeprobability ?? ""}${(o.probability ?? o.closeprobability) !== undefined ? "%" : ""}</td>
    </tr>`).join("") || `<tr><td colspan="5">No open opportunities found.</td></tr>`;
}

let trendsState = null;

function renderServiceTrends(trends) {
  trendsState = trends;
  document.querySelectorAll("#trends-tabs .tab-btn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll("#trends-tabs .tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      drawTrendsTable(btn.dataset.bucket);
    };
  });
  drawTrendsTable("going_up");
}

function drawTrendsTable(bucket) {
  const rows = trendsState[bucket] || [];
  const head = document.getElementById("trends-table-head");
  const body = document.querySelector("#trends-table tbody");

  if (bucket === "not_used") {
    head.innerHTML = "<th>Service</th><th>Total ACR (historical)</th><th>Last Month ACR</th>";
    body.innerHTML = rows.map(s => `
      <tr><td>${s.service}</td><td>${formatCurrency(s.total_acr)}</td><td>${formatCurrency(s.last_month_acr)}</td></tr>`
    ).join("") || `<tr><td colspan="3">No services found in this category.</td></tr>`;
    return;
  }

  head.innerHTML = "<th>Service</th><th>Last Month ACR</th><th>MoM %</th><th>QoQ %</th><th>YoY %</th>";
  body.innerHTML = rows.map(s => `
    <tr>
      <td>${s.service}</td>
      <td>${formatCurrency(s.last_month_acr)}</td>
      <td>${s.mom_pct}%</td>
      <td>${s.qoq_pct}%</td>
      <td>${s.yoy_pct}%</td>
    </tr>`).join("") || `<tr><td colspan="5">No services found in this category.</td></tr>`;
}

function guessNameField(account) {
  const key = Object.keys(account).find(k => /name/i.test(k) && typeof account[k] === "string");
  return key ? account[key] : null;
}

loadDashboard();
