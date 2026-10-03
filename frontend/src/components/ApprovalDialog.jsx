// 7A — the owner's approval queue.
//
// Extracted at consumer #1, but deliberately dumb: it renders whatever list it
// is given and calls back. It knows nothing about sockets, rooms or ownership —
// if it did, hiding the button for non-owners would become a security property
// rather than a cosmetic one, and the real gate lives on the server.
import styles from '../styles/enrollment.module.css'; // reuses overlay/card

// Props:
//   requests  — [{ socketId, username, isGuest }] pending join requests
//   onApprove — (socketId) => void
//   onReject  — (socketId) => void
export default function ApprovalDialog({ requests, onApprove, onReject }) {
  if (!requests.length) return null;

  return (
    <div className={styles.overlay} style={{ alignItems: 'flex-start' }}>
      {requests.map((r) => (
        <div key={r.socketId} className={styles.card}>
          <p className={styles.subtitle} style={{ fontSize: '1rem' }}>
            <strong>{r.username}</strong>
            {r.isGuest ? ' (guest)' : ''} wants to join.
          </p>
          <div className={styles.actions}>
            <button className={styles.primaryBtn} onClick={() => onApprove(r.socketId)}>
              Admit
            </button>
            <button className={styles.secondaryBtn} onClick={() => onReject(r.socketId)}>
              Decline
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}