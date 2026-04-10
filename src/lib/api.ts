async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Request failed');
  return json;
}

export const api = {
  login: (password: string) =>
    apiFetch('/api/login', { method: 'POST', body: JSON.stringify({ password }) }),

  logout: () =>
    apiFetch('/api/logout', { method: 'POST' }),

  me: () =>
    apiFetch('/api/me'),

  createUser: (email: string, password: string, full_name?: string) =>
    apiFetch('/api/users', { method: 'POST', body: JSON.stringify({ email, password, full_name }) }),

  searchUser: (email: string) =>
    apiFetch(`/api/users/search?email=${encodeURIComponent(email)}`),

  listUsers: () =>
    apiFetch('/api/users/list'),

  updateProfile: (userId: string, data: Record<string, unknown>) =>
    apiFetch(`/api/profiles/${userId}`, { method: 'PUT', body: JSON.stringify(data) }),
};
