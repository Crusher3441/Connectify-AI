import { useEffect, useState } from 'react';
import { BACKEND_URL } from '../environment';
import styles from '../styles/landing.module.css';
import { useNavigate } from "react-router-dom";
import { useAuth } from '../contexts/AuthContext';

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth(); 
  // 'checking' → 'up' | 'down': this card is the phase's end-to-end proof.
  // React (:3000) fetches Express (:8000) through CORS and shows the result.
  const [backendStatus, setBackendStatus] = useState('checking');

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/health`)
      .then((res) => setBackendStatus(res.ok ? 'up' : 'down'))
      .catch(() => setBackendStatus('down'));
  }, []);

  const goToApp = () => navigate(user ? '/home' : '/auth');
  return (
    <main className={styles.hero}>
      <header className={styles.navbar}>
        <span className={styles.logo}>
          MeetSync <span className={styles.logoAccent}>AI</span>
        </span>
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
          
          <button className={styles.primaryBtn} onClick={goToApp}>Get Started</button>
          <button className={styles.ghostBtn} onClick={goToApp}>I have a meeting code</button>
        </div>

        <div className={`${styles.statusCard} ${styles[backendStatus]}`}>
          <span className={styles.statusDot} />
          {backendStatus === 'checking' && 'Checking backend…'}
          {backendStatus === 'up' && 'Backend online — API healthy'}
          {backendStatus === 'down' &&
            'Backend offline — start it with npm run dev'}
        </div>
      </section>
    </main>
  );
}
