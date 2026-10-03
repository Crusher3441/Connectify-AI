import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../utils/apiClient';
import PostMeetingModal from '../components/PostMeetingModal';
import styles from '../styles/home.module.css';

// Cryptographically random meeting code Math.random() is
// predictable — its output must never gate access to anything.
const newMeetingCode = () => crypto.randomUUID().split('-')[0]; // e.g. "a3f2b1c4"

export default function HomePage() {
  const navigate = useNavigate();
  const { user, logout, fetchHistory, addMeetingToHistory } = useAuth();

  const [meetings, setMeetings] = useState(null); // null = loading
  const [error, setError] = useState(null);
  const [joinInput, setJoinInput] = useState('');
  const [summaryData, setSummaryData] = useState(null); 

  // VideoMeet left a one-shot flag in sessionStorage before
  // navigating. Consume it BEFORE fetching, so a failed fetch never re-triggers
  // the modal on every future visit to Home.
  //
  //this fetch RACES the server's finalizer, so it must
  // retry on 404 rather than fetch once.
  //
  // The sequence is: the last socket disconnects → the server runs
  // `finalizeMeeting` (attendance write, then transcript + AI summary, then
  // action items) → meanwhile this page has ALREADY mounted and asked for the
  // summary. Nothing waits for that save. With a keyword fallback it usually
  // wins the race by luck; with a real GPT call it loses almost every time,
  // because summarization can take seconds. The single fetch then 404s and the
  // post-meeting modal silently never appears — the "Modal never appears" entry
  // in Phase 5's troubleshooting list, whose real cause was never this.
  //
  // A 404 here is specifically "not written YET", which is different from 403
  // ("not your meeting") and from a network/500 error. Only the 404 is retried:
  // retrying the others would just spam the server, and a 403 would never
  // resolve to 200 no matter how long we waited.
  useEffect(() => {
    const code = sessionStorage.getItem('pendingSummary');
    if (!code) return;
    
    const at = Number(sessionStorage.getItem('pendingSummaryAt') || 0);
    sessionStorage.removeItem('pendingSummary');   // consume it — once, whatever the outcome
    sessionStorage.removeItem('pendingSummaryAt');

    let cancelled = false;
    const isFresh = Date.now() - at < 60_000;
    // ~11s total, backoff-weighted: fast for the keyword path, patient enough
    // for a slow model call. Long enough to cover the save, short enough that a
    // genuinely thin meeting (no summary will ever exist) gives up quietly.
    const BACKOFF_MS = [300, 600, 1200, 2000, 3000, 4000];

    const fetchSummary = async (attempt = 0) => {
      try {
        const res = await apiClient.get(`/transcripts/me/${code}`);
        if (!cancelled) setSummaryData(res.data);
      } catch (err) {
        const status = err.response?.status;
        const canRetry = isFresh && status === 404 && attempt < BACKOFF_MS.length;
        if (canRetry && !cancelled) {
          setTimeout(() => fetchSummary(attempt + 1), BACKOFF_MS[attempt]);
        }
        // Otherwise give up silently — same as before, but now we actually
        // waited long enough for a summary that was merely slow to arrive.
      }
    };

    fetchSummary();
    return () => { cancelled = true; };  // don't setState after unmount
  }, []);

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

      <div className={styles.browseRow}>
        {[
          { to: '/history', label: 'Meeting history' },
          { to: '/attendance', label: 'Attendance reports' },
          { to: '/analytics', label: 'Analytics' },
        ].map((c) => (
          <button key={c.to} className={styles.browseCard} onClick={() => navigate(c.to)}>
            {c.label}
          </button>
        ))}
      </div>

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

      {summaryData && (
        <PostMeetingModal data={summaryData} onClose={() => setSummaryData(null)} />
      )}
    </main>
  );
}