// ⚠️ CORRECTION (C3): useMemo is required — see the return statement at the
// bottom of this hook for why the returned object must have a stable identity.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Google's public STUN servers. On localhost/LAN you barely need them,
// but across networks they tell each peer its own public address.
const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export const useWebRTC = (emitSignal) => {
  // ALL mutable plumbing lives in refs (audit #8: no module-level state).
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

  // ---- PART A: the factory ----
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

  // ---- PART B: negotiation ----

  // Buffered ICE candidates can only be applied AFTER a remote description
  // exists. When the answer/offer arrives, flush the queue in order.
  const flushIce = useCallback((remoteId) => {
    const pc = peersRef.current[remoteId];
    const queue = pendingIceRef.current[remoteId] || [];
    while (queue.length && pc) {
      pc.addIceCandidate(queue.shift()).catch((err) =>
        console.warn('[rtc] flushed candidate failed:', err)
      );
    }
  }, []);


  // Called when we LEARN about a peer: from the join ack (existing members)
  // or from a 'user-joined' broadcast (newcomers).
  const handleNewPeer = useCallback(async (remoteId) => {
    if (peersRef.current[remoteId]) return;          // already connected — idempotent
    if (remoteId === mySocketIdRef.current) return;  // never dial yourself

    createPeer(remoteId);

    // DETERMINISTIC INITIATOR RULE:
    // Both sides run this same comparison and agree on who offers.
    // (If both offered → "glare"; if neither → dead silence. The
    // lexicographic tiebreak eliminates both failure modes.)
    const iAmInitiator = mySocketIdRef.current < remoteId;
    if (!iAmInitiator) return; // I'll wait for their offer

    const pc = peersRef.current[remoteId];
    if (pc.localDescription || negotiatingRef.current[remoteId]) return; // guard re-offer

    negotiatingRef.current[remoteId] = true;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    emitSignal(remoteId, { type: 'offer', sdp: pc.localDescription });
    negotiatingRef.current[remoteId] = false;
  }, [createPeer, emitSignal]);

  const handleSignal = useCallback(
    async ({ from, data }) => {
      // Late/racy case: an offer arrives for a peer we haven't created yet
      // (their 'user-joined' handling hasn't run). Create the peer on demand.
      let pc = peersRef.current[from];
      if (!pc && data?.type === 'offer') pc = createPeer(from);
      if (!pc) return;

      if (data.type === 'offer') {
        await pc.setRemoteDescription(data.sdp);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        emitSignal(from, { type: 'answer', sdp: pc.localDescription });
        flushIce(from);
      } else if (data.type === 'answer') {
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(data.sdp);
          flushIce(from);
        }
      } else if (data.type === 'candidate') {
        if (!pc.remoteDescription || !pc.remoteDescription.type) {
          // Too early — buffer until the remote description lands (see flushIce).
          (pendingIceRef.current[from] ||= []).push(data.candidate);
        } else {
          await pc.addIceCandidate(data.candidate).catch((err) =>
            console.warn('[rtc] candidate failed:', err)
          );
        }
      }
    },
    [createPeer, emitSignal, flushIce]
  );

  useEffect(() => closeAllPeers, [closeAllPeers]); // unmount safety

  return useMemo(
    () => ({
      peersRef,
      remoteStreams,
      setMySocketId,
      setLocalStream,
      createPeer,
      handleNewPeer,
      removePeer,
      handleSignal,
      closeAllPeers,
    }),
    [
      remoteStreams, // changes when a peer connects — consumers must re-render
      setMySocketId,
      setLocalStream,
      createPeer,
      handleNewPeer,
      removePeer,
      handleSignal,
      closeAllPeers,
    ]
  );
};
