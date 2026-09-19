const body = document.body;
const blockerList = document.querySelector("#blockerList");
const attentionCount = document.querySelector("#attentionCount");
const activeCount = document.querySelector("#activeCount");
const acceptedCount = document.querySelector("#acceptedCount");
const heroAttentionCount = document.querySelector("#heroAttentionCount");
const emptyState = document.querySelector("#emptyState");
const modalBackdrop = document.querySelector("#modalBackdrop");
const modalTitle = document.querySelector("#modalTitle");
const modalDescription = document.querySelector("#modalDescription");
const fileInput = document.querySelector("#fileInput");
const fileName = document.querySelector("#fileName");
const toast = document.querySelector("#toast");
const menuButton = document.querySelector(".menu-button");
const customizeDrawer = document.querySelector("#customizeDrawer");
const customizeBackdrop = document.querySelector("#customizeBackdrop");
const heroToggle = document.querySelector("#heroToggle");
const referralFields = document.querySelector("#referralFields");
const modalActionButton = document.querySelector("#markResolvedButton");
const interactionList = document.querySelector("#interactionList");
const formularyList = document.querySelector("#formularyList");
const medicationSearch = document.querySelector("#medicationSearch");

let activeReferral = null;
let currentReferrals = [];
let pharmacyData = { medications: [], interactions: [] };
let toastTimer = null;

const customizeDefaults = {
  accent: "#4263eb",
  dark: "#2846bb",
  density: "comfortable",
  showHero: true,
};

function loadCustomizeSettings() {
  try {
    return { ...customizeDefaults, ...JSON.parse(localStorage.getItem("clearpath-customize")) };
  } catch {
    return customizeDefaults;
  }
}

function applyCustomizeSettings(settings) {
  document.documentElement.style.setProperty("--blue", settings.accent);
  document.documentElement.style.setProperty("--blue-dark", settings.dark);
  body.classList.toggle("compact", settings.density === "compact");
  body.classList.toggle("hide-hero", !settings.showHero);
  heroToggle.checked = settings.showHero;

  document.querySelectorAll(".swatch").forEach((swatch) => {
    const active = swatch.dataset.accent === settings.accent;
    swatch.classList.toggle("active", active);
    swatch.setAttribute("aria-pressed", String(active));
  });
  document.querySelectorAll("[data-density]").forEach((button) => {
    button.classList.toggle("active", button.dataset.density === settings.density);
  });
}

function saveCustomizeSettings(settings) {
  localStorage.setItem("clearpath-customize", JSON.stringify(settings));
  applyCustomizeSettings(settings);
}

function openCustomize() {
  customizeBackdrop.hidden = false;
  customizeDrawer.classList.add("open");
  customizeDrawer.setAttribute("aria-hidden", "false");
  document.querySelector("#customizeClose").focus();
}

function closeCustomize() {
  customizeDrawer.classList.remove("open");
  customizeDrawer.setAttribute("aria-hidden", "true");
  setTimeout(() => {
    customizeBackdrop.hidden = true;
  }, 280);
  document.querySelector("#customizeButton").focus();
}

applyCustomizeSettings(loadCustomizeSettings());

function escapeHtml(value) {
  const element = document.createElement("span");
  element.textContent = value;
  return element.innerHTML;
}

function waitLabel(days) {
  if (days === 0) return "New today";
  return `Waiting ${days} day${days === 1 ? "" : "s"}`;
}

function renderDashboard(referrals) {
  currentReferrals = referrals;
  const blocked = referrals
    .filter((referral) => referral.status === "blocked")
    .sort((a, b) => b.waitDays - a.waitDays);
  const active = referrals.filter((referral) => referral.status !== "accepted");
  const accepted = referrals.filter((referral) => referral.status === "accepted");

  blockerList.innerHTML = blocked.map((referral) => `
    <button class="blocker-row" data-id="${referral.id}">
      <span class="patient-avatar ${escapeHtml(referral.avatar)}">${escapeHtml(referral.initials)}</span>
      <span class="patient-info">
        <strong>${escapeHtml(referral.patient)}</strong>
        <small>${escapeHtml(referral.specialty)} · ${escapeHtml(referral.physician)}</small>
      </span>
      <span class="issue">
        <small>Missing</small>
        <strong>${escapeHtml(referral.missingItem)}</strong>
      </span>
      <span class="age ${referral.waitDays >= 5 ? "urgent" : ""}">${waitLabel(referral.waitDays)}</span>
      <span class="arrow">→</span>
    </button>
  `).join("");

  activeCount.textContent = active.length;
  acceptedCount.textContent = accepted.length;
  attentionCount.textContent = blocked.length;
  heroAttentionCount.textContent = blocked.length;
  document.querySelector(".nav-count").textContent = active.length;
  emptyState.classList.toggle("visible", blocked.length === 0);
}

