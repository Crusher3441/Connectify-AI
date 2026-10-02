import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { BACKEND_URL } from '../environment';

// Owns THE socket connection for a meeting session.
// Callers pass event handlers; the hook dispatches server events to them.
export const useMeetingSocket = (handlers) => {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);

  // THE always-fresh-handlers pattern:
  // handlersRef.current is updated on EVERY render, so callbacks can close
  // over fresh state without the socket ever re-subscribing. Without this,
  // you either subscribe to stale closures (bugs) or reconnect on every
  // render (chaos).
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    // One connection per mount. The cleanup disconnects it — StrictMode's
    // mount→unmount→mount therefore produces exactly one live socket.
    const socket = io(BACKEND_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    const pairs = [
      ['connect', () => { setConnected(true); setError(null); }],
      ['disconnect', () => setConnected(false)],
      ['connect_error', (err) => setError(err.message)],
      // Phase 3 — mesh lifecycle + signaling (unchanged)
      ['user-joined', (p) => handlersRef.current.onUserJoined?.(p)],
      ['participant-left', (p) => handlersRef.current.onParticipantLeft?.(p)],
      ['signal', (p) => handlersRef.current.onSignal?.(p)],
      // Phase 4 — collaboration (handlers fill in through 4G)
      ['chat-received', (p) => handlersRef.current.onChatReceived?.(p)],
      ['participant-list', (p) => handlersRef.current.onRoster?.(p)],
      ['reaction-received', (p) => handlersRef.current.onReaction?.(p)],
      ['polls-updated', (p) => handlersRef.current.onPolls?.(p)],
      ['decisions-updated', (p) => handlersRef.current.onDecisions?.(p)],
      ['screen-share-started', (p) => handlersRef.current.onShareStarted?.(p)],
      ['screen-share-stopped', (p) => handlersRef.current.onShareStopped?.(p)],
    ];
    pairs.forEach(([event, fn]) => socket.on(event, fn));

    return () => {
      pairs.forEach(([event, fn]) => socket.off(event, fn));
      socket.disconnect();
    };
  }, []);
  const joinCall = useCallback(
    (code, username, authUsername = null) =>
      new Promise((resolve, reject) => {
        socketRef.current?.emit(
          'join-call',
          { code, username, authUsername },
          (res) => {
            if (res?.ok) resolve(res);
            else reject(new Error(res?.message || 'Could not join meeting'));
          }
        );
      }),
    []
  );

  return { socketRef, connected, error, joinCall };
};
