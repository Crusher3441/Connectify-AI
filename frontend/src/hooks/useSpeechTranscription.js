import { useCallback, useEffect, useRef, useState } from 'react';

const getRecognitionCtor = () =>
  typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

export const useSpeechTranscription = (onFinal) => {
  const [supported] = useState(() => !!getRecognitionCtor());
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);

  const recognitionRef = useRef(null);
  const shouldListenRef = useRef(false);   // USER intent — survives auto-stops
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;            // fresh-callback pattern (Phase 3C, again)

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor || shouldListenRef.current) return;

    const rec = new Ctor();
    rec.continuous = true;       // don't stop after one sentence
    rec.interimResults = false;  // final text only — cleaner data for summaries
    rec.lang = 'en-US';         // constant, easy to make configurable later

    rec.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const text = event.results[i][0].transcript.trim();
          if (text) onFinalRef.current(text);
        }
      }
    };

    // THE QUIRK: Chrome ends the session after silence. If the user still
    // wants to listen, restart — with a try/catch because calling start()
    // on a live instance throws.
    rec.onend = () => {
      if (shouldListenRef.current) {
        try { rec.start(); } catch { /* already running — fine */ }
      } else {
        setListening(false);
      }
    };

    rec.onerror = (event) => {
      if (event.error === 'not-allowed') {
        shouldListenRef.current = false; // mic permission denied — stop wanting to listen
        setError('Microphone permission denied for transcription.');
        setListening(false);
      }
      // 'no-speech' and 'aborted' are normal — the onend restart handles them
    };

    shouldListenRef.current = true;
    try {
      rec.start();
      recognitionRef.current = rec;
      setListening(true);
      setError(null);
    } catch (err) {
      setError('Could not start transcription: ' + err.message);
    }
  }, []);

  const stop = useCallback(() => {
    shouldListenRef.current = false;      // intent first, so onend won't restart
    try { recognitionRef.current?.stop(); } catch { /* already stopped */ }
    recognitionRef.current = null;
    setListening(false);
  }, []);

  // Hard cleanup on unmount — no recognition sessions outliving the page.
  useEffect(() => () => stop(), [stop]);

  return { supported, listening, error, start, stop };
};