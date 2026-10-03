import { roomStore } from './roomStore.js';
import { recordMeeting } from '../../controllers/meeting.controller.js';
import Meeting from '../../models/meeting.model.js'; // 7A (D1) — the host registry
import { finalizeMeeting } from './meetingFinalizer.js';

const CODE_RE = /^[a-z0-9]{4,12}$/i;

// Full roster on every change — self-healing under churn, no delta drift.
//
// `roomSummary` returns NULL for a room that no longer
// exists, so this MUST null-check. Without the guard the server CRASHES with
// `TypeError: Cannot read properties of null (reading 'participants')`.
//
// The path to that crash is real and short: `deleteRoom` frees a room, and any
// socket that was still indexed to it later disconnects and calls emitRoster for
// a room that is already gone. C15 (free the room immediately rather than
// waiting on the database) widened this window from "rare" to "every
// end-meeting", because all members disconnect within moments of the room being
// deleted. See `deleteRoom` for the other half of the fix.
const emitRoster = (io, code) => {
  const summary = roomStore.roomSummary(code);
  if (!summary) return; // room already finalized + freed — nothing to broadcast
  io.to(code).emit('participant-list', summary.participants);
};

// Shared admission used by THREE paths: direct join, host rejoin (D2), and
// approve-join. One function so all three produce identical room state and an
// identical ack payload — a late-admitted guest must be indistinguishable from
// one admitted immediately.
//
// `io.in(targetSocketId).socketsJoin(code)` puts ANOTHER socket into the room
// (the approve case — a client cannot join itself). `.except(targetSocketId)`
// broadcasts `user-joined` to everyone but the joiner, who learns via their own
// ack instead of an event they would race.
const admitAndBroadcast = (io, targetSocketId, code, cleanName, isGuest, authUsername = null) => {
  const { isOwner } = roomStore.admitParticipant(code, targetSocketId, cleanName, isGuest, authUsername);
  io.in(targetSocketId).socketsJoin(code);
  io.to(code).except(targetSocketId).emit('user-joined', {
    socketId: targetSocketId,
    username: cleanName,
  });
  emitRoster(io, code);
  // — both of these can be null in the approval window: the
  // room is created/admitted above, but a concurrent end-meeting or disconnect can
  // finalize and free it before this line runs. Reading `.polls` off null crashed
  // the server on exactly that race. Optional chaining keeps the ack well-formed.
  const room = roomStore.getRoom(code);
  const summary = roomStore.roomSummary(code);
  return {
    ok: true,
    isOwner,
    // Every read below is null-tolerant (C17): if the room was freed in the
    // window above, the joiner gets a well-formed ack with empty history rather
    // than a crash. The `ok: true` is still correct — they were admitted, and the
    // client will learn the meeting ended from the terminal broadcast.
    participants: summary?.participants || [],
    messages: roomStore.recentMessages(code),                  // 4B — chat history
    polls: room?.polls || [],                                  // 4F — no empty-panel gap
    decisions: room?.decisions || [],
    transcripts: roomStore.recentTranscripts(code),            // 5H — catch-up
  };
};

