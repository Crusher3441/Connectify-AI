import { roomStore } from './roomStore.js';

// Pure relay — this file must NEVER grow WebRTC knowledge.
// It checks only: is the sender in a room, and does the target exist there?
// Everything inside `data` (SDP offers/answers, ICE candidates) is opaque.
export const registerSignalingHandlers = (io, socket) => {
  socket.on('signal', ({ to, data } = {}) => {
    const code = roomStore.getRoomCodeForSocket(socket.id);
    if (!code) return;                      // sender is not in any room
    const room = roomStore.getRoom(code);
    if (!room || !room.participants.has(to)) return; // target vanished

    io.to(to).emit('signal', { from: socket.id, data });
  });
};
