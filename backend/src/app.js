import express from 'express';
import http from 'node:http';
// import dotenv from 'dotenv';
import cors from 'cors';
import { config } from './config.js';
import routes from './routes/index.routes.js';
import mongoose from 'mongoose';
// import { initSocket } from './controllers/socketManager.js';
import { Server } from 'socket.io';
import { registerSocketHandlers } from './controllers/socket/index.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';


const app = express();
const httpServer = http.createServer(app);

// dotenv.config();
const corsOrigin = (origin, callback) => {
  if (!origin || config.allowedOrigins.includes(origin)) {
    return callback(null, true);
  }
  return callback(new Error('Not allowed by CORS'));
};

app.use(cors({ origin:corsOrigin }));
app.use(express.json());
// initSocket(server);

app.get('/', (req, res) => {
    res.send("Hello World");
});

app.get('/api/health',(req,res)=>{
    res.send("Healthy");
})

app.use('/api',routes)
app.use(notFound);
app.use(errorHandler);





const io = new Server(httpServer, {
  cors: { origin: corsOrigin }, // SAME callback as Express
  transports: ['websocket', 'polling'],
});
registerSocketHandlers(io);

// try{
//     await mongoose.connect(process.env.MONGODB_URI);
//     console.log("Database connected")
// }catch(err){
//     console.log(err);
// }


// httpServer.listen(process.env.PORT, () => {
//   console.log(`Server is running on port ${process.env.PORT}`);
// });

const start = async () => {
  try {
    await mongoose.connect(config.mongoUri);
    console.log('MongoDB connected');
    httpServer.listen(config.port, () =>
      console.log(`Server listening on port ${config.port}`)
    );
  } catch (err) {
    console.error('Startup failed:', err.message);
    process.exit(1);
  }
};

start();
