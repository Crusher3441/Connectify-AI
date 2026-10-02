// In-memory source of truth for all active meetings.
//
// KNOWN LIMITATION : everything here lives in RAM.
//   - Server restart  → all meetings lost mid-call
//   - Two server instances would not share state (no horizontal scale)
// THIS FILE is the only place that would change if we moved to Redis later — handlers never touch raw storage directly.


const rooms = new Map();        // meetingCode → Room
const socketToRoom = new Map(); // socketId → meetingCode (fast disconnect lookup)

const identityOf = (username, authUsername) => String(authUsername || username || '').trim().toLowerCase();

const createRoom = (code) => {
  const room = {
    code,
    ownerSocketId: null,           // first joiner becomes owner
    participants: new Map(),       // socketId → { username, joinedAt, isOwner }
    messages: [],                  
    polls: [],                      
    decisions: [],                 
    transcripts: [],               
    waitingRoom: new Map(),   
    
     // Face attendance
    attendance: new Map(),
  };
  rooms.set(code, room);
  return room;
};

const getRoom = (code) => rooms.get(code) || null;

const getOrCreateRoom = (code) => rooms.get(code) || createRoom(code);

const addParticipant = (code, socketId, username, authUsername=null) => {
  const room = getOrCreateRoom(code);
  const isOwner = room.participants.size === 0;
  if (isOwner){
    room.ownerSocketId = socketId;
    room.ownerUsername = username;
    room.ownerIdentity = identityOf(username, authUsername);

  } 
   room.participants.set(socketId, {
    username,
    authUsername,
    identity: identityOf(username, authUsername),
    isOwner,
    joinedAt: new Date().toISOString(),
    micOn: true,      
    camOn: true,
    raisedHand: false,
  });
  socketToRoom.set(socketId, code);
  return { isOwner };
};

// Returns the room code the socket was in (or null) — the caller emits events.
const removeParticipant = (socketId) => {
  const code = socketToRoom.get(socketId);
  if (!code) return null;
  socketToRoom.delete(socketId);

  const room = rooms.get(code);
  if (!room) return null;
  room.participants.delete(socketId);
  room.waitingRoom.delete(socketId);
  if (room.participants.size === 0) rooms.delete(code); // last out cleans up
  return code;
};

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

const patchParticipant = (code, socketId, patch) => {
  const room = rooms.get(code);
  const p = room?.participants.get(socketId);
  if (!p) return false;
  Object.assign(p, patch);
  return true;
};

const tallyAttendance = (code, username, verified) => {
  const room = rooms.get(code);
  if (!room) return;
  const entry = room.attendance.get(username) || {
    totalChecks: 0, verifiedChecks: 0, lastUpdate: 0,
  };
  const now = Date.now();
  // Cooldown: the honest client ticks every 10s. Anything faster than 8s is
  // spam or a tampered client — counting it would let one socket inflate
  // its own presence. Drop silently; no error feedback for attackers to tune.
  if (now - entry.lastUpdate < 8000) return;
  entry.lastUpdate = now;
  entry.totalChecks += 1;
  if (verified) entry.verifiedChecks += 1;
  room.attendance.set(username, entry);
};

export const roomStore = {
  getRoom,
  getOrCreateRoom,
  addParticipant,
  removeParticipant,
  getRoomCodeForSocket,
  roomSummary,
  debugSnapshot,
  pushMessage,
  recentMessages,
  patchParticipant,
  identityOf,
  tallyAttendance
};
