import { useState, useRef, useCallback, useEffect } from 'react';

// MediaRecorder-based microphone capture with server-side transcription.
// The browser only captures audio; the backend transcribes it. This avoids
// browser-native speech-recognition APIs entirely, so it works wherever
// MediaRecorder + microphone permission are available (Chromium, Firefox).
//
// voiceStatus: 'idle' | 'recording' | 'transcribing' | 'error'
// Recording captures audio; transcribing converts it to editable text;
// nothing is submitted until the patient presses Send.
const pickSupportedMimeType = () => {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) {
    return 'audio/webm';
  }
  const candidates = [
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
};

export const useSpeech = (options = {}) => {
  const [isListening, setIsListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('idle');
  const [voiceError, setVoiceError] = useState('');
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const startListening = useCallback(async () => {
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setVoiceStatus('error');
      setVoiceError('Voice recording is not supported in this browser. Please type your answer instead.');
      if (options.onError) options.onError('Voice recording is not supported in this browser.');
      return;
    }
    try {
      setVoiceError('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickSupportedMimeType();
      mediaRecorderRef.current = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: mediaRecorderRef.current?.mimeType || 'audio/webm' });

        // Convert Blob to Base64 for the API payload
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          if (typeof reader.result !== 'string') {
            setVoiceStatus('error');
            setVoiceError('Could not read the recording. Please try again or type your answer.');
            return;
          }
          // Remove the data url prefix (e.g., data:audio/webm;base64,)
          const base64Audio = reader.result.split(',')[1];
          if (!base64Audio) {
            setVoiceStatus('error');
            setVoiceError('The recording was empty. Please try again or type your answer.');
            return;
          }
          if (options.onAudioReady) {
            options.onAudioReady(base64Audio, audioBlob.type);
          }
        };
        reader.onerror = () => {
          setVoiceStatus('error');
          setVoiceError('Could not read the recording. Please try again or type your answer.');
        };
      };

      mediaRecorderRef.current.start();
      setIsListening(true);
      setVoiceStatus('recording');
    } catch {
      setVoiceStatus('error');
      setVoiceError('Microphone access is required for voice input. Please allow access or type your answer.');
      if (options.onError) options.onError('Microphone access required.');
    }
  }, [options]);

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current && isListening) {
      mediaRecorderRef.current.stop();
      // Stop all tracks to release the microphone hardware immediately
      mediaRecorderRef.current.stream?.getTracks().forEach(track => track.stop());
      setIsListening(false);
    }
  }, [isListening]);

  // Toggle interaction: first click starts recording, second click stops it.
  // Clicks while a transcription is in flight are ignored (the mic button
  // is also disabled in that state).
  const toggleRecording = useCallback(() => {
    if (voiceStatus === 'transcribing') return;
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, voiceStatus, startListening, stopListening]);

  // If the patient navigates away mid-recording, stop the recorder and
  // release the microphone cleanly on unmount.
  useEffect(() => {
    return () => {
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
        mediaRecorderRef.current?.stream?.getTracks().forEach(track => track.stop());
      } catch {
        // Best-effort cleanup only.
      }
    };
  }, []);

  const clearVoiceError = useCallback(() => {
    setVoiceError('');
    if (voiceStatus === 'error') setVoiceStatus('idle');
  }, [voiceStatus]);

  const playAudioBase64 = useCallback((base64String) => {
    try {
      const audio = new Audio(`data:audio/wav;base64,${base64String}`);
      audio.play();
    } catch {
      // Playback is best-effort; the text response is always shown.
    }
  }, []);

  return {
    isListening,
    voiceStatus,
    voiceError,
    setVoiceStatus,
    setVoiceError,
    clearVoiceError,
    startListening,
    stopListening,
    toggleRecording,
    playAudioBase64
  };
};