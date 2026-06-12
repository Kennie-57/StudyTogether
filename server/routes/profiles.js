import { Router } from 'express';
import { supabase } from '../config/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/me', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, rooms_joined_count, updated_at')
    .eq('id', req.user.id)
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});

export default router;
