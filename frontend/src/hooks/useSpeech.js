import { useState, useEffect, useRef, useCallback } from "react";

export const useSpeech = (options = {}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isSupported] = useState(() => {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  });
  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);
  const onTranscriptRef = useRef(options.onTranscript);

  useEffect(() => {
    onTranscriptRef.current = options.onTranscript;
  }, [options.onTranscript]);

  useEffect(() => {
    const currentSynth = synthRef.current;

    // Check for browser support gracefully without crashing
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;

        recognitionRef.current.onresult = (event) => {
          let currentTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          setTranscript(currentTranscript);
          if (onTranscriptRef.current) {
            onTranscriptRef.current(currentTranscript);
          }
        };

        recognitionRef.current.onerror = (event) => {
          console.error("Speech recognition error:", event.error);
          setIsListening(false);
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
        };
      } catch (e) {
        console.error("Failed to initialize SpeechRecognition:", e);
      }
    } else {
      console.warn(
        "Speech Recognition API not supported in this browser (e.g., Firefox/Safari).",
      );
    }

    // Cleanup on unmount
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (currentSynth) {
        currentSynth.cancel();
      }
    };
  }, []);

  const startListening = useCallback(() => {
    setTranscript("");
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error("Failed to start listening:", e);
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, [isListening]);

  const speakText = useCallback((text) => {
    if (synthRef.current) {
      synthRef.current.cancel(); // Stop any ongoing speech
      const utterance = new SpeechSynthesisUtterance(text);

      // Optional: Try to find an Indian English voice for localization context
      const voices = synthRef.current.getVoices();
      const indianVoice = voices.find((v) => v.lang.includes("en-IN"));
      if (indianVoice) utterance.voice = indianVoice;

      synthRef.current.speak(utterance);
    }
  }, []);

  return {
    isListening,
    transcript,
    isSupported,
    startListening,
    stopListening,
    speakText,
  };
};
