import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext"; // Phase 2
import { useMeetingSocket } from "../hooks/useMeetingSocket";
import { useMediaStream } from "../hooks/useMediaStream";
import { useWebRTC } from "../hooks/useWebRTC";
import { useMeetingCollab } from "../hooks/useMeetingCollab";
import { useScreenShare } from "../hooks/useScreenShare";
import LobbyView from "../components/meeting/LobbyView";
import VideoGrid from "../components/meeting/VideoGrid";
import MeetingControls from "../components/meeting/MeetingControls";
import Sidebar from "../components/meeting/Sidebar";
import ReactionsOverlay from "../components/meeting/ReactionsOverlay";
import ChatPanel from "../components/meeting/sidebar/ChatPanel";
import ParticipantsPanel from "../components/meeting/sidebar/ParticipantsPanel";
import PollsPanel from "../components/meeting/sidebar/PollsPanel";
import TranscriptPanel from "../components/meeting/sidebar/TranscriptPanel";
import AttendancePanel from "../components/meeting/sidebar/AttendancePanel";
import EnrollmentModal from "../components/EnrollmentModal";
import { useFaceAttendance } from "../hooks/useFaceAttendance";
import { useSpeechTranscription } from "../hooks/useSpeechTranscription";
import styles from "../styles/videoComponent.module.css";

