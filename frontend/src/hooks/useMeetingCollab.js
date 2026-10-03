import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// One hook for all collaboration state, so VideoMeet stays an orchestrator.
// socketRef: from useMeetingSocket. activeTab: current sidebar tab (for unread).
export const useMeetingCollab = ({ socketRef, activeTab }) => {
  // ---- chat (4B) ----
  const [messages, setMessages] = useState([]);
  const [unread, setUnread] = useState(0);

  const handleIncomingChat = useCallback(
    (m) => {
      setMessages((prev) => [...prev.slice(-199), m]);
      if (activeTab !== 'chat') setUnread((u) => u + 1);
    },
    [activeTab]
  );

  const sendChat = useCallback((text) => {
    socketRef.current?.emit('chat-message', { text });
  }, [socketRef]);

  const clearUnread = useCallback(() => setUnread(0), []);

  const seedFromJoin = useCallback(({ participants = [], messages: history = [] }) => {
    setMessages(history);
    setUnread(0);
  }, []);

  // ---- roster (4C) ----
  const [roster, setRoster] = useState([]);

  const handleRoster = useCallback((list) => setRoster(list), []); // full replace — authoritative

  const handleRosterMember = useCallback((p) =>
    setRoster((prev) => (prev.some((x) => x.socketId === p.socketId) ? prev : [...prev, p]))
  , []);                                    // optimistic placeholder between join & broadcast

  const removeRosterMember = useCallback((socketId) =>
    setRoster((prev) => prev.filter((x) => x.socketId !== socketId))
  , []);

  // ---- hand raise ----
  const toggleHand = useCallback(() => {
    socketRef.current?.emit('toggle-hand');
    // NO local state — the roster broadcast flips the button label.
    // One source of truth beats optimistic flicker at 100ms latency.
  }, [socketRef]);

  // ---- reactions ----
  const [reactions, setReactions] = useState([]);

  const reactionTimersRef = useRef(new Map());
  useEffect(() => {
    const timers = reactionTimersRef.current;
    return () => {
      timers.forEach((id) => clearTimeout(id));
      timers.clear();
    };
  }, []);

  const removeReaction = useCallback((key) =>
    setReactions((prev) => prev.filter((r) => r.key !== key))
  , []);

  const handleReaction = useCallback(({ emoji }) => {
    const key = crypto.randomUUID();
    const x = 10 + Math.random() * 80;                 // random horizontal spawn
    
    setReactions((prev) => [...prev.slice(-29), { key, emoji, x }]);
    // evict after the animation window even if onAnimationEnd never fires
    const id = setTimeout(() => {
      removeReaction(key);
      reactionTimersRef.current.delete(key);
    }, 3600);
    reactionTimersRef.current.set(key, id);
  }, [removeReaction]);

  const react = useCallback((emoji) => {
    socketRef.current?.emit('send-reaction', { emoji });
  }, [socketRef]);

  // ---- polls & decisions (4F) ----
  const [polls, setPolls] = useState([]);
  const [decisions, setDecisions] = useState([]);

  const handlePolls = useCallback((list) => setPolls(list), []);
  const handleDecisions = useCallback((list) => setDecisions(list), []);

  const createPoll = useCallback((question, options) =>
    new Promise((resolve) => {
      const socket = socketRef.current;
      if (!socket) return resolve({ ok: false, message: 'Not connected to the meeting' });
      const timer = setTimeout(
        () => resolve({ ok: false, message: 'The server did not respond — try again' }),
        8000
      );
      socket.emit('create-poll', { question, options }, (res) => {
        clearTimeout(timer);
        resolve(res);
      });
    }), [socketRef]);

  const vote = useCallback((pollId, optionIndex) => {
    socketRef.current?.emit('vote-poll', { pollId, optionIndex });
  }, [socketRef]);

  const addDecision = useCallback((text) => {
    socketRef.current?.emit('add-decision', { text });
  }, [socketRef]);

  // ---- screen share presence (4G) ----
  const [sharerId, setSharerId] = useState(null);
  const handleShareStarted = useCallback((socketId) => setSharerId(socketId), []);
  const handleShareStopped = useCallback(() => setSharerId(null), []);

  
  return useMemo(
    () => ({
      // chat
      messages, unread, sendChat, clearUnread,
      handleIncomingChat, seedFromJoin,
      // roster
      roster, handleRoster, handleRosterMember, removeRosterMember,
      // hand
      toggleHand,
      // reactions
      reactions, removeReaction, handleReaction, react,
      // polls & decisions
      polls, decisions, handlePolls, handleDecisions,
      createPoll, vote, addDecision,
      // screen share
      sharerId, handleShareStarted, handleShareStopped,
    }),
    [
      messages, unread, sendChat, clearUnread, handleIncomingChat, seedFromJoin,
      roster, handleRoster, handleRosterMember, removeRosterMember,
      toggleHand,
      reactions, removeReaction, handleReaction, react,
      polls, decisions, handlePolls, handleDecisions, createPoll, vote, addDecision,
      sharerId, handleShareStarted, handleShareStopped,
    ]
  );
};
