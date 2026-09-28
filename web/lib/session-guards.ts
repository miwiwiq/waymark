"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "./session";

/** For pages that need login: once the session check is done, logged-out visitors go to /login. */
export function useRequireSession() {
  const status = useSession((s) => s.status);
  const router = useRouter();
  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
  }, [status, router]);
  return status;
}

/** For /login and /register: users who are already logged in go home. */
export function useRedirectIfLoggedIn() {
  const status = useSession((s) => s.status);
  const router = useRouter();
  useEffect(() => {
    if (status === "authenticated") router.replace("/");
  }, [status, router]);
}
