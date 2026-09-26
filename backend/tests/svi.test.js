import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyRiskLevel, computeSvi, toSafetyIndicators } from "../src/services/sviService.js";
import { buildRecommendations } from "../src/services/supportRecommendationService.js";

test("classifyRiskLevel bands: LOW/MODERATE/HIGH/CRITICAL", () => {
  assert.equal(classifyRiskLevel(0), "LOW");
  assert.equal(classifyRiskLevel(24), "LOW");
  assert.equal(classifyRiskLevel(25), "MODERATE");
  assert.equal(classifyRiskLevel(49), "MODERATE");
  assert.equal(classifyRiskLevel(50), "HIGH");
  assert.equal(classifyRiskLevel(74), "HIGH");
  assert.equal(classifyRiskLevel(75), "CRITICAL");
  assert.equal(classifyRiskLevel(100), "CRITICAL");
});

test("no signals -> LOW, score 0", () => {
  const svi = computeSvi({}, []);
  assert.equal(svi.score, 0);
  assert.equal(svi.riskLevel, "LOW");
  assert.equal(svi.factors.length, 0);
  assert.equal(svi.forcedCritical, false);
  assert.match(svi.disclaimer, /not a clinical diagnosis/i);
});

test("threats + fear -> MODERATE, no double counting of fear/distress pair", () => {
  const svi = computeSvi({ reportedThreats: true, severeFear: true, severeDistress: true }, []);
  assert.equal(svi.score, 35);
  assert.equal(svi.riskLevel, "MODERATE");
  const factorKeys = svi.factors.map((f) => f.signal);
  assert.ok(factorKeys.includes("severeFearOrDistress"));
});

test("displacement + isolation + distress + threats -> HIGH with compounding", () => {
  const svi = computeSvi(
    {
      displacement: true,
      socialIsolation: true,
      supportNetworkUnavailable: true,
      severeDistress: true,
      reportedThreats: true,
    },
    [],
  );
  assert.equal(svi.score, 65);
  assert.equal(svi.riskLevel, "HIGH");
});

test("self-harm statement forces CRITICAL (even from a low raw score)", () => {
  const svi = computeSvi({ selfHarmStatement: true }, []);
  assert.equal(svi.score, 75);
  assert.equal(svi.riskLevel, "CRITICAL");
  assert.equal(svi.forcedCritical, true);
});

test("immediate danger forces CRITICAL", () => {
  const svi = computeSvi({ immediateDanger: true }, []);
  assert.equal(svi.score, 75);
  assert.equal(svi.riskLevel, "CRITICAL");
  assert.equal(svi.forcedCritical, true);
});

test("score clamps at 100", () => {
  const all = {
    immediateDanger: true,
    reportedThreats: true,
    severeFear: true,
    severeDistress: true,
    intimidation: true,
    socialIsolation: true,
    supportNetworkUnavailable: true,
    displacement: true,
    selfHarmStatement: true,
    medicalConcern: true,
    legalAssistanceRequested: true,
  };
  const svi = computeSvi(all, []);
  assert.equal(svi.score, 100);
  assert.equal(svi.riskLevel, "CRITICAL");
});

test("evidence is attached to factors and safety indicators derived", () => {
  const evidence = [
    { signal: "reportedThreats", evidence: "He said he will burn my house." },
    { signal: "immediateDanger", evidence: "He is outside with a weapon." },
  ];
  const svi = computeSvi({ reportedThreats: true, immediateDanger: true }, evidence);
  const threatFactor = svi.factors.find((f) => f.signal === "reportedThreats");
  assert.equal(threatFactor.evidence, "He said he will burn my house.");
  const indicators = toSafetyIndicators({ immediateDanger: true, selfHarmStatement: true });
  assert.ok(indicators.includes("Immediate danger reported"));
  assert.ok(indicators.includes("Self-harm / suicidal statement"));
  assert.equal(indicators.length, 2);
});

test("recommendations: immediate danger -> human escalation + emergency/police", () => {
  const { recommendations, note } = buildRecommendations({ immediateDanger: true });
  const pathways = recommendations.map((r) => r.pathway);
  assert.ok(pathways.includes("Immediate human escalation"));
  assert.ok(pathways.includes("Emergency / police review"));
  assert.match(note, /Final decisions remain with authorized human personnel/i);
});

test("recommendations: self-harm -> mental-health referral", () => {
  const { recommendations } = buildRecommendations({ selfHarmStatement: true });
  const pathways = recommendations.map((r) => r.pathway);
  assert.ok(pathways.some((p) => p.includes("mental-health")));
});

test("recommendations: legal assistance request -> legal aid", () => {
  const { recommendations } = buildRecommendations({ legalAssistanceRequested: true });
  const pathways = recommendations.map((r) => r.pathway);
  assert.ok(pathways.includes("Legal aid referral"));
});

test("recommendations: no signals -> empty list", () => {
  const { recommendations } = buildRecommendations({});
  assert.equal(recommendations.length, 0);
});

test("recommendations: dedupe shared pathways", () => {
  const { recommendations } = buildRecommendations({
    legalAssistanceRequested: true,
    reportedThreats: true,
  });
  const pathways = recommendations.map((r) => r.pathway);
  assert.equal(pathways.filter((p) => p === "Legal aid referral").length, 1);
});

test("recommendations: displacement -> shelter/rehabilitation", () => {
  const { recommendations } = buildRecommendations({ displacement: true });
  const pathways = recommendations.map((r) => r.pathway);
  assert.ok(pathways.some((p) => p.includes("Shelter")));
});