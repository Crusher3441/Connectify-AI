import { roomStore } from './roomStore.js';
import { recordMeeting } from '../../controllers/meeting.controller.js';

const CODE_RE = /^[a-z0-9]{4,12}$/i;

const emitRoster = (io, code) => {
  io.to(code).emit('participant-list', roomStore.roomSummary(code).participants);
};

export const registerMeetingHandlers = (io, socket) => {
  // Payload: { code, username }. Last argument = ack callback (optional).
  socket.on('join-call', ({ code, username ,authUsername=null} = {}, callback = () => {}) => {
    
    // Validate server-side (R5) — clients can send anything.
    if (!CODE_RE.test(String(code || ''))) {
      return callback({ ok: false, message: 'Invalid meeting code' });
    }
    if (!username || String(username).trim().length < 2) {
      return callback({ ok: false, message: 'Username must be at least 2 characters' });
    }
    const cleanName = String(username).trim().slice(0, 30);

    const cleanAuth = authUsername ? String(authUsername).trim().toLowerCase().slice(0, 20) : null;

    recordMeeting({ meetingCode: code, username: cleanAuth || cleanName }).catch((err) =>
      console.warn(`[history] could not record ${code}:`, err.message)
    );

    const { isOwner } = roomStore.addParticipant(code, socket.id, cleanName);
    socket.join(code); // Socket.io room = a broadcast channel keyed by code

    // Tell everyone ALREADY in the room about the newcomer…
    socket.to(code).emit('user-joined', { socketId: socket.id, username: cleanName });
    emitRoster(io, code);

    // …and acknowledge the joiner with the full room state.
    const { participants } = roomStore.roomSummary(code);
    callback({ ok: true, isOwner, participants });

    const summary = roomStore.roomSummary(code);
    callback({ ok: true, isOwner, participants: summary.participants, messages: roomStore.recentMessages(code), // NEW — chat history for late joiners
    });

  });

  socket.on('media-state', ({ micOn, camOn } = {}) => {
    if (typeof micOn !== 'boolean' || typeof camOn !== 'boolean') return;
    const code = roomStore.getRoomCodeForSocket(socket.id);
    if (!code) return;
    roomStore.patchParticipant(code, socket.id, { micOn, camOn });
    emitRoster(io, code);
  });

  // — server flips the flag; the roster broadcast is the whole UX.
  socket.on('toggle-hand', () => {
    const code = roomStore.getRoomCodeForSocket(socket.id);
    if (!code) return;
    const room = roomStore.getRoom(code);
    const me = room?.participants.get(socket.id);
    if (!me) return;
    me.raisedHand = !me.raisedHand; // server flips — the truth
    emitRoster(io, code);
  });

  // — screen-share presence flags, so tiles can show a "Presenting" pill.
  socket.on('screen-share-started', () => {
    const code = roomStore.getRoomCodeForSocket(socket.id);
    if (code) socket.to(code).emit('screen-share-started', { socketId: socket.id });
  });

  socket.on('screen-share-stopped', () => {
    const code = roomStore.getRoomCodeForSocket(socket.id);
    if (code) socket.to(code).emit('screen-share-stopped', { socketId: socket.id });
  });

  socket.on('disconnect', () => {
    const code = roomStore.removeParticipant(socket.id);
    if (code) {
      // Only remaining members receive this (sender is already gone).
      socket.to(code).emit('participant-left', { socketId: socket.id });
    }
  });
};
