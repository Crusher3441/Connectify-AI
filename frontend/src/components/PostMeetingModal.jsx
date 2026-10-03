import styles from '../styles/enrollment.module.css'; // reuse overlay/card classes

export default function PostMeetingModal({ data, onClose }) {
  const s = data?.summary;
  if (!s) return null;
  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <div className={styles.badgeRow}>
          <h2 className={styles.title}>{s.title || 'Meeting summary'}</h2>
          <span className={`${styles.sourceBadge} ${s.source === 'gpt' ? styles.gpt : styles.kw}`}>
            {s.source === 'gpt' ? 'AI summary' : 'Keyword summary'}
          </span>
        </div>

        <p className={styles.summaryText}>{s.summary}</p>

        {s.keyPoints?.length > 0 && (
          <>
            <p className={styles.sectionTitle}>Key points</p>
            <ul className={styles.list}>
              {s.keyPoints.map((k, i) => <li key={i}>{k}</li>)}
            </ul>
          </>
        )}

        {data.actionItems?.length > 0 && (
          <>
            <p className={styles.sectionTitle}>Action items</p>
            <ul className={styles.list}>
              {data.actionItems.map((a) => (
                <li key={a._id || a.task}>
                  {a.task}
                  {a.assignedTo ? ` — ${a.assignedTo}` : ''}
                  {a.status !== 'open' ? ` (${a.status})` : ''}
                </li>
              ))}
            </ul>
          </>
        )}

        {s.decisions?.length > 0 && (
          <>
            <p className={styles.sectionTitle}>Decisions</p>
            <ul className={styles.list}>
              {s.decisions.map((d, i) => <li key={i}>{d}</li>)}
            </ul>
          </>
        )}

        <button className={styles.primaryBtn} onClick={onClose}>Done</button>
      </div>
    </div>
  );
}