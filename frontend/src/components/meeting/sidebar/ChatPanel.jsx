import { useEffect, useRef, useState } from 'react';
import styles from '../../../styles/sidebar.module.css';

export default function ChatPanel({ messages, onSend, mySocketId }) {
  const [text, setText] = useState('');
  const listRef = useRef(null);
  const stickRef = useRef(true); // autoscroll only while user is at the bottom

  useEffect(() => {
    const el = listRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  const submit = (e) => {
    e.preventDefault();
    const clean = text.trim();
    if (!clean) return;
    onSend(clean);        // server sanitizes/caps too — this is just fast feedback
    setText('');
    stickRef.current = true;
  };

  return (
    <div className={styles.chat}>
      <p className={styles.panelTitle}>Chat</p>
      <div className={styles.messages} ref={listRef} onScroll={handleScroll}>
        {messages.length === 0 && (
          <p className={styles.empty}>No messages yet — say hi 👋</p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`${styles.msg} ${m.from === mySocketId ? styles.mine : ''}`}
          >
            <span className={styles.msgName}>{m.username}</span>
            <span className={styles.msgText}>{m.text}</span>
            <span className={styles.msgTime}>
              {new Date(m.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
      </div>
      <form className={styles.chatForm} onSubmit={submit}>
        <input
          className={styles.chatInput}
          value={text}
          maxLength={500}
          placeholder="Message everyone"
          onChange={(e) => setText(e.target.value)}
        />
        <button className={styles.sendBtn} disabled={!text.trim()}>Send</button>
      </form>
    </div>
  );
}
