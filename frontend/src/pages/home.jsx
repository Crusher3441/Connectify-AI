import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import styles from '../styles/home.module.css';

// Cryptographically random meeting code (audit #14). Math.random() is
// predictable — its output must never gate access to anything.
const newMeetingCode = () => crypto.randomUUID().split('-')[0]; // e.g. "a3f2b1c4"

export default function HomePage() {
  const navigate = useNavigate();
  const { user, logout, fetchHistory, addMeetingToHistory } = useAuth();

  const [meetings, setMeetings] = useState(null); // null = loading
  const [error, setError] = useState(null);
  const [joinInput, setJoinInput] = useState('');

  useEffect(() => {
    fetchHistory()
      .then((data) => setMeetings(data.items || []))
      .catch((err) => setError(err.response?.data?.message || 'Could not load your meetings'));
  }, [fetchHistory]);

  // Create → register in history → navigate. The history POST is not
  // bookkeeping: Phase 7's waiting room reads Meeting docs to decide who
  // the host is (decision D1). This line IS the host registry.
  const createMeeting = async () => {
    setError(null);
    const code = newMeetingCode();
    try {
      await addMeetingToHistory(code);
      navigate(`/meeting/${code}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create the meeting');
    }
  };

  const joinMeeting = (e) => {
    e.preventDefault();
    const code = joinInput.trim().toLowerCase();
    if (/^[a-z0-9]{4,12}$/.test(code)) navigate(`/meeting/${code}`);
    else setError('Codes are 4–12 letters/numbers');
  };

  const signOut = () => {
    logout();
    navigate('/');
  };

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <span className={styles.logo}>MeetSync <span className={styles.accent}>AI</span></span>
        <button className={styles.ghostBtn} onClick={signOut}>Log out</button>
      </header>

      <section className={styles.welcome}>
        <h1>Welcome, {user?.name || 'friend'}</h1>
        <p className={styles.sub}>Start a meeting or join one with a code.</p>
      </section>

      {error && <div className={styles.errorBox}>{error}</div>}

      <section className={styles.actions}>
        <button className={styles.primaryBtn} onClick={createMeeting}>＋ Create meeting</button>
        <form className={styles.joinForm} onSubmit={joinMeeting}>
          <input
            className={styles.joinInput}
            placeholder="Meeting code"
            value={joinInput}
            maxLength={12}
            onChange={(e) => setJoinInput(e.target.value)}
          />
          <button className={styles.ghostBtn} type="submit">Join</button>
        </form>
      </section>

      <section className={styles.history}>
        <h2 className={styles.historyTitle}>Recent meetings</h2>
        {meetings === null && <div className={styles.skeleton} />}
        {meetings !== null && meetings.length === 0 && (
          <p className={styles.empty}>No meetings yet — create one above.</p>
        )}
        {meetings !== null && meetings.map((m) => (
          <div key={m._id} className={styles.historyRow}>
            <span className={styles.code}>{m.meetingCode}</span>
            <span className={styles.grow} />
            <span className={styles.meta}>
              {new Date(m.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
            </span>
            <button className={styles.ghostBtn} onClick={() => navigate(`/meeting/${m.meetingCode}`)}>
              Open
            </button>
          </div>
        ))}
      </section>
    </main>
  );
}