export const registerMeetingHandlers = (io, socket) => {
  // Payload: { code, username, authUsername, isGuest }. Last argument = ack.
  //
  // `username` is the DISPLAY name (shown in tiles/chat).
  // `authUsername` is the login identity and is what Phase 5 persists and
  // Phase 6 authorizes against. The client sends it from AuthContext; guests
  // send null and fall back to their display name.
  //
  // The ack has THREE shapes now, and the client's phase machine maps 1:1:
  //   { ok: false, message }        → rejected, stay in lobby
  //   { ok: true, pending: true }   → waiting for the host, show a spinner
  //   { ok: true, participants, … } → admitted, enter the room
  socket.on('join-call', async ({ code, username, authUsername = null, isGuest = false } = {}, callback = () => {}) => {
    // Validate server-side (R5) — clients can send anything.
    if (!CODE_RE.test(String(code || ''))) {
      return callback({ ok: false, message: 'Invalid meeting code' });
    }
    if (!username || String(username).trim().length < 2) {
      return callback({ ok: false, message: 'Username must be at least 2 characters' });
    }
    const cleanName = String(username).trim().slice(0, 30);
    const cleanAuth = authUsername
      ? String(authUsername).trim().toLowerCase().slice(0, 20)
      : null;
    //  one identity for the gate AND for persistence.
    const identity = roomStore.identityOf(cleanName, cleanAuth);

    // D1: who is the designated host? Phase 2's history write IS the registry.
    // `meetingOwner` is written on INSERT ONLY, so this is
    // genuinely the FIRST creator — not the last person to join.
    const registered = await Meeting.findOne({ meetingCode: code })
      .select('meetingOwner')
      .lean();
    const hostIdentity = registered?.meetingOwner || null;

    // D5: guests can't take the host's name. Checked against BOTH the registry
    // and a live room's host, so it holds whichever order things happen in
    // (guest arrives before the room exists, or after).
    //
    // this needs THREE comparisons, not one. An earlier
    // version compared identities only, and a guest could therefore type the
    // host's DISPLAY name ("Alice Smith") and sail through: `identityOf` folds it
    // to "alice smith", which matches neither the login identity "alice" nor
    // the room's host identity. D5's purpose is to stop impersonation, and a
    // guest wearing the host's name in every tile and chat message is exactly
    // that — the identity check alone only stops the privilege-escalation
    // variant, not the visible one.
    if (isGuest) {
      const live = roomStore.getRoom(code);
      const liveHostIdentity = live?.hostIdentity || null;
      const liveHostName = live?.hostUsername || null;
      const wantedName = cleanName.toLowerCase();
      if (
        identity === hostIdentity ||              // login identity, room not up yet
        identity === liveHostIdentity ||          // login identity, room is up
        (liveHostName && wantedName === liveHostName.toLowerCase())  // display name
      ) {
        return callback({ ok: false, message: 'That name is reserved by the meeting host' });
      }
    }

    const room = roomStore.getRoom(code);

    // CASE 1 — a room already exists.
    if (room) {
      //identity comparison, not display-name comparison.
      if (room.hostIdentity === identity) {
        // D2: host refresh/rejoin — direct admission, no approval round-trip.
        return callback(admitAndBroadcast(io, socket.id, code, cleanName, isGuest, cleanAuth));
      }
      // Everyone else waits. Guests included — 7B rides on this same path.
      if (!roomStore.addToWaitingRoom(code, socket.id, cleanName, isGuest, cleanAuth)) {
        return callback({ ok: false, message: 'That meeting just ended' });
      }
      if (room.ownerSocketId) {
        io.to(room.ownerSocketId).emit('join-request', {
          socketId: socket.id,
          username: cleanName,
          isGuest,
        });
      }
      return callback({ ok: true, pending: true });
    }

    // CASE 2 — no room yet (D4): only the designated host, or the first joiner
    // of an OPEN unregistered code, may create it. Otherwise early joiners hang
    // in a waiting room with nobody present to approve them.
    if (hostIdentity && identity !== hostIdentity) {
      return callback({ ok: false, message: 'The host has not started this meeting yet' });
    }

    // Fire-and-forget: a history write must never block or fail a join (H6).
    recordMeeting({ meetingCode: code, username: identity }).catch((err) =>
      console.warn(`[history] could not record ${code}:`, err.message)
    );

    return callback(admitAndBroadcast(io, socket.id, code, cleanName, isGuest, cleanAuth));
  });

  // Owner-only approvals. D7: the `ownerSocketId` check IS the security — the
  // client merely hides the button, but a forged emit must be rejected here.
  socket.on('approve-join', ({ socketId } = {}) => {
    const code = roomStore.getRoomCodeForSocket(socket.id);
    const room = code ? roomStore.getRoom(code) : null;
    if (!room || room.ownerSocketId !== socket.id) return;
    const pending = roomStore.admitFromWaitingRoom(code, socketId);
    if (!pending) return; // stale request (they left) — nothing to do
    

    const payload = admitAndBroadcast(
      io, socketId, code, pending.username, pending.isGuest, pending.authUsername
    );
    io.to(socketId).emit('join-approved', payload);
  });

  socket.on('reject-join', ({ socketId } = {}) => {
    const code = roomStore.getRoomCodeForSocket(socket.id);
    const room = code ? roomStore.getRoom(code) : null;
    if (!room || room.ownerSocketId !== socket.id) return;
    if (roomStore.removeFromWaitingRoom(code, socketId)) {
      io.to(socketId).emit('join-rejected', { message: 'The host declined your request' });
    }
  });

  // 7C — owner-only end-for-all. Same notify → save → free ordering as every
  // other terminal path in this file.
  socket.on('end-meeting', async () => {
    const code = roomStore.getRoomCodeForSocket(socket.id);
    const room = code ? roomStore.getRoom(code) : null;
    if (!room || room.ownerSocketId !== socket.id) return; // D7: the gate

    // Tell EVERYONE while every socket is still connected — the one moment a
    // "meeting is over" signal can actually be heard. Room members first…
    io.to(code).emit('meeting-ended', { message: 'The host ended the meeting' });
    // …then the waiting room. ⚠️ A pending socket never joined the Socket.io
    // room, so `io.to(code)` does NOT reach it — without this loop a guest
    // waiting for approval would sit on a spinner forever.
    for (const waitingId of room.waitingRoom.keys()) {
      io.to(waitingId).emit('meeting-ended', { message: 'The meeting was ended' });
    }

   
    finalizeMeeting(room)
      .catch((err) => console.error(`[finalize] FAILED for ${code}:`, err.message));
    roomStore.deleteRoom(code); // free NOW — never gated on the database
  });

  // 4C — clients announce mic/cam; the roster carries it to everyone.
  socket.on('media-state', ({ micOn, camOn } = {}) => {
    if (typeof micOn !== 'boolean' || typeof camOn !== 'boolean') return;
    const code = roomStore.getRoomCodeForSocket(socket.id);
    if (!code) return;
    roomStore.patchParticipant(code, socket.id, { micOn, camOn });
    emitRoster(io, code);
  });

  // 4D — server flips the flag; the roster broadcast is the whole UX.
  socket.on('toggle-hand', () => {
    const code = roomStore.getRoomCodeForSocket(socket.id);
    if (!code) return;
    const room = roomStore.getRoom(code);
    const me = room?.participants.get(socket.id);
    if (!me) return;
    me.raisedHand = !me.raisedHand; // server flips — the truth
    emitRoster(io, code);
  });

  // 4G — screen-share presence flags, so tiles can show a "Presenting" pill.
  socket.on('screen-share-started', () => {
    const code = roomStore.getRoomCodeForSocket(socket.id);
    if (code) socket.to(code).emit('screen-share-started', { socketId: socket.id });
  });

  socket.on('screen-share-stopped', () => {
    const code = roomStore.getRoomCodeForSocket(socket.id);
    if (code) socket.to(code).emit('screen-share-stopped', { socketId: socket.id });
  });

  socket.on('disconnect', async () => {
    // A socket that was never admitted was pending approval (7A) or long gone.
    // It is NOT in socketToRoom, so removeParticipant returns null for it.
    const code = roomStore.getRoomCodeForSocket(socket.id);
    if (!code) {
      roomStore.removeWaitingBySocket(socket.id);
      return;
    }
    const room = roomStore.getRoom(code);
    
    const wasOwner = room?.ownerSocketId === socket.id;

    roomStore.removeParticipant(socket.id);
    socket.to(code).emit('participant-left', { socketId: socket.id });
    emitRoster(io, code);

    const remaining = roomStore.getRoom(code);
  
    if (remaining && remaining.participants.size === 0) {
      // Last one out — the 5F path, unchanged in spirit.
      finalizeMeeting(remaining)
        .catch((err) => console.error(`[finalize] FAILED for ${code}:`, err.message));
      roomStore.deleteRoom(code);
    } else if (remaining && wasOwner) {
      
      io.to(code).emit('meeting-dissolved', { message: 'The host left — meeting ended' });
      // Pending guests never joined the Socket.io room, so `io.to(code)` misses
      // them; address them individually or they spin forever (7A test row 5).
      for (const waitingId of remaining.waitingRoom.keys()) {
        io.to(waitingId).emit('meeting-dissolved', { message: 'The host left — meeting ended' });
      }
      finalizeMeeting(remaining)
        .catch((err) => console.error(`[finalize] FAILED for ${code}:`, err.message));
      roomStore.deleteRoom(code);
    }
  });
};
