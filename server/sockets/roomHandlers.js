import { supabase } from '../config/supabase.js';
import {
  activeRooms,
  addMessage,
  addUser,
  assignHost,
  createOrGetRoom,
  extendRoomExpiry,
  getHost,
  getRoom,
  removeRoom,
  removeUser,
  serializeRoom,
} from './roomStore.js';

const STATUS_ICONS = ['📚', '☕', '📝'];

async function incrementRoomsJoined(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('rooms_joined_count')
    .eq('id', userId)
    .single();

  if (data) {
    await supabase
      .from('profiles')
      .update({ rooms_joined_count: (data.rooms_joined_count || 0) + 1 })
      .eq('id', userId);
  }
}

async function deleteRoomFromDb(roomId) {
  await supabase.from('rooms').delete().eq('id', roomId);
}

function emitRoomState(io, roomId) {
  const room = getRoom(roomId);
  if (room) {
    io.to(roomId).emit('room:state', serializeRoom(room));
  }
}

function scheduleRoomExpiry(io, roomId) {
  const room = getRoom(roomId);
  if (!room) return;

  const ms = new Date(room.expiresAt).getTime() - Date.now();
  if (ms <= 0) {
    closeRoom(io, roomId);
    return;
  }

  if (room.expiryTimer) clearTimeout(room.expiryTimer);
  room.expiryTimer = setTimeout(() => closeRoom(io, roomId), ms);
}

async function closeRoom(io, roomId) {
  const room = getRoom(roomId);
  if (!room) return;

  if (room.expiryTimer) clearTimeout(room.expiryTimer);
  io.to(roomId).emit('room:closed', { reason: 'expired' });
  removeRoom(roomId);
  await deleteRoomFromDb(roomId);
}

function handleHostDisconnect(io, socket, roomId) {
  const room = getRoom(roomId);
  if (!room) return;

  removeUser(roomId, socket.id);

  if (room.users.length === 0) {
    if (room.expiryTimer) clearTimeout(room.expiryTimer);
    removeRoom(roomId);
    deleteRoomFromDb(roomId);
    return;
  }

  assignHost(room, room.designatedHostId);
  emitRoomState(io, roomId);
  scheduleRoomExpiry(io, roomId);
}

