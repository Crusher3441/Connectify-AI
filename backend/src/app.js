import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import cors from 'cors';
import routes from './routes/index.routes.js'
import mongoose from 'mongoose';
import { initSocket } from './controllers/socketManager.js';

const app = express();
const server = http.createServer(app);

dotenv.config();
app.use(cors());
app.use(express.json());
initSocket(server);

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


server.listen(process.env.PORT, () => {
  console.log(`Server is running on port ${process.env.PORT}`);
});
