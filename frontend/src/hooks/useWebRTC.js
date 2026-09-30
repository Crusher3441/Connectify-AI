import { useCallback, useEffect, useRef, useState } from 'react';

// Google's public STUN servers. On localhost/LAN you barely need them,
// but across networks they tell each peer its own public address.
const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export const useWebRTC = (emitSignal) => {
  // ALL mutable plumbing lives in refs
  const peersRef = useRef({});        // remoteSocketId → RTCPeerConnection
  const pendingIceRef = useRef({});   // remoteSocketId → [candidate, …]
  const negotiatingRef = useRef({});  // remoteSocketId → boolean
  const mySocketIdRef = useRef(null);
  const localStreamRef = useRef(null);

  const [remoteStreams, setRemoteStreams] = useState({}); // id → MediaStream

  // ---- state setters used by VideoMeet ----
  const setMySocketId = useCallback((id) => { mySocketIdRef.current = id; }, []);

  const setLocalStream = useCallback((stream) => {
    localStreamRef.current = stream;
  }, []);

  // ---- teardown (idempotent — safe to call twice) ----
  const removePeer = useCallback((remoteId) => {
    peersRef.current[remoteId]?.close();
    delete peersRef.current[remoteId];
    delete pendingIceRef.current[remoteId];
    delete negotiatingRef.current[remoteId];
    setRemoteStreams((prev) => {
      const next = { ...prev };
      delete next[remoteId];
      return next;
    });
  }, []);

  const closeAllPeers = useCallback(() => {
    Object.keys(peersRef.current).forEach(removePeer);
  }, [removePeer]);


  const createPeer = useCallback(
    (remoteId) => {
      const pc = new RTCPeerConnection(ICE_CONFIG);

      // Attach ALL local tracks now. The second `stream` argument records
      // stream membership on the sender — Phase 4's screen share finds its
      // video sender via `pc.getSenders().find(s => s.track?.kind === 'video')`,
      // which only works because we passed the stream here. Do not omit it.
      const stream = localStreamRef.current;
      if (stream) stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // My addresses → relay to the remote side
      pc.onicecandidate = (e) => {
        if (e.candidate) emitSignal(remoteId, { type: 'candidate', candidate: e.candidate });
      };

      // Their media arrives → store in STATE (UI must re-render)
      pc.ontrack = (e) => {
        setRemoteStreams((prev) => ({ ...prev, [remoteId]: e.streams[0] }));
      };

      // Free debugging visibility during this phase
      pc.onconnectionstatechange = () =>
        console.log(`[rtc] peer ${remoteId.slice(0, 5)} → ${pc.connectionState}`);

      peersRef.current[remoteId] = pc;
      return pc;
    },
    [emitSignal]
  );


  const handleNewPeer = useCallback(async (remoteId) => {
    
  }, []);
  const handleSignal = useCallback(async ({ from, data }) => {
    
  }, []);

  useEffect(() => closeAllPeers, [closeAllPeers]); // unmount safety

  return {
    peersRef,
    remoteStreams,
    setMySocketId,
    setLocalStream,
    createPeer,
    handleNewPeer,
    removePeer,
    handleSignal,
    closeAllPeers,
  };
};
