import { roomStore } from './roomStore.js';

export const registerChatHandlers = (io, socket) => {
  socket.on('chat-message', ({ text } = {}) => {
    // Server-side validation (R5): type, trim, cap. The client's
    // maxLength is UX, never the gate.
    if (typeof text !== 'string') return;
    const clean = text.trim().slice(0, 500);
    if (!clean) return;

    const code = roomStore.getRoomCodeForSocket(socket.id);
    const me = code ? roomStore.getRoom(code)?.participants.get(socket.id) : null;
    if (!code || !me) return; // not in a room → drop silently

    const message = {
      from: socket.id,
      username: me.username,
      text: clean,
      at: new Date().toISOString(),
    };
    roomStore.pushMessage(code, message);
    // Everyone INCLUDING the sender: one code path, uniform ordering.
    io.to(code).emit('chat-received', message);
  });
};
