const isProd = import.meta.env.PROD;

export const API_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '';
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export function getConfigErrors() {
  const errors = [];
  if (!SUPABASE_URL) errors.push('VITE_SUPABASE_URL chưa được cấu hình');
  if (!SUPABASE_ANON_KEY) errors.push('VITE_SUPABASE_ANON_KEY chưa được cấu hình');
  if (!API_URL) {
    errors.push(
      isProd
        ? 'VITE_API_URL chưa được cấu hình trên Vercel (URL backend Render)'
        : 'VITE_API_URL chưa được cấu hình (mặc định local: http://localhost:3001)'
    );
  }
  return errors;
}

export function resolveApiUrl() {
  if (API_URL) return API_URL;
  if (isProd) return '';
  return 'http://localhost:3001';
}
