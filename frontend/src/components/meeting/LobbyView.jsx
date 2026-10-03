import styles from '../../styles/lobby.module.css';

// Presentational pre-join screen.
// Props:
//   code        — meeting code from the URL
//   username    — prefill from AuthContext (Phase 2) or the guest form (7B)
//   onUsername  — keep typed name in parent state
//   stream      — local camera stream (owned by VideoMeet, Part 3D decision)
//   error       — media error text (permission denied etc.)
//   onJoin      — parent's join pipeline (start media → join-call → enter room)
//   awaiting    — 7A: request sent, the host has not answered yet
export default function LobbyView({ code, username, onUsername, stream, error, onJoin, awaiting = false }) {
  const canJoin = username.trim().length >= 2 && !!stream;

  return (
    <main className={styles.lobby}>
      <div className={styles.card}>
        <p className={styles.code}>Meeting&nbsp;<strong>{code}</strong></p>

        <div className={styles.preview}>
          {stream ? (
            <video
              className={styles.video}
              ref={(el) => { if (el) { el.srcObject = stream; el.play().catch(() => {}); } }}
              autoPlay        // required — video won't start without it
              playsInline     // required — iOS would go fullscreen otherwise
              muted           // required — hearing yourself = echo howl
            />
          ) : (
            <div className={styles.placeholder}>Starting camera…</div>
          )}
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <input
          className={styles.input}
          placeholder="Your name"
          value={username}
          maxLength={30}
          onChange={(e) => onUsername(e.target.value)}
        />

        {/* 7A — awaiting replaces the button: the request is in, so re-clicking
            would queue a duplicate pending entry for the same socket. */}
        {awaiting ? (
          <div className={styles.waiting}>
            <div className={styles.spinner} />
            <p>Waiting for the host to let you in…</p>
          </div>
        ) : (
          <button className={styles.joinBtn} disabled={!canJoin} onClick={onJoin}>
            Join meeting
          </button>
        )}
      </div>
    </main>
  );
}
