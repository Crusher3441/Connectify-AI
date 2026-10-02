import styles from '../../../styles/sidebar.module.css';

export default function ParticipantsPanel({ roster, mySocketId }) {
  return (
    <div>
      <p className={styles.panelTitle}>{roster.length} in call</p>
      {roster.map((p) => (
        <div key={p.socketId} className={styles.row}>
          <span className={styles.avatar}>{p.username[0]?.toUpperCase()}</span>
          <span className={styles.pname}>
            {p.username}
            {p.socketId === mySocketId ? ' (you)' : ''}
          </span>
          {p.isOwner && <span title="Meeting owner">👑</span>}
          {p.raisedHand && <span title="Hand raised">✋</span>}
          <span className={styles.meta}>
            {p.micOn ? '🎙' : '🔇'} {p.camOn ? '📹' : '🚫'}
          </span>
        </div>
      ))}
    </div>
  );
}
