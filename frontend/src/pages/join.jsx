import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styles from '../styles/lobby.module.css'; // same visual family as the lobby

// 7B — the unauthenticated guest entry point.
//
// ⚠️ THIS ROUTE IS INTENTIONALLY NOT WRAPPED IN withAuth. It is the whole point:
// a guest is someone with no account. Safety comes from what a guest CANNOT
// reach, not from hiding the page — the server refuses guest attendance
// enrollment, and every report endpoint still requires a Bearer token (401).
export default function JoinPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const canJoin = name.trim().length >= 2;

  const submit = (e) => {
    e.preventDefault();
    if (!canJoin) return;
    // Route state carries the guest identity INTO the meeting page. It does NOT
    // survive a refresh by design — VideoMeet's recovery effect sends a
    // stateless guest back here (there is nothing else to recover from; a guest
    // has no session to rehydrate).
    navigate(`/meeting/${code}`, { state: { guest: true, name: name.trim() } });
  };

  return (
    <main className={styles.lobby}>
      <div className={styles.card}>
        <p className={styles.code}>Joining meeting&nbsp;<strong>{code}</strong></p>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <input
            className={styles.input}
            placeholder="Your name"
            value={name}
            maxLength={30}
            autoFocus
            onChange={(e) => setName(e.target.value)}
          />
          <button className={styles.joinBtn} disabled={!canJoin}>
            Continue as guest
          </button>
        </form>

        <p className={styles.subtitle} style={{ fontSize: '0.8rem' }}>
          Guests can talk, chat and present. Attendance tracking and history are for
          signed-in members.
        </p>
      </div>
    </main>
  );
}