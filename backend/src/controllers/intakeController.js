import CaseRecord from "../models/CaseRecord.js";
import { generateNextQuestion } from "../services/geminiService.js";
import {
  speechToEnglishText,
  englishTextToSpeech,
} from "../services/bhashiniService.js";

export const processChatTurn = async (req, res) => {
  try {
    // We now accept an optional audioBase64 string and language preference
    const { caseId, message, audioBase64, language = "en" } = req.body;
    const patientId = req.user.id;

    let englishInputText = message;

    if (audioBase64 && language !== "en") {
      try {
        englishInputText = await speechToEnglishText(audioBase64, language);
      } catch (err) {
        return res
          .status(502)
          .json({
            message: "Language service temporarily unavailable. Please type.",
          });
      }
    } else if (audioBase64 && language === "en") {
      // In a full production env, we'd route English audio through an English ASR here.
      // For this step, we assume the frontend fallback handled English STT via Web Speech.
      englishInputText = message;
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
    console.error("Chat Turn Error:", error);
    res.status(500).json({ message: "Error processing conversation." });
  }
};

export const saveAyushData = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { ayushData } = req.body;

    const caseRecord = await CaseRecord.findById(caseId);
    if (!caseRecord) return res.status(404).json({ message: "Case not found" });

    caseRecord.ayushMode = true;
    caseRecord.ayushData = ayushData;
    await caseRecord.save();

    res
      .status(200)
      .json({ message: "AYUSH data saved successfully", caseRecord });
  } catch (error) {
    console.error("Save AYUSH Error:", error);
    res.status(500).json({ message: "Error saving AYUSH data." });
  }
};

export const getPatientHistory = async (req, res) => {
  try {
    const cases = await CaseRecord.find({ patientId: req.user.id })
      .select("createdAt status redFlags ayushMode finalSummary.chiefComplaint")
      .sort({ createdAt: -1 });

    res.status(200).json(cases);
  } catch (error) {
    console.error("History Fetch Error:", error);
    res.status(500).json({ message: "Error fetching patient history." });
  }
};
