const AUTH_KEY = 'stockpilot_auth_token'

export function isLoggedIn(): boolean {
  return !!localStorage.getItem(AUTH_KEY)
}

export function getToken(): string | null {
  return localStorage.getItem(AUTH_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(AUTH_KEY, token)
}

export function logout(): void {
  localStorage.removeItem(AUTH_KEY)
  window.location.reload()
}

export async function login(username: string, password: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const resp = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const data = await resp.json()
    if (data.ok && data.token) {
      setToken(data.token)
      return { ok: true }
    }
    return { ok: false, error: data.error || '登录失败' }
  } catch {
    return { ok: false, error: '网络错误，请重试' }
  }
}
