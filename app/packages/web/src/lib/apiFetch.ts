/**
 * Minimal CSRF-aware fetch wrapper.
 * Fetches a CSRF token on first use (cached in memory) and attaches it
 * as the `x-csrf-token` header on all state-changing requests.
 */

let cachedCsrfToken: string | null = null;

async function getCsrfToken(): Promise<string> {
  if (cachedCsrfToken) return cachedCsrfToken;
  const res = await fetch('http://localhost:3000/csrf-token', {
    credentials: 'include',
  });
  const data = await res.json();
  cachedCsrfToken = data.csrfToken as string;
  return cachedCsrfToken;
}

/** Reset the cache (call after logout) */
export function clearCsrfToken() {
  cachedCsrfToken = null;
}

const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Drop-in replacement for `fetch` that automatically attaches the CSRF token
 * header on state-changing requests and forwards all other options unchanged.
 */
export async function apiFetch(input: RequestInfo, init: RequestInit = {}): Promise<Response> {
  const method = (init.method || 'GET').toUpperCase();
  
  if (STATE_CHANGING.has(method)) {
    const token = await getCsrfToken();
    init = {
      ...init,
      credentials: init.credentials ?? 'include',
      headers: {
        ...(init.headers || {}),
        'x-csrf-token': token,
      },
    };
  } else {
    init = { ...init, credentials: init.credentials ?? 'include' };
  }

  const response = await fetch(input, init);

  // If the server returns 403 (token mismatch/expired), refresh and retry once
  if (response.status === 403) {
    const body = await response.clone().json().catch(() => ({}));
    if (body?.message?.toLowerCase().includes('csrf') || body?.code === 'CSRF_INVALID') {
      cachedCsrfToken = null;
      const freshToken = await getCsrfToken();
      init.headers = { ...(init.headers || {}), 'x-csrf-token': freshToken };
      return fetch(input, init);
    }
  }

  return response;
}
