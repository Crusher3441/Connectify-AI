import { useState } from 'react';
import styles from '../../styles/videoComponent.module.css';

const EMOJIS = ['👍', '👏', '❤️', '😂', '😮', '🎉', '🙌', '🔥'];

export default function MeetingControls({ micOn, camOn, isOwner = false ,onEndAll ,handRaised, sharing, onToggleMic, onToggleCam, onToggleHand,  onToggleShare, onReact, onLeave }) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <div className={styles.controls}>
      {showPicker && (
        <div className={styles.picker}>
          {EMOJIS.map((e) => (
            <button key={e} className={styles.pickerBtn} onClick={() => { onReact(e); setShowPicker(false); }}>
              {e}
            </button>
          ))}
        </div>
      )}

      <button className={styles.ctrlBtn} onClick={onToggleMic}>
        {micOn ? '🎙 Mic on' : '🔇 Mic off'}
      </button>
      <button className={styles.ctrlBtn} onClick={onToggleCam}>
        {camOn ? '📹 Cam on' : '📷 Cam off'}
      </button>
      <button className={`${styles.ctrlBtn} ${handRaised ? styles.active : ''}`} onClick={onToggleHand}>
        {handRaised ? '✋ Lower hand' : '✋ Raise hand'}
      </button>
      <button className={styles.ctrlBtn} onClick={() => setShowPicker((s) => !s)}>😀</button>
      <button className={`${styles.ctrlBtn} ${sharing ? styles.active : ''}`} onClick={onToggleShare}>
        {sharing ? '🖥 Stop sharing' : '🖥 Share screen'}
      </button>
      <button className={`${styles.ctrlBtn} ${styles.leaveBtn}`} onClick={onLeave}>
        Leave
      </button>
      {isOwner && (
        <button
          className={`${styles.ctrlBtn} ${styles.leaveBtn}`}
          onClick={() => {
            // Friction, not a design system: this ends the call for everyone.
            if (window.confirm('End the meeting for EVERYONE?')) onEndAll();
          }}
        >
          End for all
        </button>
      )}
    </div>
  );
}

