/** Sample data returned when MSX_MODE=mock. Shaped like a trimmed-down
 * version of what the Dynamics 365 Web API would return for an Account plus
 * related Opportunities, so swapping to live mode requires no viewer changes.
 */

const ACCOUNT = {
  accountid: "00000000-0000-0000-0000-000000005684700",
  name: "Alberta Health Services",
  msp_tpid: "5684700",
  industry: "Healthcare",
  segment: "Public Sector - Health",
  primary_contact: "Jane Doe (sample)",
  account_owner: "Sample Account Executive",
  region: "Canada",
  city: "Edmonton",
  state: "Alberta",
};

const REVENUE_BY_YEAR = [
  { fiscal_year: "FY23", actual: 4.2, target: 4.0 },
  { fiscal_year: "FY24", actual: 5.1, target: 4.8 },
  { fiscal_year: "FY25", actual: 3.6, target: 6.0 },
];

const OPPORTUNITIES = [
  {
    name: "AHS Azure Landing Zone Modernization",
    estimated_value: 1250000,
    stage: "Propose",
    close_date: "2026-03-31",
    probability: 60,
  },
  {
    name: "AHS Microsoft 365 Copilot Expansion",
    estimated_value: 640000,
    stage: "Develop",
    close_date: "2026-06-30",
    probability: 40,
  },
  {
    name: "AHS Security & Compliance Renewal",
    estimated_value: 980000,
    stage: "Qualify",
    close_date: "2026-09-30",
    probability: 25,
  },
];

const ROB_SUMMARY = {
  consumed_revenue_ttm: 8.7,
  target_ttm: 9.5,
  attainment_pct: 91.6,
  pipeline_coverage: 2.1,
};

function getMockDashboard() {
  return {
    account: { ...ACCOUNT },
    revenue_by_year: REVENUE_BY_YEAR,
    opportunities: OPPORTUNITIES,
    rob_summary: ROB_SUMMARY,
    source: "mock",
  };
}

module.exports = { getMockDashboard };
