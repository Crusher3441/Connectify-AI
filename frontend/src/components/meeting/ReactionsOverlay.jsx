import styles from '../../styles/videoComponent.module.css';

export default function ReactionsOverlay({ reactions, onDone }) {
  return (
    <div className={styles.reactionOverlay} aria-hidden>
      {reactions.map((r) => (
        <span
          key={r.key}
          className={styles.reactionBubble}
          style={{ left: `${r.x}%` }}
          onAnimationEnd={() => onDone?.(r.key)}
        >
          {r.emoji}
        </span>
      ))}
    </div>
  );
}
