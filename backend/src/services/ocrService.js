import { GoogleGenAI } from '@google/genai';

const SYSTEM_PROMPT = `
You are MediKiosk's strict medical document extraction AI.
Your ONLY task is INFORMATION EXTRACTION. You are NOT a diagnostic tool.

STRICT MEDICAL SAFETY RULES:
1. NEVER invent, guess, or infer information that is not explicitly visible in the document.
2. NEVER guess a medicine name, dosage, or frequency if the handwriting is unclear.
3. NEVER assume a lab unit if it is missing.
4. If a word or value is illegible or uncertain, preserve the uncertainty. Write "Unable to read" and set confidence to "low".
5. Extract data precisely as written. Do not "correct" spelling unless it is an obvious typo of a known standard medical term and clearly readable.

You must ALWAYS return pure JSON exactly matching this structure (use empty strings/arrays if not found):
{
  "documentType": "e.g., Prescription, Lab Report, Discharge Summary, Unknown",
  "patientName": { "value": "", "confidence": "high|medium|low" },
  "date": { "value": "", "confidence": "high|medium|low" },
  "medicines": [
    { "name": "", "strength": "", "dosage": "", "frequency": "", "duration": "", "confidence": "high|medium|low" }
  ],
  "labValues": [
    { "test": "", "value": "", "unit": "", "referenceRange": "", "confidence": "high|medium|low" }
  ],
  "allergies": [""],
  "conditions": [""],
  "notes": ["Any other critical medical warnings or instructions explicitly written"],
  "unclearItems": ["List specific things you tried to read but couldn't (e.g., 'Third medication name is illegible')"]
}
`;

export const processDocumentImage = async (base64Data, mimeType) => {
  // Initialize the CURRENT official SDK client
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  // Strip the Data URL prefix if present (e.g., "data:image/jpeg;base64,")
  const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');

  let retries = 1;
  let delay = 1000;

  while (retries >= 0) {
    try {
      console.log(`[OCR Service] Requesting extraction using gemini-3.5-flash-lite...`);
      
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash-lite',
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { data: cleanBase64, mimeType } },
              { text: "Extract structured medical information from this document following the strict JSON rules." }
            ]
          }
        ],
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
          temperature: 0.1 // Low temperature for factual extraction
        }
      });

      console.log(`[OCR Service] Success. Validating JSON...`);
      return JSON.parse(response.text);

    } catch (error) {
      console.error(`[OCR Service] Error: ${error.status || 'Unknown'} - ${error.message}`);
      if ((error.status === 503 || error.status === 429) && retries > 0) {
        console.warn(`[OCR Service] Transient error, retrying in ${delay}ms...`);
        await new Promise(res => setTimeout(res, delay));
        retries--;
      } else {
        throw new Error('DOCUMENT_PROCESSING_FAILED');
      }
    }
  }
};