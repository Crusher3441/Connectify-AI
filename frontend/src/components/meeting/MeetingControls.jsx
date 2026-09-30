import styles from '../../styles/videoComponent.module.css';

export default function MeetingControls({ micOn, camOn, onToggleMic, onToggleCam, onLeave }) {
  return (
    <div className={styles.controls}>
      <button className={styles.ctrlBtn} onClick={onToggleMic}>
        {micOn ? '🎙 Mic on' : '🔇 Mic off'}
      </button>
      <button className={styles.ctrlBtn} onClick={onToggleCam}>
        {camOn ? '📹 Cam on' : '📷 Cam off'}
      </button>
      <button className={`${styles.ctrlBtn} ${styles.leaveBtn}`} onClick={onLeave}>
        Leave
      </button>
    </div>
  );
}
