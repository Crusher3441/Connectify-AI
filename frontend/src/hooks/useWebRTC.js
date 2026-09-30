import { useCallback, useEffect, useRef, useState } from 'react';

const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export const useWebRTC = (emitSignal) => {
  // ALL mutable plumbing lives in refs coz react doesnot re-render if value of useRef changes
  const peersRef = useRef({});        // remoteSocketId → RTCPeerConnection
  const pendingIceRef = useRef({});   // remoteSocketId → [candidate, …]
  const negotiatingRef = useRef({});  // remoteSocketId → boolean
  const mySocketIdRef = useRef(null);
  const localStreamRef = useRef(null);

  const [remoteStreams, setRemoteStreams] = useState({}); // id → MediaStream

  
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
  }, [removePeer]);  // ye function bhi kbhi recreate nhi hoga coz removePeer ki dependency array empty hai ( aur agr removePeer ka refrence nhi change hoga to iska bhi nhi hoga)


  const createPeer = useCallback(                      // createPeer("user123") will lead to create connection with user123
    (remoteId) => {                                              
      const pc = new RTCPeerConnection(ICE_CONFIG);

      // Attach ALL local tracks now. The second `stream` argument records
      // stream membership on the sender — Phase 4's screen share finds its
      // video sender via `pc.getSenders().find(s => s.track?.kind === 'video')`,
      // which only works because we passed the stream here.
      const stream = localStreamRef.current;
      if (stream) stream.getTracks().forEach((track) => pc.addTrack(track, stream));      // Is WebRTC connection ke through mera camera aur microphone remote user ko bhejo

      // My addresses → relay to the remote side
      pc.onicecandidate = (e) => {
        if (e.candidate) emitSignal(remoteId, { type: 'candidate', candidate: e.candidate });         // ice candidate signaling server ke through remote side ko bhej rahe hai
      };

      // Their media arrives → store in STATE (UI must re-render)
      pc.ontrack = (e) => {
        setRemoteStreams((prev) => ({ ...prev, [remoteId]: e.streams[0] }));
      };

      pc.onconnectionstatechange = () => console.log(`[rtc] peer ${remoteId.slice(0, 5)} → ${pc.connectionState}`);
        

      peersRef.current[remoteId] = pc;
      return pc;
    },
    [emitSignal]
  );


   // Called when we LEARN about a peer: from the join ack (existing members)
  // or from a 'user-joined' broadcast (newcomers).
  const handleNewPeer = useCallback(async (remoteId) => {
    if (peersRef.current[remoteId]) return;          // already connected 
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

  const handleSignal = useCallback(
    async ({ from, data }) => {
      // Late arrival case: an offer arrives for a peer we haven't created yet
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
