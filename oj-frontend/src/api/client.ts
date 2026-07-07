// 기본값은 "같은 origin의 /api" - 접속한 주소가 IP든 도메인이든(.local mDNS 포함) 항상
// 페이지를 받아온 그 주소로 API를 부르게 되어, mDNS를 못 쓰는 기기/네트워크에서만 실패하는
// 문제(도메인을 못 찾음)와 CORS 문제를 둘 다 없앤다. nginx가 /api/ -> 백엔드로 프록시한다.
// VITE_API_URL을 명시적으로 지정하면(예: 백엔드를 완전히 다른 도메인에 둔 경우) 그 값을 우선한다.
const API_URL = import.meta.env.VITE_API_URL || '/api';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('oj_token');
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body.message || message;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, Array.isArray(message) ? message.join(', ') : message);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export { API_URL };
