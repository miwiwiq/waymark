import { useQuery } from "@tanstack/react-query";
import { ApiError, apiFetch } from "./api";
import { useSession } from "./session";

export type MyProfile = {
  id: string;
  username: string | null;
  dateOfBirth: string | null;
  displayName: string | null;
  bio: string | null;
  isPrivate: boolean;
  /** False until a username is set (decision I7). */
  complete: boolean;
};

const ATTEMPTS = 5;

export function myProfileKey(userId: string | null) {
  return ["profile", "me", userId] as const;
}

export function useMyProfile() {
  const status = useSession((s) => s.status);
  const userId = useSession((s) => s.userId);
  return useQuery({
    queryKey: myProfileKey(userId),
    queryFn: () => apiFetch<MyProfile>("/api/users/me"),
    enabled: status === "authenticated",
    // The profile is created asynchronously after signup (decision I5): a 404
    // is retried with exponential backoff, 5 attempts over about 7.5 s.
    retry: (failures, error) =>
      error instanceof ApiError && error.status === 404 && failures < ATTEMPTS - 1,
    retryDelay: (failures) => 500 * 2 ** failures,
  });
}
