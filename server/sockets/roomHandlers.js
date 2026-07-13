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

function handleUserRemoval(io, roomId, socketId) {
  const room = getRoom(roomId);
  if (!room) return;

  const leavingUser = room.users.find((u) => u.socketId === socketId);
  const wasHost = leavingUser?.isHost;

  removeUser(roomId, socketId);

  if (room.users.length === 0) {
    if (room.expiryTimer) clearTimeout(room.expiryTimer);
    removeRoom(roomId);
    deleteRoomFromDb(roomId);
  } else if (wasHost) {
    // Chuyển quyền cho người tiếp theo trong danh sách
    const nextHost = room.users[0];
    assignHost(room, nextHost.userId);
  }

  io.to(roomId).emit('room:user-left', { userId: leavingUser?.userId });
  emitRoomState(io, roomId);
}

export function registerRoomHandlers(io, socket) {
  socket.on('room:join', async ({ roomId, token, expiresAt }) => {
    try {
      const isBot = token && token.startsWith('BOT_TOKEN_');
      let user, username, avatarUrl, designatedHostId, finalExpiresAt;

      if (isBot) {
        // LUỒNG BYPASS (MOCK DỮ LIỆU DÀNH CHO BOT TEST)
        const botId = token.replace('BOT_TOKEN_', ''); // Lấy ID số của bot
        user = { id: `bot-user-uuid-${botId}` };
        username = `Bot ${botId}`;
        avatarUrl = null;
        finalExpiresAt = expiresAt || new Date(Date.now() + 86400000).toISOString();
        designatedHostId = null; // Để trống để thuật toán tự lấy người đầu tiên làm Host
      } else {
        // LUỒNG THỰC TẾ (DÀNH CHO USER THẬT)
        const { verifyToken } = await import('../config/supabase.js');
        user = await verifyToken(token);
        if (!user) {
          socket.emit('room:error', { message: 'Unauthorized' });
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('id', user.id)
          .single();

        username = profile?.full_name || user.user_metadata?.full_name || 'User';
        avatarUrl = profile?.avatar_url || null;

        const { data: dbRoom } = await supabase
          .from('rooms')
          .select('id, host_id, expires_at')
          .eq('id', roomId)
          .single();

        if (!dbRoom || new Date(dbRoom.expires_at) <= new Date()) {
          socket.emit('room:error', { message: 'Room not found or expired' });
          return;
        }

        designatedHostId = dbRoom.host_id;
        finalExpiresAt = expiresAt || dbRoom.expires_at;
      }

      // XỬ LÝ LƯU VÀO RAM CHUNG CHO CẢ 2 LUỒNG
      const room = createOrGetRoom(roomId, finalExpiresAt);
      if (!isBot) {
        room.designatedHostId = designatedHostId;
      }

      const result = addUser(roomId, {
        socketId: socket.id,
        userId: user.id,
        username,
        avatarUrl,
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

      // Chỉ gọi Database ghi nhận số lần vào phòng đối với user thật
      if (!isBot) {
        await incrementRoomsJoined(user.id);
      }

      socket.emit('room:joined', serializeRoom(room));
      socket.to(roomId).emit('room:user-joined', {
        userId: user.id,
        username,
        statusIcon: '📚',
      });
      emitRoomState(io, roomId);
      scheduleRoomExpiry(io, roomId);

    } catch (err) {
      console.error('Join Error:', err); // Log lỗi ra console để bạn dễ monitor khi server chạy
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

  // 1. Handler cho sự kiện chủ động rời phòng
  socket.on('room:leave', () => {
    if (socket.roomId) {
      handleUserRemoval(io, socket.roomId, socket.id);
      socket.leave(socket.roomId);
      socket.roomId = null;
    }
  });

  // 2. Handler cho sự kiện disconnect (vẫn giữ để backup)
  socket.on('disconnect', () => {
    if (socket.roomId) {
      handleUserRemoval(io, socket.roomId, socket.id);
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
