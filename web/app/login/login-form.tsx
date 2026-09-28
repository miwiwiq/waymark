"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { GoogleButton } from "@/components/google-button";
import { AuthCard, Button, Field, FormError, Input } from "@/components/ui";
import { startSession } from "@/lib/api";
import { useRedirectIfLoggedIn } from "@/lib/session-guards";

const schema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

export function LoginForm({
  googleEnabled,
  notice,
}: {
  googleEnabled: boolean;
  notice?: string;
}) {
  useRedirectIfLoggedIn();
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await startSession("/api/auth/login", values);
      router.replace("/");
    } catch (error) {
      setError("root", {
        message: error instanceof Error ? error.message : "Something went wrong",
      });
    }
  });

  return (
    <AuthCard title="Log in">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormError message={errors.root?.message ?? notice} />
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" {...register("email")} />
        </Field>
        <Field label="Password" error={errors.password?.message}>
          <Input type="password" autoComplete="current-password" {...register("password")} />
        </Field>
        <Button type="submit" disabled={isSubmitting}>
          Log in
        </Button>
      </form>
      {googleEnabled && (
        <div className="mt-3">
          <GoogleButton />
        </div>
      )}
      <p className="mt-6 text-sm opacity-70">
        New to Waymark?{" "}
        <Link href="/register" className="underline">
          Create an account
        </Link>
      </p>
    </AuthCard>
  );
}
