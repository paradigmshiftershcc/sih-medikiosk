// FHIR R4 (OPConsultation) bundle builder.
// Produces a standards-aligned "document" Bundle from a MediKiosk case so the
// record can be exported or pushed to an ABDM/FHIR repository. No live HIE
// call is made here; this is pure serialization.

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const narrative = (text) => ({
  status: "generated",
  div: `<div xmlns="http://www.w3.org/1999/xhtml">${escapeHtml(text || "Not provided")}</div>`,
});

const listToText = (items) =>
  Array.isArray(items) && items.length > 0
    ? items.map((item) => `• ${item}`).join("\n")
    : "Not provided";

const urn = (prefix, id) => `urn:uuid:${prefix}-${id}`;

const toFhirDateTime = (value) => {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime())
    ? new Date().toISOString()
    : date.toISOString();
};

export const mapPatient = (patient) => ({
  resourceType: "Patient",
  id: patient?._id?.toString(),
  identifier: patient?.abhaId
    ? [
        {
          system: "https://healthid.ndhm.gov.in",
          value: patient.abhaId,
        },
      ]
    : undefined,
  name: patient?.name ? [{ text: patient.name }] : undefined,
  telecom: patient?.phone
    ? [{ system: "phone", value: patient.phone }]
    : undefined,
  gender: "unknown",
});

export const mapEncounter = (caseRecord, patientRef) => ({
  resourceType: "Encounter",
  id: `enc-${caseRecord._id}`,
  status: "finished",
  class: {
    system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
    code: "AMB",
    display: "ambulatory",
  },
  subject: { reference: patientRef },
  period: { start: toFhirDateTime(caseRecord.createdAt) },
});

export const mapObservation = (observation, patientRef, encounterRef) => ({
  resourceType: "Observation",
  id: observation._id.toString(),
  status: "final",
  category: [
    {
      coding: [
        {
          system:
            "http://terminology.hl7.org/CodeSystem/observation-category",
          code: "laboratory",
          display: "Laboratory",
        },
      ],
    },
  ],
  code: { text: observation.metricName },
  subject: { reference: patientRef },
  encounter: { reference: encounterRef },
  effectiveDateTime: toFhirDateTime(observation.observationDate),
  valueQuantity: {
    value: observation.value,
    unit: observation.unit || undefined,
  },
  referenceRange: observation.referenceRange
    ? [{ text: observation.referenceRange }]
    : undefined,
  interpretation: observation.isAbnormal
    ? [
        {
          coding: [
            {
              system:
                "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
              code: "A",
              display: "Abnormal",
            },
          ],
        },
      ]
    : undefined,
});

const buildSections = (caseRecord, observations) => {
  const summary = caseRecord.finalSummary || {};
  const sections = [];

  sections.push({
    title: "Chief Complaint",
    text: narrative(summary.chiefComplaint),
  });
  sections.push({
    title: "History of Present Illness",
    text: narrative(summary.hpi),
  });
  sections.push({
    title: "Past Medical History",
    text: narrative(listToText(summary.pastMedicalHistory)),
  });
  sections.push({
    title: "Medications",
    text: narrative(listToText(summary.medications)),
  });
  sections.push({
    title: "Allergies",
    text: narrative(listToText(summary.allergies)),
  });

  if (observations.length > 0) {
    sections.push({
      title: "Investigations",
      text: narrative(
        observations
          .map(
            (obs) =>
              `${obs.metricName}: ${obs.value} ${obs.unit || ""} (ref: ${
                obs.referenceRange || "N/A"
              })${obs.isAbnormal ? " [ABNORMAL]" : ""}`,
          )
          .join("\n"),
      ),
      entry: observations.map((obs) => ({
        reference: urn("obs", obs._id.toString()),
      })),
    });
  }

  if (Array.isArray(caseRecord.interactionAlerts) && caseRecord.interactionAlerts.length > 0) {
    sections.push({
      title: "Drug Interaction Alerts",
      text: narrative(caseRecord.interactionAlerts.join("\n")),
    });
  }

  if (caseRecord.ayushMode || summary.ayushSummary) {
    sections.push({
      title: "AYUSH Assessment",
      text: narrative(
        summary.ayushSummary ||
          listToText(
            Object.entries(summary.ayushAssessment || {}).map(
              ([key, value]) => `${key}: ${value}`,
            ),
          ),
      ),
    });
  }

  sections.push({
    title: "Clinician Attention",
    text: narrative(listToText(summary.clinicianAttention)),
  });
  sections.push({
    title: "Missing Information",
    text: narrative(listToText(summary.missingInformation)),
  });

  return sections;
};

// Builds a FHIR R4 document Bundle. Accepts either an Observation model
// record or a raw labValues entry for observations.
export const buildOPConsultationBundle = ({
  caseRecord,
  patient,
  doctor,
  observations = [],
}) => {
  const patientRef = urn("patient", patient?._id?.toString());
  const encounterRef = urn("enc", caseRecord._id.toString());

  const observationResources = observations
    .filter((obs) => obs && obs.metricName)
    .map((obs) => ({
      fullUrl: urn("obs", obs._id?.toString?.() || obs.metricCode),
      resource: mapObservation(obs, patientRef, encounterRef),
    }));

  const doctorDisplay = doctor?.name ? `Dr. ${doctor.name}` : undefined;
  const authorRef = doctor?._id
    ? urn("doctor", doctor._id.toString())
    : undefined;

  const composition = {
    resourceType: "Composition",
    id: `comp-${caseRecord._id}`,
    status: "final",
    type: {
      coding: [
        {
          system: "http://loinc.org",
          code: "11488-4",
          display: "Consult note",
        },
      ],
    },
    subject: { reference: patientRef },
    encounter: { reference: encounterRef },
    date: toFhirDateTime(caseRecord.verifiedAt || caseRecord.updatedAt),
    author: authorRef
      ? [{ reference: authorRef, display: doctorDisplay }]
      : undefined,
    title: "OP Consultation Note",
    section: buildSections(caseRecord, observations),
  };

  const entries = [
    { fullUrl: urn("comp", caseRecord._id.toString()), resource: composition },
    { fullUrl: patientRef, resource: mapPatient(patient) },
    {
      fullUrl: encounterRef,
      resource: mapEncounter(caseRecord, patientRef),
    },
    ...observationResources,
  ];

  return {
    resourceType: "Bundle",
    type: "document",
    timestamp: new Date().toISOString(),
    identifier: {
      system: "https://medikiosk.local/fhir/case",
      value: caseRecord._id.toString(),
    },
    entry: entries,
  };
};
