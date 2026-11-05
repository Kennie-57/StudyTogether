import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import feedbacksRouter from './routes/feedbacks.js';
import profilesRouter from './routes/profiles.js';
import roomsRouter from './routes/rooms.js';
import { registerRoomHandlers, startExpirySweep } from './sockets/roomHandlers.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');

const io = new Server(httpServer, {
  cors: {
    origin: clientUrl,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.use(cors({ origin: clientUrl, credentials: true }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  const mem = process.memoryUsage();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    memory: {
      rssMB: Number((mem.rss / 1024 / 1024).toFixed(2)),
      heapUsedMB: Number((mem.heapUsed / 1024 / 1024).toFixed(2)),
      heapTotalMB: Number((mem.heapTotal / 1024 / 1024).toFixed(2)),
    },
    sockets: io.engine.clientsCount,
  });
});

app.use('/api/rooms', roomsRouter);
app.use('/api/profiles', profilesRouter);
app.use('/api/feedbacks', feedbacksRouter);

io.on('connection', (socket) => {
  registerRoomHandlers(io, socket);
});

startExpirySweep(io);

const PORT = Number(process.env.PORT) || 3001;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} (CLIENT_URL=${clientUrl})`);
});
