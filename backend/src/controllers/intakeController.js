import CaseRecord from '../models/CaseRecord.js';
import { generateNextQuestion } from '../services/geminiService.js';

export const processChatTurn = async (req, res) => {
  console.log(`\n--- [Controller] Request received at /intake/chat ---`);
  try {
    const { caseId, message } = req.body;
    console.log(`[Controller] Payload: { caseId: ${caseId || 'NEW'}, messageLength: ${message?.length} }`);
    
    const patientId = req.user.id; 
    
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

    console.log(`[Controller] Handing over transcript to Gemini Service...`);
    const aiData = await generateNextQuestion(caseRecord.transcript);
    console.log(`[Controller] Gemini Service returned data successfully.`);
    
    caseRecord.transcript.push({ role: 'model', content: aiData.response });
    
    if (aiData.redFlags && aiData.redFlags.length > 0) {
      const uniqueFlags = new Set([...caseRecord.redFlags, ...aiData.redFlags]);
      caseRecord.redFlags = Array.from(uniqueFlags);
    }

    if (aiData.isComplete) {
      caseRecord.status = 'COMPLETED';
    }

    await caseRecord.save();

    console.log(`[Controller] Sending 200 OK to client.`);
    res.status(200).json({
      caseId: caseRecord._id,
      response: aiData.response,
      redFlags: caseRecord.redFlags,
      isComplete: aiData.isComplete
    });

  } catch (error) {
    console.error("[Controller] Caught Error:", error.message || error);
    res.status(500).json({ message: 'Error processing conversation.' });
  }
};

export const saveAyushData = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { ayushData } = req.body;

    const caseRecord = await CaseRecord.findById(caseId);
    if (!caseRecord) {
      return res.status(404).json({ message: 'Case not found' });
    }

    caseRecord.ayushMode = true;
    caseRecord.ayushData = ayushData;
    await caseRecord.save();

    res.status(200).json({ message: 'AYUSH data saved successfully', caseRecord });
  } catch (error) {
    console.error("[Controller] Save AYUSH Error:", error);
    res.status(500).json({ message: 'Error saving AYUSH data.' });
  }
};