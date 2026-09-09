import { useState, useEffect, useRef } from 'react';
import { Mic, Send, Volume2, AlertTriangle, Loader2, CheckCircle2, Globe } from 'lucide-react';
import { useSpeech } from '../../hooks/useSpeech';
import api from '../../services/api';

export default function ChatInterface({ onComplete }) {
  const [messages, setMessages] = useState([
    { role: 'model', content: 'Hello! I am your AI assistant. To help the doctor, could you tell me what brings you to the hospital today?' }
  ]);
  const [caseId, setCaseId] = useState(null);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [redFlags, setRedFlags] = useState([]);
  const [autoTTS, setAutoTTS] = useState(true);
  const [isHistoryComplete, setIsHistoryComplete] = useState(false);
  
  // Local language state (defaulting to English, togglable to Hindi)
  const [language, setLanguage] = useState('en');
  
  const chatEndRef = useRef(null);

  const { isListening, voiceStatus, voiceError, setVoiceStatus, setVoiceError, clearVoiceError, toggleRecording, playAudioBase64 } = useSpeech({
    onAudioReady: (base64, mimeType) => {
      // Transcribe only: the text goes into the input for patient review.
      // Nothing is submitted to the clinical chat until Send is pressed.
      transcribeVoiceInput(base64, mimeType);
    },
    onError: (err) => {
      setMessages(prev => [...prev, { role: 'model', content: err }]);
    }
  });

  // Voice transcription leg: audio -> editable text. No message bubble,
  // no database write, no clinical call. The input is left unchanged on
  // failure so the patient can keep typing.
  const transcribeVoiceInput = async (audioBase64, mimeType) => {
    setVoiceStatus('transcribing');
    clearVoiceError();
    try {
      const { data } = await api.post('/intake/transcribe', {
        audioBase64,
        mimeType,
        language
      }, {
        // Transcription-only leg: bounded wait, then text fallback.
        timeout: 45000
      });
      if (data?.text) {
        setInputText(data.text);
      } else {
        throw new Error('EMPTY_TRANSCRIPTION');
      }
    } catch (error) {
      setVoiceError(
        error.response?.data?.message ||
        'Voice transcription is temporarily unavailable. Please type your answer instead.'
      );
    } finally {
      setVoiceStatus('idle');
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Single path that submits a clinical chat turn: typed text, or
  // voice-transcribed text the patient has reviewed and chosen to send.
  const handleSendMessage = async (textOverride = null) => {
    const textToSend = textOverride || inputText.trim();

    // Require text to proceed
    if (!textToSend) return;

    // Display user message in UI
    setMessages(prev => [...prev, { role: 'user', content: textToSend }]);
    setInputText('');

    setIsLoading(true);

    try {
      const response = await api.post('/intake/chat', {
        caseId,
        message: textToSend,
        language
      }, {
        timeout: 20000
      });

      const { response: aiText, audioBase64: aiAudio, redFlags: currentFlags, caseId: newCaseId, isComplete } = response.data;
      
      if (!caseId) setCaseId(newCaseId);
      if (currentFlags?.length > 0) setRedFlags(currentFlags);
      if (isComplete) setIsHistoryComplete(true);

      setMessages(prev => [...prev, { role: 'model', content: aiText }]);
      
      // Play Bhashini Audio if returned and TTS is enabled
      if (autoTTS && aiAudio) {
        playAudioBase64(aiAudio);
      }

    } catch (error) {
      let errorMsg = "I'm sorry, I encountered a network error. Could you repeat that?";
      if (error.code === 'ECONNABORTED') {
        errorMsg = "The service is temporarily busy. Please try again in a moment.";
      }
      setMessages(prev => [...prev, { role: 'model', content: errorMsg }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[65vh] bg-white rounded-2xl shadow-sm border border-brand-100 overflow-hidden relative">
      
      {/* Header Area with Language Toggle */}
      <div className="bg-brand-50 px-4 py-3 border-b border-brand-100 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-brand-700 hidden sm:block">Consultation</h3>
          <div className="flex items-center bg-white border border-brand-200 rounded-lg p-1 shadow-sm">
            <Globe className="w-4 h-4 text-brand-500 mx-1" />
            <select 
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-transparent text-sm font-medium text-brand-800 focus:outline-none cursor-pointer pr-1"
            >
              <option value="en">English</option>
              <option value="hi">हिंदी (Hindi)</option>
              {/* Additional languages appear only after their Bhashini
                  pipelines are verified end-to-end. */}
            </select>
          </div>
        </div>
        <button 
          onClick={() => setAutoTTS(!autoTTS)}
          className={`p-2 rounded-full transition-colors ${autoTTS ? 'bg-brand-200 text-brand-800' : 'bg-gray-200 text-gray-500'}`}
          title="Toggle Audio Feedback"
        >
          <Volume2 className="w-5 h-5" />
        </button>
      </div>

      {redFlags.length > 0 && (
        <div className="bg-red-50 px-4 py-2 flex items-center gap-2 border-b border-red-100">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <p className="text-sm text-red-700 font-medium">
            Priority symptoms logged: {redFlags.join(', ')}
          </p>
        </div>
      )}

      {voiceError && (
        <div className="bg-orange-50 px-4 py-2 flex items-center gap-2 border-b border-orange-100">
          <AlertTriangle className="w-5 h-5 text-orange-500" />
          <p className="text-sm text-orange-700 font-medium">
            {voiceError}
          </p>
        </div>
      )}

      {/* Messages Window */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-4 py-3 sm:px-5 sm:py-3 shadow-sm ${
              msg.role === 'user' 
                ? 'bg-brand-600 text-white rounded-tr-none' 
                : 'bg-gray-100 text-gray-800 rounded-tl-none'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-500 rounded-2xl rounded-tl-none px-5 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> {voiceStatus === 'transcribing' ? 'Transcribing...' : 'Thinking...'}
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 sm:p-4 bg-white border-t border-brand-100 flex flex-col gap-3">
        <div className="flex items-center gap-2 sm:gap-3 max-w-3xl mx-auto w-full">
          
          {/* Toggle Mic: first click starts recording, second click stops */}
          <button
            onClick={toggleRecording}
            disabled={isLoading || voiceStatus === 'transcribing'}
            className={`p-3 sm:p-4 rounded-full flex-shrink-0 transition-all ${
              isListening 
                ? 'bg-red-100 text-red-600 animate-pulse shadow-inner' 
                : 'bg-brand-100 text-brand-600 hover:bg-brand-200 shadow-sm'
            }`}
            title={isListening ? "Stop recording" : "Start recording"}
          >
            <Mic className="w-6 h-6 sm:w-7 sm:h-7" />
          </button>
          
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder={isListening ? "Recording... Tap mic to stop" : voiceStatus === 'transcribing' ? "Transcribing..." : "Type your answer..."}
            disabled={isListening || voiceStatus === 'transcribing'}
            className="flex-1 min-w-0 py-3 px-3 sm:px-4 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-gray-50 text-base sm:text-lg"
          />
          
          <button
            onClick={() => handleSendMessage()}
            disabled={!inputText.trim() || isLoading}
            className="p-3 sm:p-4 bg-brand-600 text-white rounded-full flex-shrink-0 disabled:opacity-50 hover:bg-brand-700 transition-colors shadow-sm"
          >
            <Send className="w-5 h-5 sm:w-6 sm:h-6 sm:ml-1" />
          </button>
        </div>

        {/* Completion Action */}
        {(messages.length > 3 || isHistoryComplete) && (
          <div className="flex justify-center mt-2">
            <button 
              onClick={() => onComplete(caseId)}
              className="flex items-center gap-2 px-6 py-2 bg-green-100 text-green-700 font-medium rounded-xl hover:bg-green-200 transition-colors shadow-sm"
            >
              <CheckCircle2 className="w-5 h-5" />
              Finish History & Proceed
            </button>
          </div>
        )}
      </div>
    </div>
  );
}