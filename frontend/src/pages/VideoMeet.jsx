// ⚠️ CORRECTION (C1): `useRef` was MISSING from this import list while the
// component calls `useRef(...)` several times. React does not put hooks on the
// global scope, so this threw `ReferenceError: useRef is not defined` on the
// very first render — /meeting/:code was a guaranteed blank page.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext'; // Phase 2
import { useMeetingSocket } from '../hooks/useMeetingSocket';
import { useMediaStream } from '../hooks/useMediaStream';
import { useWebRTC } from '../hooks/useWebRTC';
import { useMeetingCollab } from '../hooks/useMeetingCollab';
import { useScreenShare } from '../hooks/useScreenShare';
import LobbyView from '../components/meeting/LobbyView';
import VideoGrid from '../components/meeting/VideoGrid';
import MeetingControls from '../components/meeting/MeetingControls';
import Sidebar from '../components/meeting/Sidebar';
import ReactionsOverlay from '../components/meeting/ReactionsOverlay';
import ChatPanel from '../components/meeting/sidebar/ChatPanel';
import ParticipantsPanel from '../components/meeting/sidebar/ParticipantsPanel';
import PollsPanel from '../components/meeting/sidebar/PollsPanel';
import TranscriptPanel from '../components/meeting/sidebar/TranscriptPanel';
import AttendancePanel from '../components/meeting/sidebar/AttendancePanel';
import EnrollmentModal from '../components/EnrollmentModal';
import ApprovalDialog from '../components/ApprovalDialog'; // 7A
import { useFaceAttendance } from '../hooks/useFaceAttendance';
import { useSpeechTranscription } from '../hooks/useSpeechTranscription';
import styles from '../styles/videoComponent.module.css';

