import { registerMeetingHandlers } from './meetingHandler.js';
import { registerSignalingHandlers } from './signalingHandler.js';

export const registerSocketHandlers = (io) => {
  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);

    registerMeetingHandlers(io, socket);
    registerSignalingHandlers(io, socket);

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', socket.id, `(${reason})`);
    });
  });
};