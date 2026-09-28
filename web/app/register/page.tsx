import { isGoogleEnabled } from "@/lib/providers";
import { RegisterForm } from "./register-form";

export default async function RegisterPage() {
  return <RegisterForm googleEnabled={await isGoogleEnabled()} />;
}
