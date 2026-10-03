import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BACKEND_URL } from '../environment';
import styles from '../styles/landing.module.css';

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();           // present? don't send them to log in again

  const [backendStatus, setBackendStatus] = useState('checking');

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/health`)
      .then((res) => setBackendStatus(res.ok ? 'up' : 'down'))
      .catch(() => setBackendStatus('down'));
  }, []);

  // Signed-in users skip /auth — same reasoning as 2I's bounce effect.
  const goToApp = () => navigate(user ? '/home' : '/auth');

  return (
    <main className={styles.hero}>
      <header className={styles.navbar}>
        <span className={styles.logo}>
          MeetSync <span className={styles.logoAccent}>AI</span>
        </span>
        {user && (
          <button className={styles.ghostBtn} onClick={() => navigate('/home')}>
            Go to dashboard
          </button>
        )}
      </header>

      <section className={styles.content}>
        <h1>
          Meetings that <span className={styles.accent}>attend themselves</span>.
        </h1>
        <p className={styles.tagline}>
          Video calls with automatic attendance, live transcription and AI
          summaries.
        </p>

        <div className={styles.actions}>
          {/* ⚠️ CORRECTION (H8): these two finally navigate. */}
          <button className={styles.primaryBtn} onClick={goToApp}>Get Started</button>
          {/* The only join-by-code UI in Phase 2 is the input on /home.
              Phase 7B upgrades this to a direct /join/:code prompt. */}
          <button className={styles.ghostBtn} onClick={goToApp}>I have a meeting code</button>
        </div>

        <div className={`${styles.statusCard} ${styles[backendStatus]}`}>
          <span className={styles.statusDot} />
          {backendStatus === 'checking' && 'Checking backend…'}
          {backendStatus === 'up' && 'Backend online — API healthy'}
          {backendStatus === 'down' && 'Backend offline — start it with npm run dev'}
        </div>
      </section>
    </main>
  );
}