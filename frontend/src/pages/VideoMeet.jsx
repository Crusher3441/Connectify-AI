import { useCallback, useEffect, useState, useRef} from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext'; // Phase 2; see note below
import { useMeetingSocket } from '../hooks/useMeetingSocket';
import { useMediaStream } from '../hooks/useMediaStream';
import { useWebRTC } from '../hooks/useWebRTC';
import LobbyView from '../components/meeting/LobbyView';
import VideoGrid from '../components/meeting/VideoGrid';
import MeetingControls from '../components/meeting/MeetingControls';
import styles from '../styles/videoComponent.module.css';

export default function VideoMeet() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [phase, setPhase] = useState('lobby');        // 'lobby' | 'room'
  const [username, setUsername] = useState(user?.name || '');
  const [joinError, setJoinError] = useState(null);
  const [names, setNames] = useState({});             // socketId → username

  // ---- hooks (each owns ONE concern) ----
  const { localStream, micOn, camOn, error: mediaError, startStream, toggleMic, toggleCam, stopStream } = useMediaStream();

  // Emit signals through a ref so useWebRTC can be created before the socket
  const emitSignalRef = useRef((to, data) => {});
  const webrtc = useWebRTC((to, data) => emitSignalRef.current(to, data));

  const { socketRef, connected, joinCall } = useMeetingSocket({
    onUserJoined: ({ socketId, username: name }) => {
      setNames((prev) => ({ ...prev, [socketId]: name }));
      webrtc.handleNewPeer(socketId);
    },
    onParticipantLeft: ({ socketId }) => {
      setNames((prev) => { const n = { ...prev }; delete n[socketId]; return n; });
      webrtc.removePeer(socketId);
    },
    onSignal: (payload) => webrtc.handleSignal(payload),
  });

  // Keep WebRTC's notion of "me" and "my media" current.
  useEffect(() => {
    if (connected && socketRef.current?.id) webrtc.setMySocketId(socketRef.current.id);
  }, [connected, socketRef, webrtc]);

  useEffect(() => {
    webrtc.setLocalStream(localStream);
  }, [localStream, webrtc]);

  // ---- join pipeline (lobby button) ----
  const handleJoin = useCallback(async () => {
    const stream = await startStream();
    if (!stream) return; // mediaError already set by the hook
    try {
      const res = await joinCall(code, username.trim());
      webrtc.setMySocketId(socketRef.current.id);
      setNames(
        Object.fromEntries(res.participants.map((p) => [p.socketId, p.username]))
      );
      // Dial everyone already in the room (the deterministic rule in 3G
      // decides who actually offers — both sides run it).
      for (const p of res.participants) {
        if (p.socketId !== socketRef.current.id) webrtc.handleNewPeer(p.socketId);
      }
      setPhase('room');
    } catch (err) {
      setJoinError(err.message);
    }
  }, [code, username, startStream, joinCall, socketRef, webrtc]);

  // ---- THE TEARDOWN ORDER (strict!) ----
  const handleLeave = useCallback(() => {
    stopStream();                    // 1. stop capture — camera light off, tracks dead
    webrtc.closeAllPeers();          // 2. close every RTCPeerConnection
    socketRef.current?.disconnect(); // 3. kill signaling (server fires disconnect cleanup)
    navigate('/home');               // 4. only now leave the page
  }, [stopStream, webrtc, socketRef, navigate]);

  // Browser-back / tab-close safety net: same as 1–2; the socket hook (3C)
  // handles step 3 on unmount, and useMediaStream (3D) handles step 1.
  useEffect(() => {
    return () => webrtc.closeAllPeers();
  }, [webrtc]);

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

  return (
    <main className={styles.meetingRoot}>
      <VideoGrid
        localStream={localStream}
        remoteStreams={webrtc.remoteStreams}
        myName={username}
        nameFor={(id) => names[id] || 'Guest'}
      />
      <MeetingControls
        micOn={micOn}
        camOn={camOn}
        onToggleMic={toggleMic}
        onToggleCam={toggleCam}
        onLeave={handleLeave}
      />
    </main>
  );
}
