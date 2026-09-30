import { roomStore } from './roomStore.js';

const CODE_RE = /^[a-z0-9]{4,12}$/i;

export const registerMeetingHandlers = (io, socket) => {
  // Payload: { code, username }. Last argument = ack callback (optional).
  socket.on('join-call', ({ code, username } = {}, callback = () => {}) => {
    
    // Validate server-side (R5) — clients can send anything.
    if (!CODE_RE.test(String(code || ''))) {
      return callback({ ok: false, message: 'Invalid meeting code' });
    }
    if (!username || String(username).trim().length < 2) {
      return callback({ ok: false, message: 'Username must be at least 2 characters' });
    }
    const cleanName = String(username).trim().slice(0, 30);

    const { isOwner } = roomStore.addParticipant(code, socket.id, cleanName);
    socket.join(code); // Socket.io room = a broadcast channel keyed by code

    // Tell everyone ALREADY in the room about the newcomer…
    socket.to(code).emit('user-joined', { socketId: socket.id, username: cleanName });

    // …and acknowledge the joiner with the full room state.
    const { participants } = roomStore.roomSummary(code);
    callback({ ok: true, isOwner, participants });
  });

  socket.on('disconnect', () => {
    const code = roomStore.removeParticipant(socket.id);
    if (code) {
      // Only remaining members receive this (sender is already gone).
      socket.to(code).emit('participant-left', { socketId: socket.id });
    }
  });
};
