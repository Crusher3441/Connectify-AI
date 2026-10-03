import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../utils/apiClient';
import PageHeader from '../components/PageHeader';
import styles from '../styles/pages.module.css';

export default function HistoryPage() {
  const navigate = useNavigate();
  const [state, setState] = useState('loading'); // loading|ready|error
  const [meetings, setMeetings] = useState([]);
  const [error, setError] = useState(null);

  const load = () => {
    setState('loading');
    setError(null);
    apiClient
      .get('/users/me/history')
      .then((res) => {
        setMeetings(res.data.items || res.data || []); // tolerate either shape
        setState('ready');
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Could not load your meetings');
        setState('error');
      });
  };

  useEffect(load, []);

  return (
    <main className={styles.page}>
      <PageHeader
        title="Your meetings"
        subtitle="Every meeting you've created or joined."
      />

      {state === 'error' && (
        <div className={styles.errorBox}>
          <span>{error}</span>
          <button className={styles.smallBtn} onClick={load}>Retry</button>
        </div>
      )}

      {state === 'loading' && (
        <>
          <div className={styles.skeleton} />
          <div className={styles.skeleton} />
          <div className={styles.skeleton} />
        </>
      )}

      {state === 'ready' && meetings.length === 0 && (
        <p className={styles.subtitle}>
          No meetings yet — create one from the home page.
        </p>
      )}

      {state === 'ready' &&
        meetings
          .slice() // copy before sorting — never mutate state
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .map((m) => (
            <div key={m._id || m.meetingCode} className={styles.card}>
              <div className={styles.cardRow}>
                <span className={styles.code}>{m.meetingCode}</span>
                <span className={styles.grow} />
                <span className={styles.meta}>
                  {new Date(m.date).toLocaleString([], {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
                {/* ⚠️ CORRECTION (H5): this was
                    onClick={() => navigate(`/meeting/${m.meetingCode}`)} with the
                    label "Rejoin". For a PAST meeting that path starts a brand-new
                    live meeting that reuses an old code — clicking a finished row
                    silently spun up a fresh room and registered it in history again.
                    Past meetings open their REPORT; only the /home join box starts
                    a meeting. */}
                <button
                  className={styles.smallBtn}
                  onClick={() => navigate(`/attendance?code=${m.meetingCode}`)}
                >
                  View report
                </button>
              </div>
            </div>
          ))}
    </main>
  );
}