/** Server-side (login and register pages): asks Auth whether Google keys are configured (decision I6). */
export async function isGoogleEnabled(): Promise<boolean> {
  try {
    const res = await fetch(
      `${process.env.INTERNAL_API_URL ?? "http://localhost:8080"}/api/auth/providers`,
      { cache: "no-store" },
    );
    return res.ok && ((await res.json()) as { google: boolean }).google;
  } catch {
    return false;
  }
}
