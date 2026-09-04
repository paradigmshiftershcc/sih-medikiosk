import { GoogleGenAI } from '@google/genai';

const MODEL = 'gemini-3.1-flash-lite';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isTransientError = (error) => (
  error?.status === 429 ||
  error?.status === 503 ||
  error?.status === 504 ||
  /429|503|504|timeout|timed out|temporar/i.test(error?.message || '')
);

const parseJsonResponse = (text) => {
  if (!text || typeof text !== 'string') {
    throw new Error('EMPTY_OCR_RESPONSE');
  }

  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  return JSON.parse(cleaned);
};

const OCR_SCHEMA = {
  type: 'object',
  properties: {
    documentType: {
      type: 'string'
    },
    patientName: {
      type: 'object',
      properties: {
        value: { type: 'string' },
        confidence: { type: 'string' }
      },
      required: ['value', 'confidence']
    },
    date: {
      type: 'object',
      properties: {
        value: { type: 'string' },
        confidence: { type: 'string' }
      },
      required: ['value', 'confidence']
    },
    medicines: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          strength: { type: 'string' },
          dosage: { type: 'string' },
          frequency: { type: 'string' },
          duration: { type: 'string' },
          confidence: { type: 'string' }
        },
        required: [
          'name',
          'strength',
          'dosage',
          'frequency',
          'duration',
          'confidence'
        ]
      }
    },
    labValues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          test: { type: 'string' },
          value: { type: 'string' },
          unit: { type: 'string' },
          referenceRange: { type: 'string' },
          confidence: { type: 'string' }
        },
        required: [
          'test',
          'value',
          'unit',
          'referenceRange',
          'confidence'
        ]
      }
    },
    allergies: {
      type: 'array',
      items: { type: 'string' }
    },
    conditions: {
      type: 'array',
      items: { type: 'string' }
    },
    notes: {
      type: 'array',
      items: { type: 'string' }
    },
    unclearItems: {
      type: 'array',
      items: { type: 'string' }
    },
    overallConfidence: {
      type: 'string'
    },
    reviewRequired: {
      type: 'boolean'
    }
  },
  required: [
    'documentType',
    'patientName',
    'date',
    'medicines',
    'labValues',
    'allergies',
    'conditions',
    'notes',
    'unclearItems',
    'overallConfidence',
    'reviewRequired'
  ]
};

const SYSTEM_PROMPT = `
You are MediKiosk's strict medical document extraction engine.

YOUR ONLY TASK:
Extract information that is visibly supported by the provided document.

You are NOT:
- a diagnostic tool
- a clinician
- a treatment recommendation engine

SAFETY RULES:

1. NEVER invent or guess information.
2. NEVER infer a medical condition from a lab value.
3. NEVER invent a medication, strength, dosage, frequency or duration.
4. NEVER infer a lab unit.
5. If a value is not readable, leave value as "" and add a precise item to unclearItems.
6. If a value is visibly blank on the source, keep it blank. Do not turn blank into "0".
7. Do not confuse the UNIT OF THE RESULT with the UNIT OF THE REFERENCE RANGE.
8. A measurement and its reference range are separate fields.
9. Preserve numbers exactly as visible.
10. Preserve decimal precision as visible.
11. Do not calculate derived values.
12. Do not convert units.
13. Do not diagnose whether a value is normal or abnormal.
14. Do not turn report comments into diagnoses.
15. Only populate allergies when explicitly stated.
16. Only populate conditions when explicitly stated in the document.
17. Confidence must reflect visual certainty, not whether the value seems medically plausible.
18. Use:
   high = clearly legible
   medium = readable but some ambiguity
   low = uncertain / partially illegible
19. If any important field is uncertain, reviewRequired should be true.
20. Return only the requested structured JSON.

IMPORTANT LAB RULE:

Example:

If the document says:

Platelet Count: 205000 /cmm
Reference Range: 1.5-4.5 Lac/cmm

then:

value = "205000"
unit = "/cmm"
referenceRange = "1.5-4.5 Lac/cmm"

Do NOT copy "Lac/cmm" into unit.

IMPORTANT MEDICATION RULE:

If handwriting is unclear, do not replace it with the name of a medicine that merely looks similar.

IMPORTANT:
The output will be used to help a doctor review the original document.
The original document remains the authoritative source.
`;

const normalizeResult = (result) => ({
  documentType: result?.documentType || 'Unknown',

  patientName: {
    value: result?.patientName?.value || '',
    confidence: result?.patientName?.confidence || 'low'
  },

  date: {
    value: result?.date?.value || '',
    confidence: result?.date?.confidence || 'low'
  },

  medicines: Array.isArray(result?.medicines)
    ? result.medicines
    : [],

  labValues: Array.isArray(result?.labValues)
    ? result.labValues
    : [],

  allergies: Array.isArray(result?.allergies)
    ? result.allergies.filter(Boolean)
    : [],

  conditions: Array.isArray(result?.conditions)
    ? result.conditions.filter(Boolean)
    : [],

  notes: Array.isArray(result?.notes)
    ? result.notes.filter(Boolean)
    : [],

  unclearItems: Array.isArray(result?.unclearItems)
    ? result.unclearItems.filter(Boolean)
    : [],

  overallConfidence: result?.overallConfidence || 'medium',

  reviewRequired:
    result?.reviewRequired !== false
});

export const processDocumentImage = async (base64Data, mimeType) => {
  if (!base64Data || !mimeType?.startsWith('image/')) {
    throw new Error('INVALID_DOCUMENT_IMAGE');
  }

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
  });

  const cleanBase64 = base64Data.replace(
    /^data:[^;]+;base64,/i,
    ''
  );

  let attemptsLeft = 1;
  let delay = 1000;

  while (true) {
    try {
      console.log(
        `[OCR Service] Requesting structured extraction with ${MODEL}.`
      );

      const response = await ai.models.generateContent({
        model: MODEL,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  data: cleanBase64,
                  mimeType
                }
              },
              {
                text:
                  'Extract the medical information from this document using the strict extraction rules.'
              }
            ]
          }
        ],
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: 'application/json',
          responseSchema: OCR_SCHEMA,
          thinkingConfig: {
            thinkingLevel: 'low'
          }
        }
      });

      const parsed = parseJsonResponse(response.text);
      const result = normalizeResult(parsed);

      console.log('[OCR Service] Structured extraction successful.');

      return result;
    } catch (error) {
      console.error(
        `[OCR Service] Error: ${error.status || 'Unknown'} - ${error.message}`
      );

      if (isTransientError(error) && attemptsLeft > 0) {
        console.warn(
          `[OCR Service] Transient error. Retrying in ${delay}ms...`
        );

        await sleep(delay);
        attemptsLeft -= 1;
        continue;
      }

      throw new Error('DOCUMENT_PROCESSING_FAILED');
    }
  }
};