import axios from 'axios';

// Current Official Documentation: Bhashini Dhruva Inference API requires an array of pipelineTasks.
// We are implementing the exact JSON structures required by the platform.

const BHASHINI_INFERENCE_URL = 'https://dhruva-api.bhashini.gov.in/services/inference/pipeline';

const getHeaders = () => {
  return {
    'Content-Type': 'application/json',
    'Authorization': process.env.BHASHINI_API_KEY,
    'userID': process.env.BHASHINI_USER_ID
  };
};

// Placeholder values must never count as configured credentials.
const PLACEHOLDER_VALUES = new Set([
  "...",
  "xxx",
  "test",
  "placeholder",
  "changeme",
  "todo",
  "none",
  "null",
]);

const looksConfigured = (value) => {
  const trimmed = String(value || "").trim();
  if (trimmed.length < 4) return false;
  return !PLACEHOLDER_VALUES.has(trimmed.toLowerCase());
};

// Check if Bhashini is configured
const isConfigured = () => {
  return (
    looksConfigured(process.env.BHASHINI_API_KEY) &&
    looksConfigured(process.env.BHASHINI_PIPELINE_ID)
  );
};

// Public availability check for the provider-agnostic transcription layer.
// Bhashini onboarding is still pending, so it is strictly opt-in: it is only
// attempted when BHASHINI_ENABLED=true AND real credentials are present.
// Otherwise the voice layer skips Bhashini completely (no 401 attempts)
// and uses Gemini Transcribe directly.
export const isBhashiniAvailable = () => {
  if (String(process.env.BHASHINI_ENABLED || "").toLowerCase() !== "true") {
    return false;
  }
  return Boolean(isConfigured());
};

export const speechToEnglishText = async (base64Audio, sourceLang = 'hi') => {
  if (!isConfigured()) {
    console.warn('[Bhashini] API keys missing. Bypassing ASR and simulating English fallback.');
    return "I am experiencing pain. (Simulated fallback text)";
  }

  try {
    const payload = {
      pipelineTasks: [
        {
          taskType: "asr",
          config: { language: { sourceLanguage: sourceLang } }
        },
        {
          taskType: "translation",
          config: { language: { sourceLanguage: sourceLang, targetLanguage: "en" } }
        }
      ],
      inputData: {
        audio: [{ audioContent: base64Audio }]
      }
    };

    const response = await axios.post(BHASHINI_INFERENCE_URL, payload, { headers: getHeaders() });
    
    // Extract translated text from the final task output
    const translationOutput = response.data.pipelineResponse.find(r => r.taskType === 'translation');
    return translationOutput.output[0].target;

  } catch (error) {
    console.error('[Bhashini ASR Error]', error?.message || error);
    throw new Error('BHASHINI_ASR_FAILED');
  }
};

export const englishTextToSpeech = async (englishText, targetLang = 'hi') => {
  if (!isConfigured()) {
    console.warn('[Bhashini] API keys missing. Bypassing TTS and returning English text only.');
    return { text: englishText, audioBase64: null };
  }

  try {
    const payload = {
      pipelineTasks: [
        {
          taskType: "translation",
          config: { language: { sourceLanguage: "en", targetLanguage: targetLang } }
        },
        {
          taskType: "tts",
          config: { language: { sourceLanguage: targetLang } }
        }
      ],
      inputData: {
        input: [{ source: englishText }]
      }
    };

    const response = await axios.post(BHASHINI_INFERENCE_URL, payload, { headers: getHeaders() });
    
    const translationTask = response.data.pipelineResponse.find(r => r.taskType === 'translation');
    const ttsTask = response.data.pipelineResponse.find(r => r.taskType === 'tts');
    
    return {
      text: translationTask.output[0].target,
      audioBase64: ttsTask.audio[0].audioContent
    };

  } catch (error) {
    console.error('[Bhashini TTS Error]', error?.message || error);
    throw new Error('BHASHINI_TTS_FAILED');
  }
};