import { useCallback, useEffect, useRef, useState } from 'react';

export const useScreenShare = ({ peersRef, propsRef }) => {
  const [sharing, setSharing] = useState(false);
  const displayStreamRef = useRef(null);

  // Read the current callbacks through the ref at call time — always fresh,
  // always a stable dependency for the callbacks below.
  const stopShare = useCallback(() => {
    const display = displayStreamRef.current;
    if (!display) return;
    display.getTracks().forEach((t) => (t.onended = null)); // stop re-entry from onended
    display.getTracks().forEach((t) => t.stop());
    displayStreamRef.current = null;

    // Swap every peer's outgoing video BACK to the camera track.
    const cameraTrack = propsRef.current.getCameraTrack?.();
    if (cameraTrack) {
      Object.values(peersRef.current).forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(cameraTrack).catch(() => {});
      });
    }
    setSharing(false);
    propsRef.current.onShareStopped?.();
  }, [peersRef, propsRef]);

  const startShare = useCallback(async () => {
    if (displayStreamRef.current) return true; // already sharing
    let display;
    try {
      display = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false, // tab audio sharing is a nice-to-have; keep v1 simple
      });
    } catch {
      return false; // user closed the picker — NOT an error state
    }
    displayStreamRef.current = display;
    const displayTrack = display.getVideoTracks()[0];

    // Swap the outgoing video in EVERY peer — replaceTrack changes the
    // transmitted track WITHOUT renegotiation. This is why Phase 3's
    // createPeer passed the stream argument to addTrack.
    const cameraVideoSenderOf = (pc) =>
      pc.getSenders().find((s) => s.track?.kind === 'video');
    Object.values(peersRef.current).forEach((pc) => {
      const sender = cameraVideoSenderOf(pc);
      if (sender) sender.replaceTrack(displayTrack).catch(() => {});
    });

    setSharing(true);
    propsRef.current.onShareStarted?.();

    // Stop path #2: the browser's native "Stop sharing" chrome bar.
    displayTrack.onended = () => stopShare();
    return true;
  }, [peersRef, propsRef, stopShare]);

  // Stop path #3: unmount safety (navigating away mid-share).
  useEffect(() => () => stopShare(), [stopShare]);

  return { sharing, startShare, stopShare };
};
