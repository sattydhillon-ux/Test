// Azure Forecast data for AHS (TPID 5684700).
//
// This dashboard has no API/export access to the live MSX "Azure Forecast"
// widget, so these series were manually digitized (visually estimated) from
// two screenshots the user captured directly from MSX on 2026-09-06:
//   - "Azure Consumption Revenue" tab
//   - "Consumption Units" tab
// Values are therefore approximate, not exact exports. Replace this file with
// a real export/API pull if one becomes available.
//
// Each series covers Jun'24 - Oct'27 monthly. "forecastStartIndex" marks the
// first index that is machine-learning forecast rather than historical.

const months = [
  "Jun'24", "Jul'24", "Aug'24", "Sep'24", "Oct'24", "Nov'24", "Dec'24",
  "Jan'25", "Feb'25", "Mar'25", "Apr'25", "May'25", "Jun'25", "Jul'25",
  "Aug'25", "Sep'25", "Oct'25", "Nov'25", "Dec'25", "Jan'26", "Feb'26",
  "Mar'26", "Apr'26", "May'26", "Jun'26", "Jul'26", "Aug'26", "Sep'26",
  "Oct'26", "Nov'26", "Dec'26", "Jan'27", "Feb'27", "Mar'27", "Apr'27",
  "May'27", "Jun'27", "Jul'27", "Aug'27", "Sep'27", "Oct'27",
];

const consumptionRevenue = [
  61000, 60000, 65000, 64000, 65000, 62000, 43000, 62000, 63000, 62000,
  63000, 64000, 59000, 58000, 58000, 58000, 63000, 61000, 70000, 67000,
  65000, 71000, 66000, 89000, 87000, 91000, 92000, 87000, 95000, 90000,
  97000, 98000, 87000, 97000, 96000, 108000, 104000, 112000, 116000,
  113000, 114000,
];

const consumptionUnits = [
  27000, 30000, 32000, 32000, 33000, 30000, 31000, 33000, 31000, 40000,
  44000, 51000, 50000, 50000, 50000, 50000, 63000, 58000, 80000, 89000,
  84000, 96000, 108000, 150000, 148000, 151000, 153000, 146000, 155000,
  147000, 159000, 148000, 158000, 157000, 168000, 163000, 176000, 167000,
  165000, 172000, 175000,
];

const forecastStartIndex = 24; // Jun'26 - first month with ML forecast overlap

function toSeries(values) {
  return months.map((month, i) => ({
    month,
    value: values[i],
    is_forecast: i >= forecastStartIndex,
  }));
}

function getAzureForecast() {
  return {
    updated_as_of: "2026-09-06",
    source_note:
      "Digitized from an MSX 'Azure Forecast' screenshot (manual estimate, not an exact export).",
    consumption_revenue: toSeries(consumptionRevenue),
    consumption_units: toSeries(consumptionUnits),
  };
}

module.exports = { getAzureForecast };
