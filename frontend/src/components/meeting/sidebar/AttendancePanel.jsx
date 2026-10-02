import styles from '../../../styles/sidebar.module.css';

export default function AttendancePanel({ snapshot }) {
  if (!snapshot.length) {
    return <p className={styles.empty}>Waiting for verification data… (first tick at ~10s)</p>;
  }
  return (
    <div>
      <p className={styles.panelTitle}>Live attendance</p>
      {snapshot.map((p) => (
        <div key={p.username} className={styles.attRow}>
          <div className={styles.attHead}>
            <span className={styles.pname}>{p.username}</span>
            <span className={styles.meta}>{p.percentage}% · {p.verifiedChecks}/{p.totalChecks} checks</span>
          </div>
          <div className={styles.attBar}>
            <div className={styles.attFill} style={{ width: `${p.percentage}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}