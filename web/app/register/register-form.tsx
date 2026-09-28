"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { GoogleButton } from "@/components/google-button";
import { AuthCard, Button, Field, FormError, Input } from "@/components/ui";
import { UsernameField } from "@/components/username-field";
import { ApiError, startSession } from "@/lib/api";
import { useRedirectIfLoggedIn } from "@/lib/session-guards";
import { birthDateSchema, today, usernameSchema } from "@/lib/validation";

const schema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters").max(128, "At most 128 characters"),
  username: usernameSchema,
  dateOfBirth: birthDateSchema,
});

export function RegisterForm({ googleEnabled }: { googleEnabled: boolean }) {
  useRedirectIfLoggedIn();
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", username: "", dateOfBirth: "" },
  });
  const username = useWatch({ control, name: "username" });

  const onSubmit = handleSubmit(async (values) => {
    try {
      // The profile is created asynchronously; the home page waits for it (I5).
      await startSession("/api/auth/register", values);
      router.replace("/");
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setError("email", { message: error.message });
      } else {
        setError("root", {
          message: error instanceof Error ? error.message : "Something went wrong",
        });
      }
    }
  });

  return (
    <AuthCard title="Create your account">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormError message={errors.root?.message} />
        <Field label="Email" required error={errors.email?.message}>
          <Input type="email" autoComplete="email" {...register("email")} />
        </Field>
        <Field label="Password" required error={errors.password?.message}>
          <Input type="password" autoComplete="new-password" {...register("password")} />
        </Field>
        <UsernameField
          registration={register("username")}
          value={username}
          error={errors.username?.message}
          onPick={(name) => setValue("username", name, { shouldValidate: true })}
        />
        <Field
          label="Date of birth"
          required
          error={errors.dateOfBirth?.message}
          hint={<span className="opacity-60">Only you can see it.</span>}
        >
          <Input type="date" max={today()} {...register("dateOfBirth")} />
        </Field>
        <Button type="submit" disabled={isSubmitting}>
          Sign up
        </Button>
      </form>
      {googleEnabled && (
        <div className="mt-3">
          <GoogleButton />
        </div>
      )}
      <p className="mt-6 text-sm opacity-70">
        Already have an account?{" "}
        <Link href="/login" className="underline">
          Log in
        </Link>
      </p>
    </AuthCard>
  );
}
