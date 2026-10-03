import { useEffect, useRef } from 'react';
import styles from '../../styles/videoComponent.module.css';

// Dumb tile: attach stream, show name. Zero logic.
// matchState ('none'|'verified'|'unverified') is passed ONLY to the local tile —
// a remote tile never receives someone's verification status.
export default function VideoTile({ stream, name, isLocal = false, isOwner = false, raised = false, pill, matchState = 'none' }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !stream) return;
    el.srcObject = stream;
    el.play?.().catch(() => {}); // autoplay-policy rejections are harmless here
  }, [stream]);

  return (
    <div
      className={`${styles.tile} ${matchState === 'verified' ? styles.verified : ''} ${matchState === 'unverified' ? styles.unverified : ''}`}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}   // LOCAL: always muted (no echo). REMOTE: must play audio!
      />
      {raised && <span className={styles.handBadge}>✋</span>}
      {pill && <span className={styles.sharePill}>{pill}</span>}
      <span className={styles.nameTag}>
        {/* 7C — the crown marks WHO can admit and end the meeting. It is
            derived from the roster's isOwner flag, never from client state. */}
        {isOwner && '👑 '}{name}{isLocal ? ' (you)' : ''}
      </span>
    </div>
  );
}