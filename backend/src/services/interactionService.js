// Lightweight drug-drug interaction checker for common, high-yield pairs.
// This is intentionally a small curated set for the hackathon MVP; it is
// decision-support only and never blocks a prescription.

const INTERACTIONS = [
  {
    a: ["warfarin"],
    b: ["aspirin", "ibuprofen", "diclofenac", "naproxen", "aceclofenac"],
    severity: "Major",
    note: "Increased bleeding risk when combined with anticoagulants.",
  },
  {
    a: ["aspirin"],
    b: ["ibuprofen", "diclofenac", "naproxen", "aceclofenac"],
    severity: "Moderate",
    note: "NSAIDs may reduce aspirin's cardioprotective effect and add GI risk.",
  },
  {
    a: ["clopidogrel"],
    b: ["omeprazole", "esomeprazole"],
    severity: "Moderate",
    note: "Proton-pump inhibitors may reduce clopidogrel activation.",
  },
  {
    a: ["ramipril", "enalapril", "lisinopril", "perindopril"],
    b: ["spironolactone", "potassium chloride"],
    severity: "Major",
    note: "Risk of hyperkalemia with ACE inhibitor + potassium-sparing agent.",
  },
  {
    a: ["sertraline", "fluoxetine", "paroxetine", "escitalopram", "citalopram"],
    b: ["tramadol", "sumatriptan"],
    severity: "Major",
    note: "Risk of serotonin syndrome with SSRI + serotonergic drug.",
  },
  {
    a: ["simvastatin", "atorvastatin", "rosuvastatin"],
    b: ["clarithromycin", "erythromycin", "azithromycin"],
    severity: "Major",
    note: "Macrolides raise statin levels, increasing myopathy/rhabdomyolysis risk.",
  },
  {
    a: ["levothyroxine"],
    b: ["calcium carbonate", "ferrous sulfate", "ferrous ascorbate", "iron"],
    severity: "Moderate",
    note: "Calcium/iron reduce levothyroxine absorption; separate doses.",
  },
  {
    a: ["ciprofloxacin", "levofloxacin", "ofloxacin"],
    b: ["calcium carbonate", "ferrous sulfate", "ferrous ascorbate", "antacid"],
    severity: "Moderate",
    note: "Divalent cations reduce fluoroquinolone absorption; separate doses.",
  },
  {
    a: ["methotrexate"],
    b: ["aspirin", "ibuprofen", "diclofenac", "naproxen", "aceclofenac"],
    severity: "Major",
    note: "NSAIDs reduce methotrexate clearance, increasing toxicity.",
  },
  {
    a: ["allopurinol"],
    b: ["azathioprine"],
    severity: "Major",
    note: "Allopurinol raises azathioprine levels, risking severe myelosuppression.",
  },
  {
    a: ["digoxin"],
    b: ["amiodarone", "verapamil", "diltiazem"],
    severity: "Major",
    note: "Reduced digoxin clearance, risking digoxin toxicity.",
  },
];

const normalize = (name = "") => String(name).toLowerCase().trim();

const matchesAny = (text, terms) => terms.some((term) => text.includes(term));

const toDisplay = (raw) =>
  String(raw)
    .replace(/\s*\(.*?\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// medications: array of drug-name strings (brand/generic, may include dosage).
// Returns an array of de-duplicated alert strings.
export const checkDrugInteractions = (medications = []) => {
  const drugs = medications
    .map((m) => (typeof m === "string" ? m : m?.name || m?.drugName || ""))
    .map(toDisplay)
    .filter(Boolean);

  if (drugs.length < 2) return [];

  const alerts = [];

  for (let i = 0; i < drugs.length; i += 1) {
    for (let j = i + 1; j < drugs.length; j += 1) {
      const left = normalize(drugs[i]);
      const right = normalize(drugs[j]);

      for (const rule of INTERACTIONS) {
        const forward = matchesAny(left, rule.a) && matchesAny(right, rule.b);
        const reverse = matchesAny(right, rule.a) && matchesAny(left, rule.b);
        if (forward || reverse) {
          const label = `${drugs[i]} + ${drugs[j]} (${rule.severity})`;
          const alert = `${label}: ${rule.note}`;
          if (!alerts.includes(alert)) alerts.push(alert);
        }
      }
    }
  }

  return alerts;
};