export default function VideoMeet() {
  const { code } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, token } = useAuth();

  const guestInfo = location.state?.guest
    ? { name: location.state.name }
    : null;

  const isGuest = !!guestInfo;

  const [phase, setPhase] = useState("lobby"); // 'lobby' | 'room'
  const [username, setUsername] = useState(user?.name || "");
  const [joinError, setJoinError] = useState(null);
  const [activeTab, setActiveTab] = useState("chat"); // sidebar tab (4A)
  const [mySocketId, setMySocketId] = useState(null);
  const [joinRequests, setJoinRequests] = useState([]);
  

  const phaseRef = useRef('lobby');
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  useEffect(() => {
    if (!token && !guestInfo) {
      navigate(`/join/${code}`, { replace: true });
    }
  }, [token, guestInfo, code, navigate]);
  // ---- Phase 5 state ----
  const [enrollmentOpen, setEnrollmentOpen] = useState(false); // 5B — once per meeting
  const [enrolledDescriptor, setEnrolledDescriptor] = useState(null); // gates 5E's loop
  const [liveAttendance, setLiveAttendance] = useState([]); // owner-only (5F)
  const detectVideoRef = useRef(null);

  const [videoReady, setVideoReady] = useState(false);

  // ---- hooks (each owns ONE concern) ----
  const {
    localStream,
    micOn,
    camOn,
    error: mediaError,
    startStream,
    toggleMic,
    toggleCam,
    stopStream,
    streamRef: mediaRef,
  } = useMediaStream();

  // Emit signals through a ref so useWebRTC can be created before the socket.
  const emitSignalRef = useRef((to, data) => {});

  const emitSignal = useCallback(
    (to, data) => emitSignalRef.current(to, data),
    [],
  );

  const webrtc = useWebRTC(emitSignal);

  // collabRef breaks the socket↔collab wiring cycle (same trick as emitSignalRef)
  const collabRef = useRef(null);
  const enterRoomRef = useRef(null);
  const leaveToHomeRef = useRef(null);


  const screenSharePropsRef = useRef(null);
  screenSharePropsRef.current = {
    getCameraTrack: () => mediaRef?.current?.getVideoTracks()[0] || null,
    onShareStarted: () => socketRef.current?.emit("screen-share-started"),
    onShareStopped: () => socketRef.current?.emit("screen-share-stopped"),
  };
  const screenShare = useScreenShare({
    peersRef: webrtc.peersRef,
    propsRef: screenSharePropsRef,
  });

  const { socketRef, connected, joinCall } = useMeetingSocket({
    onUserJoined: ({ socketId, username: name }) => {
      webrtc.handleNewPeer(socketId); // mesh dialing — UNCHANGED
      // roster placeholder until the authoritative broadcast lands:
      collabRef.current?.handleRosterMember({ socketId, username: name });
    },
    onParticipantLeft: ({ socketId }) => {
      webrtc.removePeer(socketId); // mesh cleanup — UNCHANGED
      collabRef.current?.removeRosterMember(socketId);
    },
    onSignal: (payload) => webrtc.handleSignal(payload),
    onRoster: (p) => collabRef.current?.handleRoster(p), // full state
    onChatReceived: (p) => collabRef.current?.handleIncomingChat(p),
    onReaction: (p) => collabRef.current?.handleReaction(p),
    onPolls: (p) => collabRef.current?.handlePolls(p),
    onDecisions: (p) => collabRef.current?.handleDecisions(p),
    onShareStarted: ({ socketId: sid }) =>
      collabRef.current?.handleShareStarted(sid),
    onShareStopped: () => collabRef.current?.handleShareStopped(),
    onTranscript: (p) => collabRef.current?.handleIncomingTranscript(p),
    onLiveAttendance: (p) => setLiveAttendance(p),

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
      //  identical teardown to leaving voluntarily. The server has already
      // finalized, so `pendingSummary` is what carries the result to Home.
      if (phaseRef.current === 'room') leaveToHomeRef.current?.();
      else {
        setPhase('lobby');
        setJoinError('The meeting was ended by the host.');
      }
    },
  });

  const collab = useMeetingCollab({ socketRef, activeTab });
  collabRef.current = collab; // always-fresh (same pattern as handlersRef)

  // ---- Phase 5 hooks ----
  const { matchState } = useFaceAttendance({
    socketRef,
    enrolledDescriptor,
    videoRef: detectVideoRef,
    videoReady,
    streamRef: mediaRef,
  });

  const speech = useSpeechTranscription((text) => {
    const entry = { username: username, text, at: new Date().toISOString() };
    collab.addLocalTranscript(entry); // my screen shows it now
    socketRef.current?.emit("transcript-entry", { text }); // everyone else gets it attributed
  });

  const isOwner =
    collab.roster.find((p) => p.socketId === mySocketId)?.isOwner || false;

  useEffect(() => {
    emitSignalRef.current = (to, data) => {
      socketRef.current?.emit("signal", { to, data });
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
    if (phase === "lobby") startStream();
  }, [phase, startStream]);

  useEffect(() => {
    if (connected) socketRef.current?.emit("media-state", { micOn, camOn });
  }, [micOn, camOn, connected, socketRef]);

  // opening the chat tab clears its badge
  useEffect(() => {
    if (activeTab === "chat") collab.clearUnread();
  }, [activeTab, collab]);

  // ---- join pipeline (lobby button) ----
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
  // const handleEnrollConfirm = useCallback(async (descriptor) => {
  //   const res = await new Promise((resolve) => {
  //     socketRef.current?.emit('register-face', { descriptor }, (r) => resolve(r));
  //   });
  //   if (res?.ok) {
  //     setEnrolledDescriptor(descriptor); // starts the verification loop (5E)
  //     setEnrollmentOpen(false);
  //     return true;
  //   }
  //   return false;
  // }, [socketRef]);

  const handleEnrollConfirm = useCallback(
    async (descriptor) => {
      console.log("[enrollment] descriptor:", descriptor?.length);

      const res = await new Promise((resolve) => {
        socketRef.current?.emit("register-face", { descriptor }, (r) => {
          resolve(r);
        });
      });

      console.log("[enrollment] server response:", res);

      if (res?.ok) {
        console.log("[enrollment] SUCCESS");

        setEnrolledDescriptor(descriptor);
        setEnrollmentOpen(false);

        return true;
      }

      return false;
    },
    [socketRef],
  );

  // ---- THE TEARDOWN ORDER, now five steps (strict!) ----
  const handleLeave = useCallback(() => {
    screenShare.stopShare(); // 0. revert video senders to camera, stop display
    stopStream(); // 1. stop capture — camera light off, tracks dead
    webrtc.closeAllPeers(); // 2. close every RTCPeerConnection
    socketRef.current?.disconnect(); // 3. kill signaling (server fires disconnect cleanup)
    // 5K handoff: the summary is generated AFTER every socket is gone, so a
    // broadcast would reach nobody. Home picks this up over REST instead.
    sessionStorage.setItem("pendingSummary", code);
    navigate("/home"); // 4. only now leave the page
  }, [screenShare, stopStream, webrtc, socketRef, navigate, code]);

  const handleToggleShare = useCallback(async () => {
    if (screenShare.sharing) screenShare.stopShare();
    else await screenShare.startShare();
  }, [screenShare]);

  const closeAllPeersRef = useRef(webrtc.closeAllPeers);
  closeAllPeersRef.current = webrtc.closeAllPeers;

  useEffect(() => {
    return () => closeAllPeersRef.current();
  }, []);

  if (phase === "lobby") {
    return (
      <LobbyView
        code={code}
        username={username}
        onUsername={setUsername}
        stream={localStream}
        error={joinError || mediaError}
        onJoin={handleJoin}
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
    people: (
      <ParticipantsPanel roster={collab.roster} mySocketId={mySocketId} />
    ),
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
            nameFor={(id) => metaFor(id)?.username || "Guest"}
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
                  setVideoReady(true); // ← CORRECTION (C5): signal "mounted"
                } else {
                  setVideoReady(false);
                }
              }}
              autoPlay
              playsInline
              muted
              style={{
                position: "absolute",
                width: 2,
                height: 2,
                opacity: 0,
                pointerEvents: "none",
              }}
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

      {enrollmentOpen && (
        <EnrollmentModal
          stream={localStream}
          onConfirm={handleEnrollConfirm}
          onSkip={() => setEnrollmentOpen(false)}
        />
      )}
    </main>
  );
}