export default function VideoMeet() {
  const { code } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, token } = useAuth();

  // 7B — identity is EITHER a signed-in user OR a route-state guest.
  // `guestInfo` is null unless /join/:code handed us a name; the guard below
  // guarantees we never reach the room with neither.
  const guestInfo = location.state?.guest ? { name: location.state.name } : null;
  const isGuest = !!guestInfo;

  // ⚠️ CORRECTION (H7): TWO identities travel together and must never be
  // conflated. `username` = DISPLAY name (typed in the lobby or the guest
  // form, shown on tiles). `user?.username` = LOGIN identity, which the server
  // persists in Face/Attendance/Transcript and which Phase 6 authorizes on.
  // Guests have no login identity, so they pass null and the server falls back
  // to the display name — correct, because guests are authorized against nothing.
  const [phase, setPhase] = useState('lobby');  // 'lobby' | 'awaiting' | 'room'
  const [username, setUsername] = useState(guestInfo?.name || user?.name || '');
  const [joinError, setJoinError] = useState(null);
  const [activeTab, setActiveTab] = useState('chat'); // sidebar tab (4A)
  const [mySocketId, setMySocketId] = useState(null);
  const [joinRequests, setJoinRequests] = useState([]); // 7A — owner only

  // ⚠️ Socket handlers are registered ONCE, so any `phase` they close over is
  // frozen at mount. `join-approved` can arrive long after the user gave up and
  // went back to the lobby; without this mirror the handler would act on a stale
  // 'lobby' and wrongly enter the room. Same always-fresh pattern as
  // handlersRef in useMeetingSocket.
  const phaseRef = useRef('lobby');
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // 7B refresh recovery: a guest who reloads has lost `location.state` (route
  // state does not survive a refresh by design) and has no session to rehydrate
  // from. Send them back to the name form instead of stranding them on an empty
  // lobby they cannot act on.
  //
  // ⚠️ Gate on `token`, NOT on `user`. `user` is null for a signed-in user whose
  // stored profile was cleared or unparseable (AuthContext deliberately treats
  // corrupted storage as logged out), and redirecting on that would bounce a
  // legitimate member to the guest form. `token` is exactly the signal withAuth
  // uses, so the two gates can never disagree — and the `!guestInfo` half
  // prevents a navigate-in-effect loop for real guests.
  useEffect(() => {
    if (!token && !guestInfo) {
      navigate(`/join/${code}`, { replace: true });
    }
  }, [token, guestInfo, code, navigate]);

  // ---- Phase 5 state ----
  const [enrollmentOpen, setEnrollmentOpen] = useState(false); // 5B — once per meeting
  const [enrolledDescriptor, setEnrolledDescriptor] = useState(null); // gates 5E's loop
  const [liveAttendance, setLiveAttendance] = useState([]);  // owner-only (5F)
  const detectVideoRef = useRef(null);
  // ⚠️ CORRECTION (C5): the hook needs to know WHEN the <video> actually mounted.
  // A ref's identity doesn't change when .current is set, so the hook must depend
  // on this boolean instead — otherwise it bails out on first run and the 10s
  // verification loop never starts.
  const [videoReady, setVideoReady] = useState(false);

  // ---- hooks (each owns ONE concern) ----
  const {
    localStream, micOn, camOn, error: mediaError,
    startStream, toggleMic, toggleCam, stopStream, streamRef: mediaRef,
  } = useMediaStream();

  // Emit signals through a ref so useWebRTC can be created before the socket.
  const emitSignalRef = useRef((to, data) => {});

  // ⚠️ BUGFIX — emitSignal MUST have a stable identity.
  // This used to be an inline arrow: `useWebRTC((to, data) => emitSignalRef.current(to, data))`.
  // An inline arrow is a NEW function on every render, which cascaded:
  //   emitSignal (new) → createPeer (new) → handleNewPeer/handleSignal (new)
  //   → useWebRTC's useMemo recomputes → `webrtc` is a new OBJECT every render.
  // `useCallback` with [] pins the identity, which keeps every callback inside
  // useWebRTC stable and lets its memoised return actually stay memoised.
  const emitSignal = useCallback((to, data) => emitSignalRef.current(to, data), []);

  const webrtc = useWebRTC(emitSignal);

  // collabRef breaks the socket↔collab wiring cycle (same trick as emitSignalRef)
  const collabRef = useRef(null);

  // 7A/7C — `enterRoom` and `leaveToHome` are DEFINED LATER in this component
  // but are needed by socket handlers that are registered NOW. Declaring them
  // before the hook call is what breaks the circular dependency: the handlers
  // capture the refs, and the refs get the real functions once those callbacks
  // exist. Reading `enterRoom` directly here would throw on the first render
  // (temporal dead zone) — the same reason `collab` uses collabRef.
  const enterRoomRef = useRef(null);
  const leaveToHomeRef = useRef(null);

  // ⚠️ CORRECTION (C4): the callbacks go inside a REF. Passing them as direct
  // props (`getCameraTrack: () => …`) created a new function identity every
  // render, which destabilised every useCallback inside useScreenShare and made
  // its unmount cleanup stop the share immediately (see the hook).
  const screenSharePropsRef = useRef(null);
  screenSharePropsRef.current = {
    getCameraTrack: () => mediaRef.current?.getVideoTracks()[0] || null,
    onShareStarted: () => socketRef.current?.emit('screen-share-started'),
    onShareStopped: () => socketRef.current?.emit('screen-share-stopped'),
  };
  const screenShare = useScreenShare({
    peersRef: webrtc.peersRef,
    propsRef: screenSharePropsRef,
  });

  const { socketRef, connected, joinCall } = useMeetingSocket({
    onUserJoined: ({ socketId, username: name }) => {
      webrtc.handleNewPeer(socketId);           // mesh dialing — UNCHANGED
      // roster placeholder until the authoritative broadcast lands:
      collabRef.current?.handleRosterMember({ socketId, username: name });
    },
    onParticipantLeft: ({ socketId }) => {
      webrtc.removePeer(socketId);              // mesh cleanup — UNCHANGED
      collabRef.current?.removeRosterMember(socketId);
    },
    onSignal: (payload) => webrtc.handleSignal(payload),
    onRoster: (p) => collabRef.current?.handleRoster(p),          // full state
    onChatReceived: (p) => collabRef.current?.handleIncomingChat(p),
    onReaction: (p) => collabRef.current?.handleReaction(p),
    onPolls: (p) => collabRef.current?.handlePolls(p),
    onDecisions: (p) => collabRef.current?.handleDecisions(p),
    onShareStarted: ({ socketId: sid }) => collabRef.current?.handleShareStarted(sid),
    onShareStopped: () => collabRef.current?.handleShareStopped(),
    onTranscript: (p) => collabRef.current?.handleIncomingTranscript(p),   // 5H
    onLiveAttendance: (p) => setLiveAttendance(p),                          // 5F (owner only)

    
    onJoinRequest: (p) => setJoinRequests((prev) =>
      // De-dupe: the same socket can only be pending once, but a re-render or a
      // retried request must not stack duplicate cards.
      prev.some((x) => x.socketId === p.socketId) ? prev : [...prev, p]
    ),
    onJoinApproved: (res) => {
      // Stale-approval guard. The user may have hit Back, or the room may have
      // dissolved, between requesting and being approved. phaseRef is read
      // (not `phase`) because this handler was registered once at mount.
      if (phaseRef.current !== 'awaiting') return;
      enterRoomRef.current?.(res);
    },
    onJoinRejected: (p) => {
      setPhase('lobby');
      setJoinError(p.message);
    },
    onDissolved: () => {
      // Two audiences: in-room members are sent home with the summary handoff;
      // someone still on the spinner just gets released back to the lobby.
      if (phaseRef.current === 'room') leaveToHomeRef.current?.();
      else {
        setPhase('lobby');
        setJoinError('The host left before admitting you.');
      }
    },
    onMeetingEnded: () => {
      // 7C — identical teardown to leaving voluntarily. The server has already
      // finalized, so `pendingSummary` is what carries the result to Home.
      if (phaseRef.current === 'room') leaveToHomeRef.current?.();
      else {
        setPhase('lobby');
        setJoinError('The meeting was ended by the host.');
      }
    },
  });

  const collab = useMeetingCollab({ socketRef, activeTab });
  collabRef.current = collab;      // always-fresh (same pattern as handlersRef)

  // ---- Phase 5 hooks ----
  const { matchState } = useFaceAttendance({
    socketRef,
    enrolledDescriptor,
    videoRef: detectVideoRef,
    videoReady,
    streamRef: mediaRef,   // for captureFrame's track-settings dimension fallback
  });

  const speech = useSpeechTranscription((text) => {
    const entry = { username: username, text, at: new Date().toISOString() };
    collab.addLocalTranscript(entry);                       // my screen shows it now
    socketRef.current?.emit('transcript-entry', { text });  // everyone else gets it attributed
  });

  const isOwner = collab.roster.find((p) => p.socketId === mySocketId)?.isOwner || false;

  
  useEffect(() => {
    emitSignalRef.current = (to, data) => {
      socketRef.current?.emit('signal', { to, data });
    };
  }, [socketRef]);

  // Keep WebRTC's notion of "me" and "my media" current.
  useEffect(() => {
   
    if (connected && socketRef.current?.id) {
      webrtc.setMySocketId(socketRef.current.id);
      setMySocketId(socketRef.current.id);
    }
  }, [connected, socketRef, webrtc]);

  useEffect(() => {
    webrtc.setLocalStream(localStream);
  }, [localStream, webrtc]);

  
  useEffect(() => {
    if (phase === 'lobby') startStream();
  }, [phase, startStream]);

  
  useEffect(() => {
    if (connected) socketRef.current?.emit('media-state', { micOn, camOn });
  }, [micOn, camOn, connected, socketRef]);

  // opening the chat tab clears its badge
  useEffect(() => {
    if (activeTab === 'chat') collab.clearUnread();
  }, [activeTab, collab]);

  // ---- join pipeline (lobby button) ----

  
  const enterRoom = useCallback((res) => {
    
    const myId = socketRef.current?.id;
    if (myId) webrtc.setMySocketId(myId);
    setMySocketId(myId);
    // Dial everyone already in the room (the deterministic rule in 3G
    // decides who actually offers — both sides run it).
    for (const p of res.participants) {
      if (myId && p.socketId !== myId) webrtc.handleNewPeer(p.socketId);
    }
    collab.seedFromJoin(res);            // 4B/4F/5H — history for all full-state channels
    collab.handleRoster(res.participants); // 4C — initial roster from ack
    setPhase('room');
    // 7B — guests have no login identity, so attendance enrollment is
    // meaningless for them. Offer the modal to members only.
    if (!isGuest) setEnrollmentOpen(true);
    // ⚠️ CORRECTION (H1): the FIRST valid media-state announcement. Without
    // this the roster has no micOn/camOn keys until the first toggle.
    socketRef.current?.emit('media-state', { micOn, camOn });
  }, [webrtc, collab, socketRef, isGuest, micOn, camOn]);

  // Hand the socket handlers their real implementation (declared as refs above).
  enterRoomRef.current = enterRoom;

  const handleJoin = useCallback(async () => {
    const stream = await startStream();
    if (!stream) return; // mediaError already set by the hook
   
    webrtc.setLocalStream(stream);
    setJoinError(null);
    try {
     
      const res = await joinCall(code, username.trim(), isGuest, user?.username || null);
      // 7A — the server's THIRD ack shape. `pending` is a success, not a
      // failure: the request is queued and the host has been notified.
      if (res.pending) {
        setPhase('awaiting');
        return;
      }
      enterRoom(res);
    } catch (err) {
      setJoinError(err.message);
    }
  }, [code, username, isGuest, user, startStream, joinCall, enterRoom, webrtc]);

  // ---- 5C: enrollment contract (modal captures, parent owns the socket) ----
  const handleEnrollConfirm = useCallback(async (descriptor) => {
    const res = await new Promise((resolve) => {
      socketRef.current?.emit('register-face', { descriptor }, (r) => resolve(r));
    });
    if (res?.ok) {
      setEnrolledDescriptor(descriptor); // starts the verification loop (5E)
      setEnrollmentOpen(false);
      return true;
    }
    return false;
  }, [socketRef]);

  // ---- THE TEARDOWN, factored for THREE triggers (7C) ----
  // Leave button, `meeting-dissolved` (D3) and `meeting-ended` (7C) all land
  // here. Divergent cleanup paths are how Phase 3 grew ghost peers: one
  // function means exactly one thing to get right.
  const leaveToHome = useCallback(() => {
    screenShare.stopShare();         // 0. revert video senders to camera, stop display
    stopStream();                    // 1. stop capture — camera light off, tracks dead
    webrtc.closeAllPeers();          // 2. close every RTCPeerConnection
    socketRef.current?.disconnect(); // 3. kill signaling (server fires disconnect cleanup)
    // 5K handoff: the summary is generated AFTER every socket is gone, so a
    // broadcast would reach nobody. Home picks this up over REST instead.
    //
    // ⚠️ CORRECTION (C18): `pendingSummaryAt` is what lets Home tell a FRESH
    // handoff from a stale one — and, more importantly, tells it that the server
    // may still be WRITING the summary right now, so a single fetch would race
    // it and 404. See the retry logic in home.jsx. Written together with the
    // code so the two can never get out of step.
    sessionStorage.setItem('pendingSummary', code);
    sessionStorage.setItem('pendingSummaryAt', String(Date.now()));
    navigate('/home');               // 4. only now leave the page
  }, [screenShare, stopStream, webrtc, socketRef, navigate, code]);

  leaveToHomeRef.current = leaveToHome;

  const handleLeave = leaveToHome;

  const handleToggleShare = useCallback(async () => {
    if (screenShare.sharing) screenShare.stopShare();
    else await screenShare.startShare();
  }, [screenShare]);

  // Browser-back / tab-close safety net: close every peer on UNMOUNT ONLY.
  //
  // ⚠️ BUGFIX — this used to be `useEffect(() => () => webrtc.closeAllPeers(), [webrtc])`.
  // That is still wrong even with a stable emitSignal, because useWebRTC's
  // return memo deliberately depends on `remoteStreams` (so the grid re-renders
  // when a peer connects). Every time a remote stream arrives, `webrtc` becomes
  // a NEW object → this effect's cleanup fires → closeAllPeers() → the peer that
  // JUST connected is destroyed. Symptom: both users appear connected, but media
  // never flows and remote tiles stay empty.
  //
  // Fix: hold the teardown fn in a ref and run it with EMPTY deps, so it fires
  // exactly once — on unmount — and never on a state change. (closeAllPeers is
  // itself stable: it only closes peers, it does not depend on the media state.)
  const closeAllPeersRef = useRef(webrtc.closeAllPeers);
  closeAllPeersRef.current = webrtc.closeAllPeers;

  useEffect(() => {
    return () => closeAllPeersRef.current();
  }, []);

  if (phase === 'lobby' || phase === 'awaiting') {
    return (
      <LobbyView
        code={code}
        username={username}
        onUsername={setUsername}
        stream={localStream}
        error={joinError || mediaError}
        onJoin={handleJoin}
        awaiting={phase === 'awaiting'}   // 7A — spinner replaces the Join button
      />
    );
  }

  // ---- sidebar panels (all state lives in `collab`; panels stay dumb) ----
  const metaFor = (id) => collab.roster.find((p) => p.socketId === id);
  const panels = {
    chat: (
      <ChatPanel
        messages={collab.messages}
        onSend={collab.sendChat}
        mySocketId={mySocketId}
      />
    ),
    people: <ParticipantsPanel roster={collab.roster} mySocketId={mySocketId} />,
    polls: (
      <PollsPanel
        polls={collab.polls}
        decisions={collab.decisions}
        isOwner={metaFor(mySocketId)?.isOwner}
        mySocketId={mySocketId}
        onCreatePoll={collab.createPoll}
        onVote={collab.vote}
        onAddDecision={collab.addDecision}
      />
    ),
    transcript: (
      <TranscriptPanel
        transcripts={collab.transcripts}
        supported={speech.supported}
        listening={speech.listening}
        error={speech.error}
        onToggle={() => (speech.listening ? speech.stop() : speech.start())}
      />
    ),
    attendance: <AttendancePanel snapshot={liveAttendance} />,
  };

  return (
    <main className={styles.meetingRoot}>
      <div className={styles.body}>
        <div className={styles.stage}>
          <VideoGrid
            localStream={localStream}
            remoteStreams={webrtc.remoteStreams}
            myName={username}
            mySocketId={mySocketId}
            nameFor={(id) => metaFor(id)?.username || 'Guest'}
            metaFor={metaFor}
            sharerId={collab.sharerId}
            localMatchState={matchState}
          />
          {/* 5E: hidden detector feed. `display: none` can suppress frame
              rendering in some browsers — 2px + opacity 0 instead. */}
          {localStream && (
            <video
              ref={(el) => {
                detectVideoRef.current = el;
                if (el) {
                  el.srcObject = localStream;
                  el.play().catch(() => {});
                  setVideoReady(true);   // ← CORRECTION (C5): signal "mounted"
                } else {
                  setVideoReady(false);
                }
              }}
              autoPlay playsInline muted
              style={{ position: 'absolute', width: 2, height: 2, opacity: 0, pointerEvents: 'none' }}
            />
          )}
          <ReactionsOverlay
            reactions={collab.reactions}
            onDone={collab.removeReaction}
          />
          <MeetingControls
            micOn={micOn}
            camOn={camOn}
            handRaised={metaFor(mySocketId)?.raisedHand}
            sharing={screenShare.sharing}
            onToggleMic={toggleMic}
            onToggleCam={toggleCam}
            onToggleHand={collab.toggleHand}
            onToggleShare={handleToggleShare}
            onReact={collab.react}
            onLeave={handleLeave}
            isOwner={isOwner}                                   // 7C
            onEndAll={() => socketRef.current?.emit('end-meeting')}
          />
        </div>
        <Sidebar
          active={activeTab}
          onChange={setActiveTab}
          isOwner={isOwner}
          badges={{ chat: collab.unread }}
          panels={panels}
        />
      </div>

      {/* 7A — the owner's approval queue. Renders nothing when empty, and the
          server re-checks ownership on approve/reject regardless of what is
          drawn here. */}
      <ApprovalDialog
        requests={joinRequests}
        onApprove={(socketId) => {
          socketRef.current?.emit('approve-join', { socketId });
          // Remove optimistically: the server no-ops on a stale request anyway,
          // so a card that lingers would be a lie the UI shows for no reason.
          setJoinRequests((prev) => prev.filter((r) => r.socketId !== socketId));
        }}
        onReject={(socketId) => {
          socketRef.current?.emit('reject-join', { socketId });
          setJoinRequests((prev) => prev.filter((r) => r.socketId !== socketId));
        }}
      />

      {/* 7B — guests never see the enrollment modal: they have no login identity
          to key Face/Attendance documents on, and the server rejects their
          register-face emits regardless. */}
      {enrollmentOpen && !isGuest && (
        <EnrollmentModal
          stream={localStream}
          onConfirm={handleEnrollConfirm}
          onSkip={() => setEnrollmentOpen(false)}
        />
      )}
    </main>
  );
}
