import CaseRecord from '../models/CaseRecord.js';
import { generateNextQuestion } from '../services/geminiService.js';

export const processChatTurn = async (req, res) => {
  try {
    const { caseId, message } = req.body;
    const patientId = req.user.id; // From auth middleware (we'll implement the middleware shortly, for now we mock it if needed. Actually we attached it in login.)
    
    // If no caseId, create a new case record.
    let caseRecord;
    if (!caseId) {
      caseRecord = await CaseRecord.create({
        patientId,
        transcript: [{ role: 'user', content: message }]
      });
    } else {
      caseRecord = await CaseRecord.findById(caseId);
      if (!caseRecord) return res.status(404).json({ message: 'Case not found' });
      caseRecord.transcript.push({ role: 'user', content: message });
    }

    // Get AI response based on the updated transcript
    const aiData = await generateNextQuestion(caseRecord.transcript);
    
    // Update DB with AI's response and any red flags detected
    caseRecord.transcript.push({ role: 'model', content: aiData.response });
    
    // Merge new red flags without duplicates
    if (aiData.redFlags && aiData.redFlags.length > 0) {
      const uniqueFlags = new Set([...caseRecord.redFlags, ...aiData.redFlags]);
      caseRecord.redFlags = Array.from(uniqueFlags);
    }

    if (aiData.isComplete) {
      caseRecord.status = 'COMPLETED';
    }

    await caseRecord.save();

    res.status(200).json({
      caseId: caseRecord._id,
      response: aiData.response,
      redFlags: caseRecord.redFlags,
      isComplete: aiData.isComplete
    });

  } catch (error) {
    console.error("Chat Turn Error:", error);
    res.status(500).json({ message: 'Error processing conversation.' });
  }
};