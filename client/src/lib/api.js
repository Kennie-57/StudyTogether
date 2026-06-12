const API_URL = import.meta.env.VITE_API_URL || '';

export async function apiFetch(path, options = {}, token) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}
