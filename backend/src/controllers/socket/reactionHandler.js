import { roomStore } from './roomStore.js';

const ALLOWED = ['👍', '👏', '❤️', '😂', '😮', '🎉', '🙌', '🔥'];
const WINDOW_MS = 1000;
const MAX_PER_WINDOW = 3;
const recentBySocket = new Map(); // socketId → [timestamps] (per-socket rate limit)

export const registerReactionHandlers = (io, socket) => {
  socket.on('send-reaction', ({ emoji } = {}) => {
    // Whitelist (not blocklist): unknown emojis are dropped, never relayed.
    if (!ALLOWED.includes(emoji)) return;

    const now = Date.now();
    const recent = (recentBySocket.get(socket.id) || []).filter((t) => now - t < WINDOW_MS);
    if (recent.length >= MAX_PER_WINDOW) return; // silent drop — spam produces nothing
    recent.push(now);
    recentBySocket.set(socket.id, recent);

    const code = roomStore.getRoomCodeForSocket(socket.id);
    if (!code) return;
    io.to(code).emit('reaction-received', { emoji, from: socket.id });
  });

  socket.on('disconnect', () => recentBySocket.delete(socket.id)); // no socket-id leak
};
