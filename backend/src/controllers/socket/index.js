import { registerMeetingHandlers } from './meetingHandler.js';
import { registerSignalingHandlers } from './signalingHandler.js';
import { registerChatHandlers } from './chatHandler.js';
import { registerReactionHandlers } from './reactionHandler.js';
import { registerPollHandlers } from './pollHandler.js';
import { registerAttendanceHandlers } from './attendanceHandler.js';
import { registerTranscriptHandlers } from './transcriptHandler.js'

export const registerSocketHandlers = (io) => {
  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);

    registerMeetingHandlers(io, socket);
    registerSignalingHandlers(io, socket);
    registerChatHandlers(io, socket);
    registerReactionHandlers(io, socket);
    registerPollHandlers(io, socket);
    registerAttendanceHandlers(io, socket);
    registerTranscriptHandlers(io, socket);

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', socket.id, `(${reason})`);
    });
  });
};