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
  const { account, revenue_by_year, opportunities, rob_summary, source } = data;

  document.getElementById("account-name").textContent = account.name || "Unknown Account";
  const badge = document.getElementById("mode-badge");
  badge.textContent = source === "live" ? "Live MSX Data" : "Mock Data";

  const details = document.getElementById("account-details");
  const fields = [
    ["TPID", account.msp_tpid || account.tpid],
    ["Industry", account.industry || account.industrycode],
    ["Segment", account.segment],
    ["Region", account.region],
    ["City", account.city || account.address1_city],
    ["State/Province", account.state || account.address1_stateorprovince],
    ["Account Owner", account.account_owner],
  ].filter(([, v]) => v !== undefined && v !== null && v !== "");
  details.innerHTML = fields.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");

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

loadDashboard();
