// ⚠️ CORRECTION (C1): `useRef` was MISSING from this import list while the
// component calls `useRef(...)` several times. React does not put hooks on the
// global scope, so this threw `ReferenceError: useRef is not defined` on the
// very first render — /meeting/:code was a guaranteed blank page.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import styles from '../styles/videoComponent.module.css';

export default function VideoMeet() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [phase, setPhase] = useState('lobby');        // 'lobby' | 'room'
  const [username, setUsername] = useState(user?.name || '');
  const [joinError, setJoinError] = useState(null);
  const [activeTab, setActiveTab] = useState('chat'); // sidebar tab (4A)
  const [mySocketId, setMySocketId] = useState(null);

  // ---- hooks (each owns ONE concern) ----
  const {
    localStream, micOn, camOn, error: mediaError,
    startStream, toggleMic, toggleCam, stopStream, streamRef: mediaRef,
  } = useMediaStream();

  // Emit signals through a ref so useWebRTC can be created before the socket.
  const emitSignalRef = useRef((to, data) => {});

  const emitSignal = useCallback((to, data) => emitSignalRef.current(to, data), []);

  const webrtc = useWebRTC(emitSignal);

  // collabRef breaks the socket↔collab wiring cycle (same trick as emitSignalRef)
  const collabRef = useRef(null);

  
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
  });

  const collab = useMeetingCollab({ socketRef, activeTab });
  collabRef.current = collab;      // always-fresh (same pattern as handlersRef)

  
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
  const handleJoin = useCallback(async () => {
    const stream = await startStream();
    if (!stream) return; // mediaError already set by the hook
    
    webrtc.setLocalStream(stream);
    try {
      const res = await joinCall(code, username.trim(), user?.username || null);
     
      const myId = socketRef.current?.id;
      if (myId) webrtc.setMySocketId(myId);
      setMySocketId(myId);
      // Dial everyone already in the room (the deterministic rule in 3G
      // decides who actually offers — both sides run it).
      for (const p of res.participants) {
        if (myId && p.socketId !== myId) webrtc.handleNewPeer(p.socketId);
      }
      collab.seedFromJoin(res);          // 4B — chat history for late joiners
      collab.handleRoster(res.participants); // 4C — initial roster from ack
      setPhase('room');
     
      socketRef.current?.emit('media-state', { micOn, camOn });
    } catch (err) {
      setJoinError(err.message);
    }
  }, [code, username, user, startStream, joinCall, socketRef, webrtc, collab, micOn, camOn]);

  // ---- THE TEARDOWN ORDER, now five steps (strict!) ----
  const handleLeave = useCallback(() => {
    screenShare.stopShare();         // 0. revert video senders to camera, stop display
    stopStream();                    // 1. stop capture — camera light off, tracks dead
    webrtc.closeAllPeers();          // 2. close every RTCPeerConnection
    socketRef.current?.disconnect(); // 3. kill signaling (server fires disconnect cleanup)
    navigate('/home');               // 4. only now leave the page
  }, [screenShare, stopStream, webrtc, socketRef, navigate]);

  const handleToggleShare = useCallback(async () => {
    if (screenShare.sharing) screenShare.stopShare();
    else await screenShare.startShare();
  }, [screenShare]);

 
  const closeAllPeersRef = useRef(webrtc.closeAllPeers);
  closeAllPeersRef.current = webrtc.closeAllPeers;

  useEffect(() => {
    return () => closeAllPeersRef.current();
  }, []);

  if (phase === 'lobby') {
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
          />
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
          badges={{ chat: collab.unread }}
          panels={panels}
        />
      </div>
    </main>
  );
}
