import { useState, useEffect, useRef } from "react";
import {
  Mic,
  Send,
  Volume2,
  AlertTriangle,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { useSpeech } from "../../hooks/useSpeech";
import api from "../../services/api";

export default function ChatInterface({ onComplete }) {
  const [messages, setMessages] = useState([
    {
      role: "model",
      content:
        "Hello! I am your AI assistant. To help the doctor, could you tell me what brings you to the hospital today?",
    },
  ]);
  const [caseId, setCaseId] = useState(null);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [redFlags, setRedFlags] = useState([]);
  const [autoTTS, setAutoTTS] = useState(true);
  const [isHistoryComplete, setIsHistoryComplete] = useState(false);

  const chatEndRef = useRef(null);
  const { isListening, isSupported, startListening, stopListening, speakText } =
    useSpeech({
      onTranscript: (text) => setInputText(text),
    });

  // Auto-scroll to latest message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (textOverride = null) => {
    const textToSend = textOverride || inputText.trim();
    if (!textToSend) return;

    if (isListening) stopListening();

    // Add user message to UI immediately
    const userMsg = { role: "user", content: textToSend };
    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsLoading(true);

    try {
      const response = await api.post(
        "/intake/chat",
        {
          caseId,
          message: textToSend,
        },
        {
          timeout: 15000, // 15-second strict timeout. Never hang forever.
        },
      );

      const {
        response: aiText,
        redFlags: currentFlags,
        caseId: newCaseId,
      } = response.data;

      if (!caseId) setCaseId(newCaseId);
      if (currentFlags?.length > 0) setRedFlags(currentFlags);

      // If backend AI marks conversation as complete
      if (response.data.isComplete) {
        setIsHistoryComplete(true);
      }

      setMessages((prev) => [...prev, { role: "model", content: aiText }]);

      if (autoTTS) speakText(aiText);
    } catch (error) {
      console.error("Chat error:", error);
      let errorMsg =
        "I'm sorry, I encountered a network error. Could you repeat that?";
      if (error.code === "ECONNABORTED") {
        errorMsg =
          "The service is temporarily busy. Please try again in a moment.";
      }
      setMessages((prev) => [...prev, { role: "model", content: errorMsg }]);
    } finally {
      setIsLoading(false); // GUARANTEED EXIT STATE
    }
  };

  return (
    <div className="flex flex-col h-[65vh] bg-white rounded-2xl shadow-sm border border-brand-100 overflow-hidden relative">
      {/* Header Area */}
      <div className="bg-brand-50 px-4 py-3 border-b border-brand-100 flex justify-between items-center">
        <h3 className="font-semibold text-brand-700">Consultation Interview</h3>
        <button
          onClick={() => setAutoTTS(!autoTTS)}
          className={`p-2 rounded-full transition-colors ${autoTTS ? "bg-brand-200 text-brand-800" : "bg-gray-200 text-gray-500"}`}
          title="Toggle Audio Feedback"
        >
          <Volume2 className="w-5 h-5" />
        </button>
      </div>

      {/* Red Flags Banner */}
      {redFlags.length > 0 && (
        <div className="bg-red-50 px-4 py-2 flex items-center gap-2 border-b border-red-100">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <p className="text-sm text-red-700 font-medium">
            Priority symptoms logged: {redFlags.join(", ")}
          </p>
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-4 py-3 sm:px-5 sm:py-3 shadow-sm ${
                msg.role === "user"
                  ? "bg-brand-600 text-white rounded-tr-none"
                  : "bg-gray-100 text-gray-800 rounded-tl-none"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-500 rounded-2xl rounded-tl-none px-5 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Thinking...
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 sm:p-4 bg-white border-t border-brand-100 flex flex-col gap-3">
        <div className="flex items-center gap-2 sm:gap-3 max-w-3xl mx-auto w-full">
          {/* Touch-friendly Mic Button */}
          <button
            onClick={isListening ? stopListening : startListening}
            disabled={!isSupported || isLoading}
            title={
              !isSupported
                ? "Voice input unsupported in this browser. Please use text."
                : "Toggle voice input"
            }
            className={`p-3 sm:p-4 rounded-full flex-shrink-0 transition-all ${
              !isSupported
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : isListening
                  ? "bg-red-100 text-red-600 animate-pulse"
                  : "bg-brand-100 text-brand-600 hover:bg-brand-200"
            }`}
          >
            <Mic className="w-6 h-6 sm:w-7 sm:h-7" />
          </button>

          {/* 
            CRITICAL LAYOUT FIX: min-w-0 allows the flex item to shrink below 
            the browser's default input width, preventing the Send button 
            from being pushed out of the viewport on 393px screens.
          */}
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            placeholder={
              !isSupported
                ? "Type your answer..."
                : isListening
                  ? "Listening..."
                  : "Type or speak..."
            }
            className="flex-1 min-w-0 py-3 px-3 sm:px-4 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-gray-50 text-base sm:text-lg"
          />

          <button
            onClick={() => handleSendMessage()}
            disabled={!inputText.trim() || isLoading}
            className="p-3 sm:p-4 bg-brand-600 text-white rounded-full flex-shrink-0 disabled:opacity-50 hover:bg-brand-700 transition-colors"
          >
            <Send className="w-5 h-5 sm:w-6 sm:h-6 sm:ml-1" />
          </button>
        </div>

        {/* Manual progression option */}
        {(messages.length > 3 || isHistoryComplete) && (
          <div className="flex justify-center mt-2">
            <button
              onClick={() => onComplete(caseId)}
              className="flex items-center gap-2 px-6 py-2 bg-green-100 text-green-700 font-medium rounded-xl hover:bg-green-200 transition-colors"
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
