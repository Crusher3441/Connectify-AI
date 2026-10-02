import Face from "../../models/face.model.js";
import { roomStore } from "./roomStore.js";

export const registerAttendanceHandlers = (io, socket) => {
  socket.on("register-face", ({ descriptor } = {}, callback = () => {}) => {
    console.log("[register-face] RECEIVED", {
      socketId: socket.id,
      descriptorLength: descriptor?.length,
    });

    const code = roomStore.getRoomCodeForSocket(socket.id);
    const me = code
      ? roomStore.getRoom(code)?.participants.get(socket.id)
      : null;
    if (!code || !me)
      return callback({ ok: false, message: "Not in a meeting" });

    // 7B — guests are excluded from attendance by construction, and this is
    // where that rule is ENFORCED. The client already skips the enrollment
    // modal for guests, but a client is untrusted input: without this check any
    // guest could emit `register-face` from the console and land in the
    // Attendance doc, corrupting a report that is then authorized and displayed
    // to the real members. The gate belongs on the server.
    if (me.isGuest) {
      return callback({
        ok: false,
        message: "Guests do not enroll in attendance",
      });
    }

    // ML output is still client input — validate shape exactly (R5).
    if (
      !Array.isArray(descriptor) ||
      descriptor.length !== 128 ||
      !descriptor.every((n) => Number.isFinite(n))
    ) {
      return callback({ ok: false, message: "Invalid face descriptor" });
    }

    // ⚠️ CORRECTION (H7): key on `me.identity`, NOT `me.username`.
    // `me.username` is the lobby DISPLAY name ("Alice Smith"); Phase 6
    // authorizes with `req.user.username` ("alice"). Keying on the display name
    // writes a Face document nothing will ever match — enrollment appears to
    // save, then verification compares against a row that isn't there.
    Face.findOneAndUpdate(
      { username: me.identity, meetingCode: code },
      { descriptor: descriptor.map(Number) },
      // `returnDocument: 'after'` replaces the deprecated `new: true`.
      { upsert: true, returnDocument: "after" },
    )
      .then(() => callback({ ok: true }))
      .catch((err) => {
        console.error("face save failed:", err.message); // never log the descriptor itself
        callback({ ok: false, message: "Could not save enrollment" });
      });
  });

  socket.on("verified-update", ({ verified } = {}) => {
    if (typeof verified !== "boolean") return; // boolean-or-nothing (R5)
    const code = roomStore.getRoomCodeForSocket(socket.id);
    const me = code
      ? roomStore.getRoom(code)?.participants.get(socket.id)
      : null;
    if (!code || !me) return;
    // 7B — same guest exclusion as register-face, for the same reason: a guest
    // forging `verified-update` would otherwise add phantom rows to the tally.
    if (me.isGuest) return;
    // Server counts. The client never sends totals — it CAN'T lie about them.
    // ⚠️ CORRECTION (H7): tally on `me.identity`, not the display name — this
    // key becomes `participants[].username` in the Attendance doc, which Phase 6
    // matches against `req.user.username`. The rest of that note follows.
    roomStore.tallyAttendance(code, me.identity, verified);
  });
};

let tickerStarted = false;

// Owner-only live feed: every 30s, every active room's owner gets a snapshot.
export const startAttendanceTicker = (io) => {
  if (tickerStarted) return; // registerSocketHandlers runs once per process, but be safe
  tickerStarted = true;
  setInterval(() => {
    for (const room of roomStore.allRooms()) {
      const snapshot = roomStore.attendanceSnapshot(room.code);
      if (snapshot.length && room.ownerSocketId) {
        io.to(room.ownerSocketId).emit("live-attendance", snapshot);
      }
    }
  }, 30000);
};
