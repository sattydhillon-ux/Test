const ReferralDB = (() => {
  const databaseName = "clearpath-referrals";
  const storeName = "referrals";
  const medicationStore = "medications";
  const interactionStore = "interactions";
  const version = 2;
  let databasePromise;

  const blockedReferrals = [
    { patient: "Aisha Rahman", specialty: "Orthopaedics", physician: "Dr. Chen", missingItem: "Diagnostic imaging", status: "blocked", waitDays: 5, initials: "AR", avatar: "coral" },
    { patient: "Marcus Lee", specialty: "Cardiology", physician: "Dr. Bains", missingItem: "Patient consent", status: "blocked", waitDays: 2, initials: "ML", avatar: "mint" },
    { patient: "Elena Petrova", specialty: "Endocrinology", physician: "Dr. Okafor", missingItem: "Current lab results", status: "blocked", waitDays: 1, initials: "EP", avatar: "lilac" },
    { patient: "Noah Williams", specialty: "Neurology", physician: "Dr. Singh", missingItem: "Demographic details", status: "blocked", waitDays: 0, initials: "NW", avatar: "sky" },
  ];

  const submittedPatients = ["Sofia Martinez", "Ethan Brown", "Priya Shah", "Lucas Martin", "Amelia Wilson", "Owen Taylor", "Mia Thompson", "Jack Anderson"];
  const acceptedPatients = ["Olivia Moore", "Liam Jackson", "Emma White", "Benjamin Harris", "Ava Clark", "Henry Lewis", "Isla Walker", "Leo Hall", "Chloe Allen", "Arthur Young", "Grace King", "Oscar Wright", "Freya Scott", "Theo Green", "Ella Baker", "James Adams", "Ruby Nelson", "Finn Carter"];

  const seedData = [
    ...blockedReferrals,
    ...submittedPatients.map((patient, index) => ({
      patient,
      specialty: ["Dermatology", "Gastroenterology", "Rheumatology", "Ophthalmology"][index % 4],
      physician: ["Dr. Chen", "Dr. Bains", "Dr. Okafor", "Dr. Singh"][index % 4],
      missingItem: "",
      status: "submitted",
      waitDays: index % 4,
      initials: patient.split(" ").map((part) => part[0]).join(""),
      avatar: ["coral", "mint", "lilac", "sky"][index % 4],
    })),
    ...acceptedPatients.map((patient, index) => ({
      patient,
      specialty: ["Cardiology", "Neurology", "Orthopaedics"][index % 3],
      physician: ["Dr. Bains", "Dr. Singh", "Dr. Chen"][index % 3],
      missingItem: "",
      status: "accepted",
      waitDays: 0,
      initials: patient.split(" ").map((part) => part[0]).join(""),
      avatar: ["mint", "sky", "coral"][index % 3],
    })),
  ];

  const medicationData = [
    { name: "Warfarin", strength: "5 mg", form: "Tablet", category: "Anticoagulant", stock: 84, prescriptions: 12 },
    { name: "Amiodarone", strength: "200 mg", form: "Tablet", category: "Antiarrhythmic", stock: 42, prescriptions: 6 },
    { name: "Lisinopril", strength: "10 mg", form: "Tablet", category: "ACE inhibitor", stock: 156, prescriptions: 29 },
    { name: "Spironolactone", strength: "25 mg", form: "Tablet", category: "Diuretic", stock: 73, prescriptions: 11 },
    { name: "Metformin", strength: "500 mg", form: "Tablet", category: "Antidiabetic", stock: 214, prescriptions: 38 },
    { name: "Sertraline", strength: "50 mg", form: "Tablet", category: "SSRI", stock: 97, prescriptions: 18 },
    { name: "Naproxen", strength: "500 mg", form: "Tablet", category: "NSAID", stock: 35, prescriptions: 9 },
    { name: "Simvastatin", strength: "40 mg", form: "Tablet", category: "Statin", stock: 64, prescriptions: 15 },
    { name: "Clarithromycin", strength: "500 mg", form: "Tablet", category: "Antibiotic", stock: 22, prescriptions: 4 },
  ];

  const interactionData = [
    { patient: "Aisha Rahman", drugs: ["Warfarin", "Amiodarone"], severity: "major", summary: "May increase anticoagulant effect and bleeding risk.", action: "Review INR monitoring and dose plan." },
    { patient: "Marcus Lee", drugs: ["Lisinopril", "Spironolactone"], severity: "moderate", summary: "Combined use may increase potassium levels.", action: "Review potassium and renal function." },
    { patient: "Elena Petrova", drugs: ["Metformin", "Iodinated contrast"], severity: "major", summary: "Renal impairment may increase lactic acidosis risk.", action: "Review renal function and contrast protocol." },
    { patient: "Noah Williams", drugs: ["Sertraline", "Naproxen"], severity: "moderate", summary: "Combined use may increase gastrointestinal bleeding risk.", action: "Assess bleeding risk and gastroprotection." },
    { patient: "Sofia Martinez", drugs: ["Simvastatin", "Clarithromycin"], severity: "contraindicated", summary: "May substantially increase simvastatin exposure and myopathy risk.", action: "Pharmacist review required before dispensing." },
  ];

  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function open() {
    if (!databasePromise) {
      databasePromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(databaseName, version);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(storeName)) {
            request.result.createObjectStore(storeName, { keyPath: "id", autoIncrement: true });
          }
          if (!request.result.objectStoreNames.contains(medicationStore)) {
            request.result.createObjectStore(medicationStore, { keyPath: "id", autoIncrement: true });
          }
          if (!request.result.objectStoreNames.contains(interactionStore)) {
            request.result.createObjectStore(interactionStore, { keyPath: "id", autoIncrement: true });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error("The referral database is blocked by another tab."));
      });
    }
    return databasePromise;
  }

  async function seed() {
    const database = await open();
    const stores = [
      [storeName, seedData],
      [medicationStore, medicationData],
      [interactionStore, interactionData],
    ];

    await Promise.all(stores.map(async ([name, records]) => {
      const count = await requestResult(database.transaction(name).objectStore(name).count());
      if (count > 0) return;

      await new Promise((resolve, reject) => {
        const transaction = database.transaction(name, "readwrite");
        const store = transaction.objectStore(name);
        records.forEach((record) => store.add(record));
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    }));
  }

  async function getAll() {
    const database = await open();
    return requestResult(database.transaction(storeName).objectStore(storeName).getAll());
  }

  async function add(referral) {
    const database = await open();
    return requestResult(database.transaction(storeName, "readwrite").objectStore(storeName).add(referral));
  }

  async function update(referral) {
    const database = await open();
    return requestResult(database.transaction(storeName, "readwrite").objectStore(storeName).put(referral));
  }

  async function getPharmacyData() {
    const database = await open();
    const [medications, interactions] = await Promise.all([
      requestResult(database.transaction(medicationStore).objectStore(medicationStore).getAll()),
      requestResult(database.transaction(interactionStore).objectStore(interactionStore).getAll()),
    ]);
    return { medications, interactions };
  }

  return { seed, getAll, add, update, getPharmacyData };
})();