export function registerRoomHandlers(io, socket) {
  socket.on('room:join', async ({ roomId, token, expiresAt }) => {
    try {
      const { verifyToken } = await import('../config/supabase.js');
      const user = await verifyToken(token);
      if (!user) {
        socket.emit('room:error', { message: 'Unauthorized' });
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .single();

      const username = profile?.full_name || user.user_metadata?.full_name || 'User';

      const { data: dbRoom } = await supabase
        .from('rooms')
        .select('id, host_id, expires_at')
        .eq('id', roomId)
        .single();

      if (!dbRoom || new Date(dbRoom.expires_at) <= new Date()) {
        socket.emit('room:error', { message: 'Room not found or expired' });
        return;
      }

      const room = createOrGetRoom(roomId, expiresAt || dbRoom.expires_at);
      room.designatedHostId = dbRoom.host_id;

      const result = addUser(roomId, {
        socketId: socket.id,
        userId: user.id,
        username,
        avatarUrl: profile?.avatar_url || null,
        isHost: false,
        statusIcon: '📚',
      });

      if (result.error) {
        socket.emit('room:error', { message: result.error });
        return;
      }

      assignHost(room, room.designatedHostId);

      socket.roomId = roomId;
      socket.userId = user.id;
      socket.join(roomId);

      await incrementRoomsJoined(user.id);

      socket.emit('room:joined', serializeRoom(room));
      socket.to(roomId).emit('room:user-joined', {
        userId: user.id,
        username,
        statusIcon: '📚',
      });
      emitRoomState(io, roomId);
      scheduleRoomExpiry(io, roomId);
    } catch (err) {
      socket.emit('room:error', { message: err.message });
    }
  });

  socket.on('room:status', ({ statusIcon }) => {
    const roomId = socket.roomId;
    if (!roomId || !STATUS_ICONS.includes(statusIcon)) return;

    const room = getRoom(roomId);
    if (!room) return;

    const user = room.users.find((u) => u.socketId === socket.id);
    if (!user) return;

    user.statusIcon = statusIcon;
    io.to(roomId).emit('room:status-changed', {
      userId: user.userId,
      statusIcon,
    });
  });

  socket.on('room:chat', ({ content }) => {
    const roomId = socket.roomId;
    if (!roomId || !content?.trim()) return;

    const room = getRoom(roomId);
    if (!room) return;

    const user = room.users.find((u) => u.socketId === socket.id);
    if (!user) return;

    const message = {
      id: `${Date.now()}-${socket.id}`,
      userId: user.userId,
      username: user.username,
      content: content.trim(),
      timestamp: new Date().toISOString(),
    };

    addMessage(roomId, message);
    io.to(roomId).emit('room:message', message);
  });

  socket.on('room:extend', async ({ additionalMinutes }) => {
    const roomId = socket.roomId;
    if (!roomId) return;

    const room = getRoom(roomId);
    if (!room) return;

    const host = getHost(room);
    if (!host || host.socketId !== socket.id) {
      socket.emit('room:error', { message: 'Only host can extend time' });
      return;
    }

    const minutes = Number(additionalMinutes);
    if (!minutes || minutes < 1 || minutes > 120) return;

    const newExpiresAt = extendRoomExpiry(roomId, minutes);
    await supabase.from('rooms').update({ expires_at: newExpiresAt }).eq('id', roomId);

    io.to(roomId).emit('room:timer-updated', { expiresAt: newExpiresAt });
    scheduleRoomExpiry(io, roomId);
  });

  socket.on('room:end', async () => {
    const roomId = socket.roomId;
    if (!roomId) return;

    const room = getRoom(roomId);
    if (!room) return;

    const host = getHost(room);
    if (!host || host.socketId !== socket.id) {
      socket.emit('room:error', { message: 'Only host can end room' });
      return;
    }

    io.to(roomId).emit('room:closed', { reason: 'ended_by_host' });
    if (room.expiryTimer) clearTimeout(room.expiryTimer);
    removeRoom(roomId);
    await deleteRoomFromDb(roomId);
  });

  socket.on('disconnect', async () => {
    try {
      const roomId = socket.roomId;
      if (!roomId) return;

      const room = getRoom(roomId);
      if (!room) return;

      const leavingUser = room.users.find((u) => u.socketId === socket.id);
      const wasHost = leavingUser?.isHost;

      // Xóa user khỏi phòng ngay lập tức
      removeUser(roomId, socket.id);

      // Nếu phòng trống, dọn dẹp timer và xóa phòng khỏi bộ nhớ & DB
      if (room.users.length === 0) {
        if (room.expiryTimer) clearTimeout(room.expiryTimer);
        removeRoom(roomId);
        // Thêm await để đảm bảo xóa trong DB thành công trước khi kết thúc
        await deleteRoomFromDb(roomId);
        return;
      }

      // Logic chuẩn hóa: Nếu host rời đi và phòng VẪN CÒN người
      if (wasHost) {
        // Lấy user đầu tiên trong danh sách những người còn lại làm Host mới
        const nextHost = room.users[0];

        if (nextHost) {
          room.designatedHostId = nextHost.userId; // Cập nhật lại ID host chuẩn
          assignHost(room, nextHost.userId);
        }
      }

      // Thông báo cho các thành viên còn lại
      io.to(roomId).emit('room:user-left', { userId: leavingUser?.userId });
      emitRoomState(io, roomId);

    } catch (error) {
      console.error(`[Disconnect Error] Lỗi khi xử lý ngắt kết nối cho socket ${socket.id}:`, error);
    }
  });
}

/** Sync DB expiry into memory on server start for active rooms */
export function startExpirySweep(io) {
  setInterval(() => {
    for (const [roomId, room] of activeRooms.entries()) {
      if (new Date(room.expiresAt) <= new Date()) {
        closeRoom(io, roomId);
      }
    }
  }, 5000);
}
