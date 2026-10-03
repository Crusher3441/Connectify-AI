import { Link } from 'react-router-dom';
import styles from '../styles/pages.module.css';

// 7D — the catch-all target. Reachable only because every real route is matched
// FIRST; React Router v6 ranks routes by specificity, so `/meeting/abc123` still
// wins over `*` and this only renders for genuinely unknown paths.
export default function NotFound() {
  return (
    <main
      className={styles.page}
      style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
    >
      <h1 className={styles.title} style={{ fontSize: '4rem' }}>404</h1>
      <p className={styles.subtitle}>
        That page doesn't exist — the link may be old, or the code mistyped.
      </p>
      <Link
        to="/home"
        className={styles.smallBtn}
        style={{ textDecoration: 'none', width: 'fit-content' }}
      >
        Back to home
      </Link>
    </main>
  );
}