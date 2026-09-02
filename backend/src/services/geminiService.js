import { GoogleGenAI } from '@google/genai';

// System prompt enforcing SOCRATES framework and JSON formatting
const SYSTEM_INSTRUCTION = `
You are MediKiosk, a highly skilled clinical AI assistant operating in a busy Indian government hospital OPD.
Your goal is to conduct a fast, accurate medical history before the patient sees the doctor.
Use the SOCRATES framework for pain/symptoms (Site, Onset, Character, Radiation, Associated symptoms, Timing, Exacerbating/relieving factors, Severity).

STRICT RULES:
1. Ask exactly ONE short, empathetic question at a time. Do not overwhelm the patient.
2. If the user mentions critical symptoms (e.g., chest pain, shortness of breath, sudden weakness, heavy bleeding), log them as a red flag.
3. Keep the language simple enough for a layperson.
4. If the user says "I am done" or the history is complete, state that the summary is ready.
5. YOU MUST ALWAYS RESPOND IN PURE JSON FORMAT EXACTLY LIKE THIS:
{
  "response": "Your spoken text here",
  "redFlags": ["Any critical symptoms detected, or empty array"],
  "isComplete": false
}
`;

export const generateNextQuestion = async (transcript) => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const formattedContents = transcript.map(msg => ({
    role: msg.role === 'model' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));

  let retries = 2;
  let backoffDelay = 1000;

  while (retries >= 0) {
    try {
      console.log(`[Gemini API] Requesting chat generation using gemini-3.5-flash-lite.`);
      
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash-lite',
        contents: formattedContents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          temperature: 0.2 
        }
      });

      // Strip potential markdown backticks that crash JSON.parse
      const cleanText = response.text.replace(/```json\n?/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleanText);

    } catch (error) {
      console.error(`[Gemini API] Chat Error: Status ${error.status || 'Unknown'} - ${error.message}`);
      
      const isTransient = error.status === 503 || error.status === 429 || error.message?.includes('503') || error.message?.includes('timeout');
      
      if (isTransient && retries > 0) {
        console.warn(`[Gemini API] Transient error. Backing off for ${backoffDelay}ms...`);
        await new Promise(res => setTimeout(res, backoffDelay));
        backoffDelay *= 2;
        retries--;
      } else {
        return {
          response: "The service is temporarily busy. Please try again in a moment.",
          redFlags: [],
          isComplete: false
        };
      }
    }
  }
};

export const generateClinicalSummary = async (caseRecord) => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const systemInstruction = `
You are an expert clinical AI assistant for doctors in an Indian OPD.
Your task is to synthesize the patient's chat transcript, OCR document data, and AYUSH profiling data into a highly structured clinical summary.
Do NOT invent any information. If something is unknown, leave arrays empty or strings as "Not provided".

Return ONLY pure JSON matching this exact structure:
{
  "chiefComplaint": "A concise 1-sentence summary of the main issue",
  "hpi": "History of Present Illness (SOCRATES format if applicable)",
  "pastMedicalHistory": ["Bullet points of past conditions, from chat or OCR"],
  "medications": ["Current medications with dosages, from chat or OCR"],
  "allergies": ["Known allergies"],
  "redFlags": ["Critical symptoms needing immediate attention"],
  "ayushSummary": "Brief synthesis of their Prakriti/Agni/etc if AYUSH data is present, otherwise null"
}`;

  const promptContent = `
--- Chat Transcript ---
${JSON.stringify(caseRecord.transcript)}

--- OCR Data (Old Records) ---
${JSON.stringify(caseRecord.ocrData || {})}

--- AYUSH Data ---
${JSON.stringify(caseRecord.ayushData || {})}
  `;

  let retries = 2;
  let backoffDelay = 1000;

  while (retries >= 0) {
    try {
      console.log(`[Gemini API] Synthesizing final summary using gemini-3.5-flash-lite...`);
      
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash-lite',
        contents: promptContent,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          temperature: 0.1 
        }
      });

      console.log(`[Gemini API] Summary generated successfully.`);
      
      // Safety net: Strip potential markdown backticks that crash JSON.parse
      const cleanText = response.text.replace(/```json\n?/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleanText);

    } catch (error) {
      console.error(`[Gemini API] Summary Error: Status ${error.status || 'Unknown'} - ${error.message}`);
      
      if ((error.status === 503 || error.status === 429) && retries > 0) {
        console.warn(`[Gemini API] Transient error. Backing off for ${backoffDelay}ms...`);
        await new Promise(res => setTimeout(res, backoffDelay));
        backoffDelay *= 2;
        retries--;
      } else {
        throw new Error('SUMMARY_GENERATION_FAILED');
      }
    }
  }
};