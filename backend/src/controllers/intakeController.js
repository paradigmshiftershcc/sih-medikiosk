import CaseRecord from "../models/CaseRecord.js";
import Doctor from "../models/Doctor.js";
import {
  generateNextQuestion,
  generateClinicalSummary,
} from "../services/geminiService.js";
import { englishTextToSpeech } from "../services/bhashiniService.js";
import { transcribeAudio } from "../services/transcriptionService.js";

export const processChatTurn = async (req, res) => {
  try {
    // Voice input arrives as server-transcribed text via the provider-agnostic
    // transcription layer (Bhashini primary, Gemini Transcribe fallback).
    // From here on the clinical pipeline treats it exactly like typed text.
    const { caseId, message, audioBase64, mimeType, language = "en" } = req.body;
    const patientId = req.user.id;

    let englishInputText = message;

    if (audioBase64) {
      try {
        const result = await transcribeAudio({
          audioBase64,
          mimeType,
          language,
        });
        englishInputText = result.text;
      } catch (err) {
        return res.status(502).json({
          message:
            "Voice transcription is temporarily unavailable. Please type your answer instead.",
        });
      }
    }

    if (!englishInputText) {
      return res.status(400).json({ message: "No input provided." });
    }

    // Initialize or fetch case
    let caseRecord;
    if (!caseId) {
      caseRecord = await CaseRecord.create({
        patientId,
        transcript: [{ role: "user", content: englishInputText }],
      });
    } else {
      caseRecord = await CaseRecord.findById(caseId);
      if (!caseRecord)
        return res.status(404).json({ message: "Case not found" });
      if (caseRecord.patientId.toString() !== patientId) {
        return res
          .status(403)
          .json({ message: "Unauthorized access to case." });
      }
      caseRecord.transcript.push({ role: "user", content: englishInputText });
    }

    const aiData = await generateNextQuestion(caseRecord.transcript);

    caseRecord.transcript.push({ role: "model", content: aiData.response });

    if (aiData.redFlags && aiData.redFlags.length > 0) {
      const uniqueFlags = new Set([...caseRecord.redFlags, ...aiData.redFlags]);
      caseRecord.redFlags = Array.from(uniqueFlags);
    }

    if (aiData.isComplete) {
      caseRecord.status = "COMPLETED";
    }

    await caseRecord.save();

    let finalResponseText = aiData.response;
    let finalAudioBase64 = null;

    if (language !== "en") {
      try {
        const bhashiniOutput = await englishTextToSpeech(
          aiData.response,
          language,
        );
        finalResponseText = bhashiniOutput.text;
        finalAudioBase64 = bhashiniOutput.audioBase64;
      } catch (err) {
        console.error(
          "Failed to translate/TTS response. Falling back to English text.",
        );
      }
    }

    res.status(200).json({
      caseId: caseRecord._id,
      response: finalResponseText,
      audioBase64: finalAudioBase64,
      redFlags: caseRecord.redFlags,
      isComplete: aiData.isComplete,
    });
  } catch (error) {
    console.error("Chat Turn Error:", error?.message || error);
    res.status(500).json({ message: "Error processing conversation." });
  }
};

export const transcribeVoice = async (req, res) => {
  try {
    // Transcription-only: converts voice to text for patient review.
    // Creates no case, writes nothing to MongoDB, and never touches the
    // clinical pipeline. The frontend places the text in the chat input;
    // only an explicit Send submits a clinical chat turn.
    const { audioBase64, mimeType, language = "en" } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ message: "No audio provided." });
    }
    try {
      const result = await transcribeAudio({
        audioBase64,
        mimeType,
        language,
      });
      return res
        .status(200)
        .json({ text: result.text, language: result.language });
    } catch (err) {
      return res.status(503).json({
        message:
          "Voice transcription is temporarily unavailable. Please type your answer instead.",
      });
    }
  } catch (error) {
    console.error("Transcription Error:", error?.message || error);
    return res.status(503).json({
      message:
        "Voice transcription is temporarily unavailable. Please type your answer instead.",
    });
  }
};

