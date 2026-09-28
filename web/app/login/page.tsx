import { isGoogleEnabled } from "@/lib/providers";
import { LoginForm } from "./login-form";

// Set by Auth's Google callback when it sends the user back here.
const NOTICES: Record<string, string> = {
  email_in_use: "This email already has an account. Log in with your password.",
  google_failed: "Google sign-in didn’t complete. Please try again.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  return (
    <LoginForm
      googleEnabled={await isGoogleEnabled()}
      notice={typeof error === "string" ? NOTICES[error] : undefined}
    />
  );
}
