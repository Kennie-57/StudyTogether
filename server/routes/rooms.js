import { Router } from 'express';
import { supabase } from '../config/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { getActiveRoomCount } from '../sockets/roomStore.js';

const router = Router();

router.get('/', requireAuth, async (_req, res) => {
  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('rooms')
      .select('id, name, password, host_id, expires_at, created_at')
      .gt('expires_at', now)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[rooms GET]', error.message);
      return res.status(500).json({
        error: error.message.includes('does not exist')
          ? 'Bảng rooms chưa tồn tại. Hãy chạy supabase/schema.sql trong Supabase SQL Editor.'
          : error.message,
      });
    }

    const hostIds = [...new Set((data || []).map((r) => r.host_id))];
    let profileMap = {};

    if (hostIds.length > 0) {
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', hostIds);

      if (profileError) {
        console.error('[rooms GET profiles]', profileError.message);
      } else {
        profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
      }
    }

    const rooms = (data || []).map((room) => ({
      ...room,
      profiles: profileMap[room.host_id] || null,
      hasPassword: Boolean(room.password),
      password: undefined,
      activeUsers: getActiveRoomCount(room.id),
    }));

    res.json(rooms);
  } catch (err) {
    console.error('[rooms GET] unexpected:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  const { name, password, durationMinutes } = req.body;

  if (!name?.trim()) {
    return res.status(400).json({ error: 'Room name is required' });
  }

  const minutes = Number(durationMinutes);
  if (!minutes || minutes < 1 || minutes > 480) {
    return res.status(400).json({ error: 'Duration must be between 1 and 480 minutes' });
  }

  const expiresAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('rooms')
    .insert({
      name: name.trim(),
      password: password?.trim() || null,
      host_id: req.user.id,
      expires_at: expiresAt,
    })
    .select('id, name, password, host_id, expires_at, created_at')
    .single();

  if (error) {
    console.error('[rooms POST]', error.message);
    return res.status(500).json({
      error: error.message.includes('does not exist')
        ? 'Bảng rooms chưa tồn tại. Hãy chạy supabase/schema.sql trong Supabase SQL Editor.'
        : error.message.includes('foreign key')
          ? 'Profile chưa tồn tại. Thử tải lại trang — server sẽ tự tạo profile.'
          : error.message,
    });
  }

  res.status(201).json({
    ...data,
    hasPassword: Boolean(data.password),
    password: undefined,
  });
});

router.post('/:id/join', requireAuth, async (req, res) => {
  const { password } = req.body;
  const { id } = req.params;

  const { data: room, error } = await supabase
    .from('rooms')
    .select('id, name, password, host_id, expires_at')
    .eq('id', id)
    .single();

  if (error || !room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  if (new Date(room.expires_at) <= new Date()) {
    return res.status(410).json({ error: 'Room has expired' });
  }

  if (room.password && room.password !== password) {
    return res.status(403).json({ error: 'Incorrect password' });
  }

  res.json({
    id: room.id,
    name: room.name,
    host_id: room.host_id,
    expires_at: room.expires_at,
    hasPassword: Boolean(room.password),
  });
});

export default router;