export const saveAyushData = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { ayushData } = req.body;

    const caseRecord = await CaseRecord.findById(caseId);
    if (!caseRecord) return res.status(404).json({ message: "Case not found" });
    if (caseRecord.patientId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized access to case." });
    }

    caseRecord.ayushMode = true;
    caseRecord.ayushData = ayushData;
    await caseRecord.save();

    res
      .status(200)
      .json({ message: "AYUSH data saved successfully", caseRecord });
  } catch (error) {
    console.error("Save AYUSH Error:", error?.message || error);
    res.status(500).json({ message: "Error saving AYUSH data." });
  }
};

export const getPatientHistory = async (req, res) => {
  try {
    const cases = await CaseRecord.find({ patientId: req.user.id })
      .select(
        "createdAt status redFlags ayushMode finalSummary.chiefComplaint assignedDoctorId priority",
      )
      .populate("assignedDoctorId", "name specialty")
      .sort({ createdAt: -1 });

    res.status(200).json(cases);
  } catch (error) {
    console.error("History Fetch Error:", error?.message || error);
    res.status(500).json({ message: "Error fetching patient history." });
  }
};

export const completeCaseAndAssign = async (req, res) => {
  try {
    const { caseId } = req.params;
    const patientId = req.user.id;

    const caseRecord = await CaseRecord.findById(caseId);

    if (!caseRecord) {
      return res.status(404).json({ message: "Case not found." });
    }

    if (caseRecord.patientId.toString() !== patientId) {
      return res.status(403).json({ message: "Unauthorized access to case." });
    }

    // 1. Generate Summary NOW (before doctor sees it)
    if (!caseRecord.finalSummary) {
      try {
        const summary = await generateClinicalSummary(caseRecord);
        caseRecord.finalSummary = summary;
      } catch (summaryError) {
        console.error(
          "Summary generation failed:",
          summaryError?.message || summaryError,
        );
        return res
          .status(500)
          .json({
            message: "Failed to generate clinical summary. Please try again.",
          });
      }
    }

    // 2. Deterministic Recommendation Engine
    let assignedSpecialty = "General Medicine";
    let priority = "ROUTINE";
    let assignmentReason = "Standard routing.";

    if (caseRecord.ayushMode) {
      assignedSpecialty = "Ayurveda";
      assignmentReason = "Patient requested AYUSH consultation.";
    } else if (caseRecord.redFlags && caseRecord.redFlags.length > 0) {
      priority = "URGENT_REVIEW";
      assignmentReason = "Critical red flags detected.";
      // Route to Cardio or Gen Med based on flags (simplified rule)
      if (caseRecord.redFlags.some((f) => f.toLowerCase().includes("chest"))) {
        assignedSpecialty = "Cardiology";
      }
    } else if (caseRecord.finalSummary?.chiefComplaint) {
      const cc = caseRecord.finalSummary.chiefComplaint.toLowerCase();
      if (
        cc.includes("bone") ||
        cc.includes("joint") ||
        cc.includes("fracture")
      )
        assignedSpecialty = "Orthopedics";
      else if (
        cc.includes("skin") ||
        cc.includes("rash") ||
        cc.includes("dermat")
      )
        assignedSpecialty = "Dermatology";
    }

    // 3. Find Doctor in DB - first try the specialty, then fallback to General Medicine, then any doctor
    let doctor = await Doctor.findOne({ specialty: assignedSpecialty });

    if (!doctor) {
      doctor = await Doctor.findOne({ specialty: "General Medicine" });
    }

    if (!doctor) {
      doctor = await Doctor.findOne();
    }

    if (!doctor) {
      return res
        .status(500)
        .json({
          message:
            "No doctors available for assignment. Please try again later.",
        });
    }

    // 4. Assign the case
    caseRecord.assignedDoctorId = doctor._id;
    caseRecord.status = "ASSIGNED";
    caseRecord.priority = priority;
    caseRecord.assignmentReason = assignmentReason;
    caseRecord.assignedAt = new Date();
    await caseRecord.save();

    res.status(200).json({
      message: "Case completed and assigned.",
      caseId: caseRecord._id,
      assignedDoctor: doctor.name,
      specialty: doctor.specialty,
      priority,
      status: "ASSIGNED",
    });
  } catch (error) {
    console.error("Completion Error:", error?.message || error);
    res.status(500).json({ message: "Error finalizing case." });
  }
};
