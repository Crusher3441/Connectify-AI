import { useCallback, useEffect, useRef, useState } from 'react';

const describeError = (err) => {
  switch (err?.name) {
    case 'NotAllowedError':
      return 'Camera/mic permission denied. Allow access in the browser address bar, then retry.';
    case 'NotFoundError':
      return 'No camera or microphone found on this device.';
    case 'NotReadableError':
      return 'Your camera is already in use by another app (Zoom? Teams?). Close it and retry.';
    default:
      return err?.message || 'Could not start the camera.';
  }
};

export const useMediaStream = () => {
  const streamRef = useRef(null);           // the truth lives HERE
  const [localStream, setLocalStream] = useState(null); // state mirrors it for rendering
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [error, setError] = useState(null);

  // Idempotent: safe under StrictMode double-mount and repeated calls.
  // Starting media twice on the same device throws NotReadableError.
  const startStream = useCallback(async () => {
    if (streamRef.current) return streamRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      setLocalStream(stream);
      setError(null);
      return stream;
    } catch (err) {
      setError(describeError(err));
      return null;
    }
  }, []);

  // The TRACK's enabled flag is the real source of truth; state copies it.
  // (Toggling enabled keeps the track alive — crucial: replacing/stopping
  // tracks mid-call would renegotiate or kill peer connections.)
  const toggleMic = useCallback(() => {
    const tracks = streamRef.current?.getAudioTracks() || [];
    if (!tracks.length) return;
    const next = !tracks.some((t) => t.enabled);
    tracks.forEach((t) => (t.enabled = next));
    setMicOn(next);
  }, []);

  const toggleCam = useCallback(() => {
    const tracks = streamRef.current?.getVideoTracks() || [];
    if (!tracks.length) return;
    const next = !tracks.some((t) => t.enabled);
    tracks.forEach((t) => (t.enabled = next));
    setCamOn(next);
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLocalStream(null);
    setMicOn(true);
    setCamOn(true);
  }, []);

  // Safety net: if the page unmounts without an explicit leave (browser
  // back button, tab close), release the camera anyway.
  useEffect(() => stopStream, [stopStream]);

  return {
    localStream, micOn, camOn, error,
    startStream, toggleMic, toggleCam, stopStream,
  };
};
