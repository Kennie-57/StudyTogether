/** In-memory real-time room state (not persisted to DB) */
export const activeRooms = new Map();

const MAX_USERS_PER_ROOM = 10;

export function getActiveRoomCount(roomId) {
  const room = activeRooms.get(roomId);
  return room?.users.length ?? 0;
}

export function getRoom(roomId) {
  return activeRooms.get(roomId);
}

export function createOrGetRoom(roomId, expiresAt) {
  if (!activeRooms.has(roomId)) {
    activeRooms.set(roomId, {
      expiresAt,
      users: [],
      messages: [],
    });
  }
  return activeRooms.get(roomId);
}

export function removeRoom(roomId) {
  activeRooms.delete(roomId);
}

export function addUser(roomId, user) {
  const room = activeRooms.get(roomId);
  if (!room) return { error: 'Room not active' };
  if (room.users.length >= MAX_USERS_PER_ROOM) {
    return { error: 'Room is full (max 10 users)' };
  }
  const existingIdx = room.users.findIndex((u) => u.userId === user.userId);
  if (existingIdx !== -1) {
    room.users[existingIdx] = user;
  } else {
    room.users.push(user);
  }
  return { room };
}

export function removeUser(roomId, socketId) {
  const room = activeRooms.get(roomId);
  if (!room) return null;

  const index = room.users.findIndex((u) => u.socketId === socketId);
  if (index === -1) return room;

  room.users.splice(index, 1);
  return room;
}

/** Alpha-beta sort: alphabetical by username */
export function sortUsersAlpha(users) {
  return [...users].sort((a, b) =>
    a.username.localeCompare(b.username, 'vi', { sensitivity: 'base' })
  );
}

export function assignHost(room, designatedHostId = null) {
  if (room.users.length === 0) return null;

  const sorted = sortUsersAlpha(room.users);
  const designated = designatedHostId
    ? sorted.find((u) => u.userId === designatedHostId)
    : null;
  const hostUser = designated || sorted[0];

  room.users = sorted.map((u) => ({
    ...u,
    isHost: u.userId === hostUser.userId,
  }));
  return hostUser;
}

export function getHost(room) {
  return room.users.find((u) => u.isHost);
}

export function extendRoomExpiry(roomId, additionalMinutes) {
  const room = activeRooms.get(roomId);
  if (!room) return null;

  const current = new Date(room.expiresAt).getTime();
  const extended = new Date(current + additionalMinutes * 60 * 1000);
  room.expiresAt = extended.toISOString();
  return room.expiresAt;
}

export function setRoomExpiry(roomId, expiresAt) {
  const room = activeRooms.get(roomId);
  if (!room) return null;
  room.expiresAt = expiresAt;
  return room.expiresAt;
}

export function addMessage(roomId, message) {
  const room = activeRooms.get(roomId);
  if (!room) return null;
  room.messages.push(message);
  if (room.messages.length > 100) {
    room.messages = room.messages.slice(-100);
  }
  return message;
}

export function serializeRoom(room) {
  return {
    expiresAt: room.expiresAt,
    users: room.users.map(({ socketId, ...rest }) => rest),
    messages: room.messages,
  };
}