async function refreshDashboard() {
  renderDashboard(await ReferralDB.getAll());
}

function renderPharmacy(query = "") {
  const normalizedQuery = query.trim().toLowerCase();
  const medications = pharmacyData.medications.filter((medication) =>
    [medication.name, medication.strength, medication.form, medication.category]
      .some((value) => value.toLowerCase().includes(normalizedQuery))
  );

  interactionList.innerHTML = pharmacyData.interactions.map((interaction) => `
    <div class="interaction-card ${escapeHtml(interaction.severity)}">
      <span class="severity-icon">!</span>
      <span class="drug-pair">
        <strong>${escapeHtml(interaction.drugs.join(" + "))}</strong>
        <small>${escapeHtml(interaction.patient)}</small>
      </span>
      <span class="interaction-detail">
        <strong>${escapeHtml(interaction.summary)}</strong>
        <small>${escapeHtml(interaction.action)}</small>
      </span>
      <span class="severity-pill">${escapeHtml(interaction.severity)}</span>
    </div>
  `).join("");

  formularyList.innerHTML = medications.map((medication) => `
    <div class="formulary-row">
      <span class="medication-name">
        <strong>${escapeHtml(medication.name)} ${escapeHtml(medication.strength)}</strong>
        <small>${escapeHtml(medication.form)} · ${medication.prescriptions} active Rx</small>
      </span>
      <span>${escapeHtml(medication.category)}</span>
      <span class="stock ${medication.stock < 30 ? "low" : ""}">${medication.stock}</span>
    </div>
  `).join("");

  document.querySelector("#interactionTotal").textContent = `${pharmacyData.interactions.length} alerts`;
  document.querySelector("#inventoryTotal").textContent = `${medications.length} products`;
  document.querySelector(".pharmacy-count").textContent = pharmacyData.interactions.length;
}

async function refreshPharmacy() {
  pharmacyData = await ReferralDB.getPharmacyData();
  renderPharmacy(medicationSearch.value);
}

async function initializeReferrals() {
  try {
    await ReferralDB.seed();
    await Promise.all([refreshDashboard(), refreshPharmacy()]);
  } catch (error) {
    console.error("Unable to load the referral database.", error);
    emptyState.classList.add("visible");
    emptyState.querySelector("h4").textContent = "Unable to load referrals";
    emptyState.querySelector("p").textContent = "Refresh the page or check browser storage permissions.";
  }
}

function openModal(row) {
  activeReferral = row
    ? currentReferrals.find((referral) => referral.id === Number(row.dataset.id))
    : null;
  const patient = activeReferral?.patient ?? "New patient";
  const issue = activeReferral?.missingItem ?? "required documentation";

  modalTitle.textContent = activeReferral ? `Complete ${patient}'s referral` : "Create a new referral";
  modalDescription.textContent = activeReferral
    ? `Add or confirm ${issue.toLowerCase()} so this referral can move to specialist review.`
    : "Start a complete referral and catch missing administrative details before submission.";
  referralFields.hidden = Boolean(activeReferral);
  modalActionButton.textContent = activeReferral ? "Mark as resolved" : "Create referral";
  referralFields.querySelectorAll("input").forEach((input) => {
    input.value = "";
  });
  fileName.textContent = "";
  fileInput.value = "";
  modalBackdrop.hidden = false;
  document.querySelector("#modalClose").focus();
}

function closeModal() {
  modalBackdrop.hidden = true;
  document.querySelector(`[data-id="${activeReferral?.id}"]`)?.focus();
  activeReferral = null;
}

function showToast(message = "The blocker has been cleared.") {
  toast.querySelector("small").textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}

