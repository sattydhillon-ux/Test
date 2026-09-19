const tourSteps = [
  {
    target: null,
    title: "Welcome to ClearPath",
    body: "This is a quick walkthrough of how ClearPath helps you catch administrative gaps before they delay a patient's referral. Takes about a minute.",
  },
  {
    target: '[data-tour="hero"]',
    title: "Referral health, at a glance",
    body: "This banner shows what percentage of active referrals are complete and how many still need attention before they can move forward.",
  },
  {
    target: '[data-tour="metrics"]',
    title: "Key metrics",
    body: "Track active referrals, how many need attention, monthly acceptances, and average time to acceptance — all updated live from your data.",
  },
  {
    target: '[data-tour="blockers"]',
    title: "Clear the blockers",
    body: "Every referral missing something — imaging, consent, labs, demographics — shows up here so nothing quietly resets the clock.",
  },
  {
    target: '[data-tour="resolve-all"]',
    title: "Resolve in one click",
    body: "Click into a single referral to attach the missing item, or use \"Resolve all\" to clear every blocker at once.",
  },
  {
    target: '[data-tour="new-referral"]',
    title: "Add a new referral",
    body: "Start a new referral here. ClearPath prompts for the details needed up front, so it's less likely to bounce back later.",
  },
  {
    target: '[data-tour="momentum"]',
    title: "Referral momentum",
    body: "See accepted vs. returned referrals over the last six weeks to track whether your process is improving.",
  },
  {
    target: '[data-tour="pharmacy-nav"]',
    title: "Pharmacy & drug interactions",
    body: "The Pharmacy tab surfaces medication safety alerts and formulary inventory, so interaction risks are visible before dispensing.",
  },
  {
    target: '[data-tour="customize-nav"]',
    title: "Make it yours",
    body: "Customize accent colour, layout density, and which panels are visible. Your preferences are saved automatically.",
  },
];

(function initTour() {
  const overlay = document.querySelector("#tourOverlay");
  const spotlight = document.querySelector("#tourSpotlight");
  const card = document.querySelector("#tourCard");
  const stepLabel = document.querySelector("#tourStepLabel");
  const titleEl = document.querySelector("#tourTitle");
  const bodyEl = document.querySelector("#tourBody");
  const dotsEl = document.querySelector("#tourDots");
  const backButton = document.querySelector("#tourBack");
  const nextButton = document.querySelector("#tourNext");
  const skipButton = document.querySelector("#tourSkip");
  const startButton = document.querySelector("#startTourButton");
  const storageKey = "clearpath-tour-completed";

  let stepIndex = 0;

  dotsEl.innerHTML = tourSteps.map(() => '<span class="tour-dot"></span>').join("");
  const dots = [...dotsEl.querySelectorAll(".tour-dot")];

  function positionForStep(step) {
    const element = step.target ? document.querySelector(step.target) : null;

    if (!element) {
      spotlight.style.opacity = "0";
      card.style.top = "50%";
      card.style.left = "50%";
      card.style.transform = "translate(-50%, -50%)";
      return;
    }

    element.scrollIntoView({ block: "center", behavior: "smooth" });

    requestAnimationFrame(() => {
      const rect = element.getBoundingClientRect();
      const padding = 10;

      spotlight.style.opacity = "1";
      spotlight.style.top = `${rect.top - padding}px`;
      spotlight.style.left = `${rect.left - padding}px`;
      spotlight.style.width = `${rect.width + padding * 2}px`;
      spotlight.style.height = `${rect.height + padding * 2}px`;

      const cardWidth = 340;
      const cardHeight = card.offsetHeight || 220;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let top = rect.bottom + 18;
      let left = rect.left;

      if (top + cardHeight > viewportHeight - 20) {
        top = Math.max(20, rect.top - cardHeight - 18);
      }
      if (left + cardWidth > viewportWidth - 20) {
        left = viewportWidth - cardWidth - 20;
      }
      left = Math.max(20, left);

      card.style.top = `${top}px`;
      card.style.left = `${left}px`;
      card.style.transform = "none";
    });
  }

  function renderStep() {
    const step = tourSteps[stepIndex];
    stepLabel.textContent = `Step ${stepIndex + 1} of ${tourSteps.length}`;
    titleEl.textContent = step.title;
    bodyEl.textContent = step.body;
    backButton.hidden = stepIndex === 0;
    nextButton.textContent = stepIndex === tourSteps.length - 1 ? "Finish" : "Next";
    dots.forEach((dot, index) => dot.classList.toggle("active", index === stepIndex));
    positionForStep(step);
  }

  function openTour() {
    stepIndex = 0;
    overlay.hidden = false;
    document.body.classList.add("tour-active");
    renderStep();
    nextButton.focus();
  }

  function closeTour(markComplete = true) {
    overlay.hidden = true;
    document.body.classList.remove("tour-active");
    if (markComplete) {
      localStorage.setItem(storageKey, "true");
    }
    startButton?.focus();
  }

  nextButton.addEventListener("click", () => {
    if (stepIndex === tourSteps.length - 1) {
      closeTour(true);
      return;
    }
    stepIndex += 1;
    renderStep();
  });

  backButton.addEventListener("click", () => {
    stepIndex = Math.max(0, stepIndex - 1);
    renderStep();
  });

  skipButton.addEventListener("click", () => closeTour(true));

  overlay.querySelector(".tour-backdrop").addEventListener("click", () => closeTour(true));

  document.addEventListener("keydown", (event) => {
    if (overlay.hidden) return;
    if (event.key === "Escape") closeTour(true);
    if (event.key === "ArrowRight") nextButton.click();
    if (event.key === "ArrowLeft" && stepIndex > 0) backButton.click();
  });

  window.addEventListener("resize", () => {
    if (!overlay.hidden) positionForStep(tourSteps[stepIndex]);
  });

  startButton?.addEventListener("click", openTour);

  if (!localStorage.getItem(storageKey)) {
    setTimeout(openTour, 600);
  }
})();
