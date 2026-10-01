import { useCallback, useRef, useState } from 'react';

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

  return {
    // chat
    messages, unread, sendChat, clearUnread,
    handleIncomingChat, seedFromJoin,
  };
};
