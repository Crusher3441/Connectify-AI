const rooms = new Map();
const socketToRoom = new Map(); // socketId → meetingCode (fast disconnect lookup)


const identityOf = (username, authUsername) =>
  String(authUsername || username || '').trim().toLowerCase();

const createRoom = (code) => {
  const room = {
    code,
    ownerSocketId: null,           // first joiner becomes owner
    hostUsername: null,            // 7A (D2) — survives owner refresh; null for open codes
    hostIdentity: null,            // 7A (H7) — the identity key every host check uses
    participants: new Map(),       // socketId → { username, joinedAt, isOwner }
    messages: [],                  // reserved — Phase 4 (chat)
    polls: [],                     // reserved — Phase 4
    decisions: [],                 // reserved — Phase 4
    transcripts: [],               // Phase 5 (live transcription)
    waitingRoom: new Map(),        // 7A — LIVE: socketId → { username, isGuest, authUsername }
    // Phase 5: attendance tally, keyed by LOGIN identity so early leavers
    // (whose socketIds vanish) still land in the final report.
    attendance: new Map(),         // username → { totalChecks, verifiedChecks, lastUpdate }
    createdAt: new Date().toISOString(),
  };
  rooms.set(code, room);
  return room;
};

const getRoom = (code) => rooms.get(code) || null;

const getOrCreateRoom = (code) => rooms.get(code) || createRoom(code);


const admitParticipant = (code, socketId, username, isGuest = false, authUsername = null) => {
  const room = getOrCreateRoom(code);
  const identity = identityOf(username, authUsername);

  // Host = first occupant OR the designated host returning (refresh/rejoin).
  const isHost = room.participants.size === 0 || identity === room.hostIdentity;
  if (isHost) {
    room.hostUsername = username;   // display name, for the room's own record
    room.hostIdentity = identity;   // ← the comparison key (D1/D2/D5)
    room.ownerSocketId = socketId;
    room.ownerUsername = username;
    // Stable identity for persistence + authorization — the SAME value Phase 5
    // persists and Phase 6 authorizes against.
    room.ownerIdentity = identity;
  }
  room.participants.set(socketId, {
    username,
    authUsername,
    identity,                 // ← the key everything else joins on
    isGuest,                  // 7B — guests are excluded from attendance
    isOwner: isHost,
    joinedAt: new Date().toISOString(),
    micOn: true,      // 4C: so roomSummary always carries the keys
    camOn: true,
    raisedHand: false,
  });
  socketToRoom.set(socketId, code);
  return { isOwner: isHost };
};

// ---- 7A — waiting room ----
// A waiting socket is deliberately NOT in `socketToRoom` and NOT in the Socket.io
// room: it has not been admitted yet, so it must not receive room broadcasts.
const addToWaitingRoom = (code, socketId, username, isGuest, authUsername = null) => {
  const room = rooms.get(code);
  if (!room) return false; // room vanished between the join and this call
  room.waitingRoom.set(socketId, {
    username,
    
    authUsername,
    isGuest,
    requestedAt: new Date().toISOString(),
  });
  return true;
};

const admitFromWaitingRoom = (code, socketId) => {
  const room = rooms.get(code);
  const pending = room?.waitingRoom.get(socketId);
  if (!room || !pending) return null; // stale request (they left) — caller no-ops
  room.waitingRoom.delete(socketId);
  return pending; // { username, isGuest, authUsername, requestedAt }
};

const removeFromWaitingRoom = (code, socketId) =>
  rooms.get(code)?.waitingRoom.delete(socketId) || false;


const removeWaitingBySocket = (socketId) => {
  for (const room of rooms.values()) {
    if (room.waitingRoom.has(socketId)) {
      room.waitingRoom.delete(socketId);
      return room.code;
    }
  }
  return null;
};

const removeParticipant = (socketId) => {
  const code = socketToRoom.get(socketId);
  if (!code) return null;
  socketToRoom.delete(socketId);

  const room = rooms.get(code);
  if (!room) return null;
  room.participants.delete(socketId);
  room.waitingRoom.delete(socketId);
  return code;
};


const deleteRoom = (code) => {
  const room = rooms.get(code);
  if (room) {
    for (const socketId of room.participants.keys()) socketToRoom.delete(socketId);
    for (const socketId of room.waitingRoom.keys()) socketToRoom.delete(socketId);
  }
  return rooms.delete(code);
};
const allRooms = () => [...rooms.values()];

const getRoomCodeForSocket = (socketId) => socketToRoom.get(socketId) || null;

// Serializable snapshot for clients — Maps become plain arrays.
const roomSummary = (code) => {
  const room = rooms.get(code);
  if (!room) return null;
  return {
    code,
    participants: [...room.participants.entries()].map(([socketId, p]) => ({
      socketId,
      ...p,
    })),
  };
};

const debugSnapshot = () => [...rooms.keys()].map(roomSummary);

// ---- Phase 4: message history (4B) ----
const pushMessage = (code, message) => {
  const room = rooms.get(code);
  if (!room) return;
  room.messages.push(message);
  if (room.messages.length > 200) room.messages.shift(); // cap: memory is finite
};

const recentMessages = (code, n = 50) => {
  const room = rooms.get(code);
  return room ? room.messages.slice(-n) : [];
};

// ---- Phase 5: live transcripts (5H) ----
const pushTranscript = (code, entry) => {
  const room = rooms.get(code);
  if (!room) return;
  room.transcripts.push(entry);
  if (room.transcripts.length > 500) room.transcripts.shift();
};

const recentTranscripts = (code, n = 100) => {
  const room = rooms.get(code);
  return room ? room.transcripts.slice(-n) : [];
};

// ---- Phase 5: attendance tally (5D) ----
// The client sends a BOOLEAN; the server does the math. Counting server-side
// removes the attack surface entirely: the only lie left is "I'm always
// verified", and the cooldown bounds that to one claim per 8 seconds.
const tallyAttendance = (code, username, verified) => {
  const room = rooms.get(code);
  if (!room) return;
  const entry = room.attendance.get(username) || {
    totalChecks: 0, verifiedChecks: 0, lastUpdate: 0,
  };
  const now = Date.now();
  
  if (now - entry.lastUpdate < 8000) return;
  entry.lastUpdate = now;
  entry.totalChecks += 1;
  if (verified) entry.verifiedChecks += 1;
  room.attendance.set(username, entry);
};

const attendanceSnapshot = (code) => {
  const room = rooms.get(code);
  if (!room) return [];
  return [...room.attendance.entries()].map(([username, t]) => ({
    username,
    totalChecks: t.totalChecks,
    verifiedChecks: t.verifiedChecks,
    percentage: t.totalChecks ? Math.round((t.verifiedChecks / t.totalChecks) * 100) : 0,
  }));
};

// ---- Phase 4: participant status patches (4C/4D/4G) ----
const patchParticipant = (code, socketId, patch) => {
  const room = rooms.get(code);
  const p = room?.participants.get(socketId);
  if (!p) return false;
  Object.assign(p, patch);
  return true;
};

export const roomStore = {
  identityOf,
  getRoom,
  getOrCreateRoom,
  admitParticipant, // 7A — replaces addParticipant (identity-based host test)
  addToWaitingRoom,
  admitFromWaitingRoom,
  removeFromWaitingRoom,
  removeWaitingBySocket,
  removeParticipant,
  getRoomCodeForSocket,
  roomSummary,
  debugSnapshot,
  pushMessage,
  recentMessages,
  pushTranscript,
  recentTranscripts,
  tallyAttendance,
  attendanceSnapshot,
  patchParticipant,
  deleteRoom,
  allRooms,
};
