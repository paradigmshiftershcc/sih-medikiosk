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

// Check if Bhashini is configured
const isConfigured = () => {
  return process.env.BHASHINI_API_KEY && process.env.BHASHINI_PIPELINE_ID;
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
    console.error('[Bhashini ASR Error]', error.response?.data || error.message);
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
    console.error('[Bhashini TTS Error]', error.response?.data || error.message);
    throw new Error('BHASHINI_TTS_FAILED');
  }
};