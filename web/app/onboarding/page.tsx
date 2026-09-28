"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { ProfileGate } from "@/components/profile-gate";
import { AuthCard, Button, Field, FormError, Input } from "@/components/ui";
import { UsernameField } from "@/components/username-field";
import { ApiError, apiFetch } from "@/lib/api";
import { myProfileKey, type MyProfile } from "@/lib/profile";
import { useSession } from "@/lib/session";
import { birthDateSchema, today, usernameSchema } from "@/lib/validation";

// Where incomplete profiles land (decision I7): new Google users, and signups
// whose username was taken before their profile was created.
export default function OnboardingPage() {
  return <ProfileGate onboarding>{(profile) => <OnboardingForm profile={profile} />}</ProfileGate>;
}

const withBirthDate = z.object({ username: usernameSchema, dateOfBirth: birthDateSchema });
const usernameOnly = z.object({ username: usernameSchema, dateOfBirth: z.string() });

function OnboardingForm({ profile }: { profile: MyProfile }) {
  const needsBirthDate = profile.dateOfBirth === null;
  const userId = useSession((s) => s.userId);
  const queryClient = useQueryClient();
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(needsBirthDate ? withBirthDate : usernameOnly),
    defaultValues: { username: "", dateOfBirth: "" },
  });
  const username = useWatch({ control, name: "username" });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const updated = await apiFetch<MyProfile>("/api/users/me/onboarding", {
        method: "POST",
        body: JSON.stringify(needsBirthDate ? values : { username: values.username }),
      });
      queryClient.setQueryData(myProfileKey(userId), updated);
      router.replace("/");
    } catch (error) {
      if (error instanceof ApiError && error.status === 409 && /taken/i.test(error.message)) {
        setError("username", { message: error.message });
      } else {
        setError("root", {
          message: error instanceof Error ? error.message : "Something went wrong",
        });
      }
    }
  });

  return (
    <AuthCard title="Choose your username">
      <p className="mb-4 text-sm opacity-70">
        It’s how people find you on Waymark, and it can’t be changed later.
      </p>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormError message={errors.root?.message} />
        <UsernameField
          registration={register("username")}
          value={username}
          error={errors.username?.message}
          onPick={(name) => setValue("username", name, { shouldValidate: true })}
        />
        {needsBirthDate && (
          <Field
            label="Date of birth"
            required
            error={errors.dateOfBirth?.message}
            hint={<span className="opacity-60">Only you can see it.</span>}
          >
            <Input type="date" max={today()} {...register("dateOfBirth")} />
          </Field>
        )}
        <Button type="submit" disabled={isSubmitting}>
          Continue
        </Button>
      </form>
    </AuthCard>
  );
}
