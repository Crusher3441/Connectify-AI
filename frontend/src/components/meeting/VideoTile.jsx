import { useEffect, useRef } from 'react';
import styles from '../../styles/videoComponent.module.css';

// Dumb tile: attach stream, show name. Zero logic.
export default function VideoTile({ stream, name, isLocal = false }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !stream) return;
    el.srcObject = stream;
    el.play?.().catch(() => {}); // autoplay-policy rejections are harmless here
  }, [stream]);

  return (
    <div className={styles.tile}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}   // LOCAL: always muted (no echo). REMOTE: must play audio!
      />
      <span className={styles.nameTag}>
        {name}{isLocal ? ' (you)' : ''}
      </span>
    </div>
  );
}