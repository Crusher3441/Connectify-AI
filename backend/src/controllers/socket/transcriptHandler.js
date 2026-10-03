import { roomStore } from './roomStore.js';

export const registerTranscriptHandlers = (io, socket) => {
  socket.on('transcript-entry', ({ text } = {}) => {
    if (typeof text !== 'string') return;
    const clean = text.trim().slice(0, 400);
    if (!clean) return;

    const code = roomStore.getRoomCodeForSocket(socket.id);
    const me = code ? roomStore.getRoom(code)?.participants.get(socket.id) : null;
    if (!code || !me) return;

    // ⚠️ CORRECTION (H7): carry BOTH identities in the transcript entry.
    //   username     — display name, rendered in the sidebar panel
    //   identity     — login identity, matched by Phase 5K's authorization check
    // Phase 5K authorizes a report read with `entries.some(e => e.username ===
    // req.user.username)`. Writing only the display name made every legitimate
    // participant get a 403 on their own meeting summary.
    const entry = {
      username: me.username,
      identity: me.identity,
      text: clean,
      at: new Date().toISOString(),
    };
    roomStore.pushTranscript(code, entry);

    // OTHERS only — the speaker already rendered their own text locally.
    // (Same reasoning as chat's INCLUDE-everyone, opposite conclusion:
    // chat echoes for uniform ordering; transcripts avoid double-render.)
    socket.to(code).emit('transcript-received', entry);
  });
};