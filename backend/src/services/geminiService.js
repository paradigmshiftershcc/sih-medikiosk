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
  // Initialize the CURRENT official SDK client
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  // Format history for the new SDK (role must be 'user' or 'model')
  const formattedContents = transcript.map(msg => ({
    role: msg.role === 'model' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));

  let retries = 2; // Bounded
  let backoffDelay = 1000;

  while (retries >= 0) {
    try {
      console.log(`[Gemini API] Requesting generation using gemini-3.5-flash-lite. Retries left: ${retries}`);
      
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash-lite',
        contents: formattedContents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          temperature: 0.2 
        }
      });

      console.log(`[Gemini API] Success. Raw text received length: ${response.text?.length}`);
      const textResponse = response.text;
      return JSON.parse(textResponse);

    } catch (error) {
      console.error(`[Gemini API] Error caught: Status ${error.status || 'Unknown'} - ${error.message}`);
      
      const isTransient = error.status === 503 || error.status === 429 || error.message?.includes('503') || error.message?.includes('timeout');
      
      if (isTransient && retries > 0) {
        console.warn(`[Gemini API] Transient error. Backing off for ${backoffDelay}ms...`);
        await new Promise(res => setTimeout(res, backoffDelay));
        backoffDelay *= 2;
        retries--;
      } else {
        console.error("[Gemini API] Final Error after retries or non-transient error.");
        // Graceful conversational fallback
        return {
          response: "The service is temporarily busy. Please try again in a moment.",
          redFlags: [],
          isComplete: false
        };
      }
    }
  }
};