async function resolveRow(row, referral) {
  await ReferralDB.update({ ...referral, status: "submitted", missingItem: "", waitDays: 0 });
  row.style.opacity = "0";
  row.style.transform = "translateX(12px)";
  row.style.transition = "opacity .2s, transform .2s";
  setTimeout(() => {
    refreshDashboard().catch((error) => {
      console.error("Unable to refresh referrals.", error);
      showToast("The referral changed, but the dashboard could not refresh.");
    });
  }, 200);
}

blockerList.addEventListener("click", (event) => {
  const row = event.target.closest(".blocker-row");
  if (row) openModal(row);
});

document.querySelector("#newReferralButton").addEventListener("click", () => openModal(null));
document.querySelector("#modalClose").addEventListener("click", closeModal);
document.querySelector("#customizeButton").addEventListener("click", (event) => {
  event.preventDefault();
  openCustomize();
});
document.querySelector("#customizeClose").addEventListener("click", closeCustomize);
customizeBackdrop.addEventListener("click", closeCustomize);

modalBackdrop.addEventListener("click", (event) => {
  if (event.target === modalBackdrop) closeModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modalBackdrop.hidden) closeModal();
  if (event.key === "Escape" && customizeDrawer.classList.contains("open")) closeCustomize();
});

document.querySelectorAll(".swatch").forEach((swatch) => {
  swatch.addEventListener("click", () => {
    const settings = loadCustomizeSettings();
    saveCustomizeSettings({
      ...settings,
      accent: swatch.dataset.accent,
      dark: swatch.dataset.dark,
    });
  });
});

document.querySelectorAll("[data-density]").forEach((button) => {
  button.addEventListener("click", () => {
    saveCustomizeSettings({ ...loadCustomizeSettings(), density: button.dataset.density });
  });
});

heroToggle.addEventListener("change", () => {
  saveCustomizeSettings({ ...loadCustomizeSettings(), showHero: heroToggle.checked });
});

document.querySelector("#resetCustomize").addEventListener("click", () => {
  saveCustomizeSettings(customizeDefaults);
  showToast("Workspace appearance has been reset.");
});

fileInput.addEventListener("change", () => {
  fileName.textContent = fileInput.files[0] ? `Selected: ${fileInput.files[0].name}` : "";
});

medicationSearch.addEventListener("input", () => renderPharmacy(medicationSearch.value));

modalActionButton.addEventListener("click", async () => {
  if (activeReferral) {
    const referral = activeReferral;
    const row = document.querySelector(`[data-id="${referral.id}"]`);
    closeModal();
    try {
      await resolveRow(row, referral);
      showToast();
    } catch (error) {
      console.error("Unable to resolve the referral.", error);
      showToast("The referral could not be updated.");
    }
    return;
  }

  const inputs = [...referralFields.querySelectorAll("input")];
  const invalidInput = inputs.find((input) => !input.value.trim());
  if (invalidInput) {
    invalidInput.focus();
    return;
  }

  const patient = document.querySelector("#patientName").value.trim();
  try {
    await ReferralDB.add({
      patient,
      specialty: document.querySelector("#specialty").value.trim(),
      physician: document.querySelector("#physician").value.trim(),
      missingItem: document.querySelector("#missingItem").value.trim(),
      status: "blocked",
      waitDays: 0,
      initials: patient.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
      avatar: ["coral", "mint", "lilac", "sky"][currentReferrals.length % 4],
    });
    await refreshDashboard();
    closeModal();
    showToast("The new referral has been saved.");
  } catch (error) {
    console.error("Unable to create the referral.", error);
    showToast("The referral could not be saved.");
  }
});

document.querySelector("#resolveAllButton").addEventListener("click", async () => {
  const blocked = currentReferrals.filter((referral) => referral.status === "blocked");
  try {
    await Promise.all(blocked.map((referral) => ReferralDB.update({
      ...referral,
      status: "submitted",
      missingItem: "",
      waitDays: 0,
    })));
    await refreshDashboard();
    showToast("All administrative blockers have been cleared.");
  } catch (error) {
    console.error("Unable to resolve all referrals.", error);
    showToast("The referrals could not be updated.");
  }
});

menuButton.addEventListener("click", () => {
  const open = body.classList.toggle("nav-open");
  menuButton.setAttribute("aria-expanded", String(open));
});

document.querySelectorAll(".nav-item").forEach((link) => {
  link.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("active"));
    link.classList.add("active");
    body.classList.remove("nav-open");
    menuButton.setAttribute("aria-expanded", "false");
  });
});

initializeReferrals();
