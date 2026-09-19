import mongoose from "mongoose";
import Observation from "../models/Observation.js";
import CaseRecord from "../models/CaseRecord.js";
import { isValueAbnormal } from "../services/observationService.js";

const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));

// Resolve the patient whose records are being queried, enforcing access:
// - patients may only query their own records
// - doctors may only query patients on cases assigned to them
const resolvePatientScope = async (req) => {
  if (req.user.role === "doctor") {
    const { caseId } = req.params;
    if (!caseId) return { error: "caseId is required for doctor access." };
    const caseRecord = await CaseRecord.findById(caseId).select(
      "patientId assignedDoctorId",
    );
    if (!caseRecord) return { error: "Case not found." };
    if (caseRecord.assignedDoctorId?.toString() !== req.user.id) {
      return { error: "You are not assigned to this case." };
    }
    return { patientId: caseRecord.patientId };
  }

  return { patientId: req.user.id };
};

export const getMetrics = async (req, res) => {
  try {
    const scope = await resolvePatientScope(req);
    if (scope.error) return res.status(403).json({ message: scope.error });

    const metrics = await Observation.aggregate([
      { $match: { patientId: toObjectId(scope.patientId) } },
      {
        $group: {
          _id: "$metricCode",
          metricName: { $first: "$metricName" },
          unit: { $first: "$unit" },
          count: { $sum: 1 },
          latest: { $max: "$observationDate" },
          anyAbnormal: { $max: { $cond: ["$isAbnormal", 1, 0] } },
        },
      },
      { $sort: { latest: -1 } },
      {
        $project: {
          _id: 0,
          metricCode: "$_id",
          metricName: 1,
          unit: 1,
          count: 1,
          latest: 1,
          anyAbnormal: { $eq: ["$anyAbnormal", 1] },
        },
      },
    ]);

    res.status(200).json(metrics);
  } catch (error) {
    console.error("Metrics Error:", error?.message || error);
    res.status(500).json({ message: "Error fetching metrics." });
  }
};

export const getTrends = async (req, res) => {
  try {
    const scope = await resolvePatientScope(req);
    if (scope.error) return res.status(403).json({ message: scope.error });

    const { metric } = req.query;
    if (!metric) {
      return res.status(400).json({ message: "metric is required." });
    }

    const days = Math.min(parseInt(req.query.days, 10) || 180, 3650);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const trend = await Observation.aggregate([
      {
        $match: {
          patientId: toObjectId(scope.patientId),
          metricCode: metric,
          observationDate: { $gte: startDate },
        },
      },
      { $sort: { observationDate: 1 } },
      {
        $project: {
          _id: 0,
          date: { $dateToString: { format: "%Y-%m-%d", date: "$observationDate" } },
          value: 1,
          unit: 1,
          referenceRange: 1,
          isAbnormal: 1,
        },
      },
    ]);

    res.status(200).json(trend);
  } catch (error) {
    console.error("Trends Error:", error?.message || error);
    res.status(500).json({ message: "Error fetching trends." });
  }
};

export const getTimeline = async (req, res) => {
  try {
    const scope = await resolvePatientScope(req);
    if (scope.error) return res.status(403).json({ message: scope.error });

    const cases = await CaseRecord.find({ patientId: scope.patientId })
      .sort({ createdAt: -1 })
      .select(
        "createdAt status priority ayushMode ocrData.documentType ocrData.date ocrData.labValues finalSummary.chiefComplaint",
      );

    const timeline = cases.map((c) => ({
      caseId: c._id,
      date: c.ocrData?.date?.value || c.createdAt,
      createdAt: c.createdAt,
      status: c.status,
      priority: c.priority,
      ayushMode: c.ayushMode,
      documentType: c.ocrData?.documentType || null,
      chiefComplaint: c.finalSummary?.chiefComplaint || null,
      labCount: Array.isArray(c.ocrData?.labValues)
        ? c.ocrData.labValues.length
        : 0,
      abnormalCount: Array.isArray(c.ocrData?.labValues)
        ? c.ocrData.labValues.filter((lab) =>
            isValueAbnormal(lab?.value, lab?.referenceRange),
          ).length
        : 0,
    }));

    res.status(200).json(timeline);
  } catch (error) {
    console.error("Timeline Error:", error?.message || error);
    res.status(500).json({ message: "Error fetching timeline." });
  }
};
