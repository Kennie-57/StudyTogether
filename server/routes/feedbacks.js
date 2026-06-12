import { Router } from 'express';
import { supabase } from '../config/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/', requireAuth, async (req, res) => {
  const { content } = req.body;

  if (!content?.trim()) {
    return res.status(400).json({ error: 'Feedback content is required' });
  }

  const { data, error } = await supabase
    .from('feedbacks')
    .insert({
      user_id: req.user.id,
      content: content.trim(),
    })
    .select('id, created_at')
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.status(201).json({ message: 'Feedback submitted', ...data });
});

export default router;
