import { verifyToken } from '../config/supabase.js';
import { ensureProfile } from '../lib/ensureProfile.js';

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = header.slice(7);
  const user = await verifyToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    await ensureProfile(user);
  } catch (err) {
    console.error('[auth] ensureProfile failed:', err.message);
    return res.status(500).json({
      error: err.message.includes('does not exist')
        ? 'Bảng profiles chưa tồn tại. Hãy chạy supabase/schema.sql trong Supabase SQL Editor.'
        : `Không thể đồng bộ profile: ${err.message}`,
    });
  }

  req.user = user;
  next();
}
