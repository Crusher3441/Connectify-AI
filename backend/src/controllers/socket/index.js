import { registerMeetingHandlers } from './meetingHandler.js';
import { registerSignalingHandlers } from './signalingHandler.js';
import { registerChatHandlers } from './chatHandler.js';
import { registerReactionHandlers } from './reactionHandler.js';
import { registerPollHandlers } from './pollHandler.js';

export const registerSocketHandlers = (io) => {
  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);

    registerChatHandlers(io, socket);
    registerMeetingHandlers(io, socket);
    registerSignalingHandlers(io, socket);
    registerReactionHandlers(io, socket);
    registerPollHandlers(io, socket);

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', socket.id, `(${reason})`);
    });
  });
};