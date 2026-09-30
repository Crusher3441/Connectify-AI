import express from 'express';
import http from 'node:http';
import dotenv from 'dotenv';
import cors from 'cors';
import { config } from './config.js';
import routes from './routes/index.routes.js';
import mongoose from 'mongoose';
// import { initSocket } from './controllers/socketManager.js';
import { Server } from 'socket.io';
import { registerSocketHandlers } from './controllers/socket/index.js';


const app = express();
const httpServer = http.createServer(app);

dotenv.config();
const corsOrigin = (origin, callback) => {
  if (!origin || config.allowedOrigins.includes(origin)) {
    return callback(null, true);
  }
  return callback(new Error('Not allowed by CORS'));
};

app.use(cors({ origin:corsOrigin }));
app.use(express.json());
// initSocket(server);

const io = new Server(httpServer, {
  cors: { origin: corsOrigin },
  transports: ['websocket', 'polling'],
});
registerSocketHandlers(io);

app.use('/api',routes)

app.get('/', (req, res) => {
    res.send("Hello World");
});

app.get('/api/health',(req,res)=>{
    res.send("Healthy");
})
try{
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Database connected")
}catch(err){
    console.log(err);
}


httpServer.listen(process.env.PORT, () => {
  console.log(`Server is running on port ${process.env.PORT}`);
});
