import { supabase } from '../config/supabase.js';

export async function ensureProfile(user) {
  const { data: existing, error: selectError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (selectError) {
    throw new Error(selectError.message);
  }

  if (existing) return existing;

  const fullName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split('@')[0] ||
    'User';

  const { error: insertError } = await supabase.from('profiles').insert({
    id: user.id,
    full_name: fullName,
    avatar_url: user.user_metadata?.avatar_url || null,
  });

  if (insertError) {
    throw new Error(insertError.message);
  }

  return { id: user.id };
}
