import { useState, useRef, useCallback } from 'react';

// Re-written to use MediaRecorder for Bhashini backend processing
export const useSpeech = (options = {}) => {
  const [isListening, setIsListening] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        
        // Convert Blob to Base64 for the API payload
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          // Remove the data url prefix (e.g., data:audio/webm;base64,)
          const base64Audio = reader.result.split(',')[1];
          if (options.onAudioReady) {
            options.onAudioReady(base64Audio);
          }
        };
      };

      mediaRecorderRef.current.start();
      setIsListening(true);
    } catch (err) {
      console.error("Microphone access denied or unavailable", err);
      if (options.onError) options.onError("Microphone access required.");
    }
  }, [options]);

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current && isListening) {
      mediaRecorderRef.current.stop();
      // Stop all tracks to release the microphone hardware immediately
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsListening(false);
    }
  }, [isListening]);

  const playAudioBase64 = useCallback((base64String) => {
    try {
      const audio = new Audio(`data:audio/wav;base64,${base64String}`);
      audio.play();
    } catch (err) {
      console.error("Failed to play audio response", err);
    }
  }, []);

  return {
    isListening,
    startListening,
    stopListening,
    playAudioBase64
  };
};