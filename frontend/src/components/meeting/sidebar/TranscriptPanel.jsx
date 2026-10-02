import { useAutoScroll } from '../../../hooks/useAutoScroll';
import styles from '../../../styles/sidebar.module.css';

export default function TranscriptPanel({ transcripts, supported, listening, error, onToggle }) {
  const { ref, onScroll } = useAutoScroll(transcripts);

  return (
    <div className={styles.chat}>  {/* reuses chat's column layout */}
      <p className={styles.panelTitle}>Live transcript</p>

      {!supported && (
        <p className={styles.empty}>
          Live transcription needs Chrome or Edge — you can still read others' transcripts here.
        </p>
      )}
      {error && <p className={styles.formError}>{error}</p>}

      <div className={styles.messages} ref={ref} onScroll={onScroll}>
        {transcripts.length === 0 && <p className={styles.empty}>Nothing said yet.</p>}
        {transcripts.map((t, i) => (
          <div key={i} className={styles.msg}>
            <span className={styles.msgName}>
              {t.username} · {new Date(t.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className={styles.msgText}>{t.text}</span>
          </div>
        ))}
      </div>

      {supported && (
        <button className={styles.sendBtn} onClick={onToggle}>
          {listening ? '⏹ Stop transcribing me' : '🎤 Transcribe me'}
        </button>
      )}
    </div>
  );
}