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

// Bhashini ASR requires WAV (16 kHz mono preferred) — webm/opus from
// MediaRecorder is NOT accepted by the pipeline. Convert in-browser with
// Web Audio (no new dependency): decode -> mix to mono -> resample to
// 16 kHz -> 16-bit PCM WAV. Sarvam also prefers WAV, so one format serves
// both providers.
const encodeWav16kMono = async (blob) => {
  const arrayBuffer = await blob.arrayBuffer();
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) throw new Error('webaudio-unsupported');
  const ctx = new AudioCtx();
  try {
    const decoded = await ctx.decodeAudioData(arrayBuffer);
    if (!decoded.duration || decoded.duration < 0.2 || decoded.length === 0) {
      throw new Error('empty-recording');
    }
    const targetRate = 16000;
    const numChannels = decoded.numberOfChannels;
    const channels = [];
    for (let c = 0; c < numChannels; c++) channels.push(decoded.getChannelData(c));
    const targetLen = Math.max(1, Math.round((decoded.length / decoded.sampleRate) * targetRate));
    const mono = new Float32Array(targetLen);
    for (let i = 0; i < targetLen; i++) {
      const srcIdx = (i / targetRate) * decoded.sampleRate;
      const i0 = Math.floor(srcIdx);
      const i1 = Math.min(i0 + 1, decoded.length - 1);
      const frac = srcIdx - i0;
      let sum = 0;
      for (let c = 0; c < numChannels; c++) {
        sum += channels[c][i0] * (1 - frac) + channels[c][i1] * frac;
      }
      mono[i] = sum / numChannels;
    }
    const dataBytes = targetLen * 2;
    const buffer = new ArrayBuffer(44 + dataBytes);
    const view = new DataView(buffer);
    const writeStr = (offset, str) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + dataBytes, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, targetRate, true);
    view.setUint32(28, targetRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, dataBytes, true);
    for (let i = 0; i < targetLen; i++) {
      const s = Math.max(-1, Math.min(1, mono[i]));
      view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return { base64Audio: btoa(binary), mimeType: 'audio/wav' };
  } finally {
    if (ctx.close) await ctx.close().catch(() => {});
  }
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
      // Request browser-level clean-up so a noisy OPD and speaker bleed-in
      // do not corrupt the ASR input.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      const mimeType = pickSupportedMimeType();
      mediaRecorderRef.current = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: mediaRecorderRef.current?.mimeType || 'audio/webm' });

        // Convert to 16 kHz mono WAV for the Bhashini ASR pipeline,
        // then send Base64 to the backend for transcription.
        encodeWav16kMono(audioBlob).then(
          ({ base64Audio, mimeType }) => {
            if (!base64Audio) {
              setVoiceStatus('error');
              setVoiceError('The recording was empty. Please try again or type your answer.');
              return;
            }
            if (options.onAudioReady) {
              options.onAudioReady(base64Audio, mimeType);
            }
          },
          () => {
            setVoiceStatus('error');
            setVoiceError('Could not process the recording. Please try again or type your answer.');
          }
        );
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