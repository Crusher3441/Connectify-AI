import crypto from 'node:crypto';
import { roomStore } from './roomStore.js';

const inRoom = (socket) => {
  const code = roomStore.getRoomCodeForSocket(socket.id);
  const room = code ? roomStore.getRoom(code) : null;
  const me = room?.participants.get(socket.id);
  return { code, room, me };
};

const broadcastPolls = (io, code) => io.to(code).emit('polls-updated', roomStore.getRoom(code).polls);
const broadcastDecisions = (io, code) => io.to(code).emit('decisions-updated', roomStore.getRoom(code).decisions);

export const registerPollHandlers = (io, socket) => {
  socket.on('create-poll', ({ question, options } = {}, callback = () => {}) => {
    const { code, room } = inRoom(socket);
    if (!room) return callback({ ok: false, message: 'Not in a meeting' });

    if (room.ownerSocketId !== socket.id) {
      return callback({ ok: false, message: 'Only the meeting owner can create polls' });
    }
    if (typeof question !== 'string' || question.trim().length < 3) {
      return callback({ ok: false, message: 'Question must be at least 3 characters' });
    }
    const cleanOptions = Array.isArray(options)
      ? [...new Set(options.map((o) => String(o).trim()).filter(Boolean))]
      : [];
    if (cleanOptions.length < 2 || cleanOptions.length > 5) {
      return callback({ ok: false, message: 'Poll needs 2–5 unique options' });
    }

    const poll = {
      id: crypto.randomUUID(),
      question: question.trim().slice(0, 200),
      options: cleanOptions.map((text) => ({ text: text.slice(0, 80), votes: [] })),
      createdAt: new Date().toISOString(),
    };
    room.polls.push(poll);
    if (room.polls.length > 20) room.polls.shift();
    broadcastPolls(io, code);
    callback({ ok: true });
  });

  socket.on('vote-poll', ({ pollId, optionIndex } = {}) => {
    const { code, room } = inRoom(socket);
    if (!room) return;
    const poll = room.polls.find((p) => p.id === pollId);
    if (!poll) return;
    const idx = Number(optionIndex);
    if (!Number.isInteger(idx) || idx < 0 || idx >= poll.options.length) return;

    // One vote per socket — switching is allowed: strip, then add.
    poll.options.forEach((o) => {
      o.votes = o.votes.filter((id) => id !== socket.id);
    });
    poll.options[idx].votes.push(socket.id);
    broadcastPolls(io, code);
  });

  socket.on('add-decision', ({ text } = {}, callback = () => {}) => {
    const { code, room, me } = inRoom(socket);
    if (!room || !me) return callback({ ok: false, message: 'Not in a meeting' });
    if (typeof text !== 'string' || !text.trim()) {
      return callback({ ok: false, message: 'Decision text required' });
    }
    room.decisions.push({
      id: crypto.randomUUID(),
      text: text.trim().slice(0, 300),
      by: me.username,
      at: new Date().toISOString(),
    });
    if (room.decisions.length > 100) room.decisions.shift();
    broadcastDecisions(io, code);
    callback({ ok: true });
  });
};
