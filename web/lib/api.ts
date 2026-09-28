import { useSession } from "./session";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type SessionResponse = { accessToken: string; userId: string };

/**
 * Calls the API with the access token. On a 401 it refreshes the token once and
 * retries, so an expired access token never reaches the user (decision W2).
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const send = () => fetch(path, { ...init, headers: withAuth(init) });
  let res = await send();
  if (res.status === 401 && (await refreshSession())) {
    res = await send();
  }
  return parse<T>(res);
}

let refreshing: Promise<boolean> | null = null;

/**
 * Renews the access token after a 401. Concurrent 401s share one refresh, and
 * only a rejected refresh token ends the session: if Auth can't answer, the
 * request fails with its 401 and the user stays logged in.
 */
function refreshSession(): Promise<boolean> {
  refreshing ??= requestAccessToken()
    .then((session) => {
      const state = useSession.getState();
      if (session) {
        state.setSession(session.accessToken, session.userId);
      } else {
        state.clearSession();
      }
      return session !== null;
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/** Runs once on page load: the refresh cookie turns back into a session. */
export async function restoreSession(): Promise<void> {
  const session = await requestAccessToken().catch(() => null);
  const state = useSession.getState();
  if (state.status !== "loading") {
    return; // a login or signup finished first
  }
  if (session) {
    state.setSession(session.accessToken, session.userId);
  } else {
    state.clearSession();
  }
}

/** Login and signup: a 401 here means wrong credentials, not an expired session. */
export async function startSession(
  path: "/api/auth/login" | "/api/auth/register",
  body: unknown,
): Promise<void> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const session = await parse<SessionResponse>(res);
  useSession.getState().setSession(session.accessToken, session.userId);
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
  useSession.getState().clearSession();
}

/** null if the refresh cookie is missing, invalid or logged out; throws if Auth can't answer. */
async function requestAccessToken(): Promise<SessionResponse | null> {
  const res = await fetch("/api/auth/refresh", { method: "POST" });
  return res.status === 401 ? null : parse<SessionResponse>(res);
}

/** Adds a page cursor to an API path, which may already have a query string. */
export function withCursor(path: string, cursor: string | null): string {
  return cursor ? `${path}${path.includes("?") ? "&" : "?"}cursor=${encodeURIComponent(cursor)}` : path;
}

function withAuth(init: RequestInit): Headers {
  const headers = new Headers(init.headers);
  const token = useSession.getState().accessToken;
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (init.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return headers;
}

async function parse<T>(res: Response): Promise<T> {
  const body: unknown = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, errorMessage(body, res.status));
  }
  return body as T;
}

function errorMessage(body: unknown, status: number): string {
  const message = (body as { message?: unknown } | null)?.message;
  if (Array.isArray(message)) {
    return message.join(". "); // class-validator reports one message per rule
  }
  return typeof message === "string" ? message : `Request failed (${status})`;
}
