import { create } from "zustand";

type Status = "loading" | "authenticated" | "anonymous";

// The access token lives only in memory (decision I4); the refresh token is an
// httpOnly cookie the browser sends to /api/auth on its own.
type SessionState = {
  /** "loading" until the page-load refresh answers. */
  status: Status;
  accessToken: string | null;
  userId: string | null;
  setSession: (accessToken: string, userId: string) => void;
  clearSession: () => void;
};

export const useSession = create<SessionState>()((set) => ({
  status: "loading",
  accessToken: null,
  userId: null,
  setSession: (accessToken, userId) =>
    set({ status: "authenticated", accessToken, userId }),
  clearSession: () =>
    set({ status: "anonymous", accessToken: null, userId: null }),
}));
