export const registerSocketHandlers = (io) => {
  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', socket.id, `(${reason})`);
    });
  });
};