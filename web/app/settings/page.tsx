"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { DateInput } from "@/components/date-input";
import { ProfileGate } from "@/components/profile-gate";
import { Button, Field, FormError, Input, Page, Textarea } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { myProfileKey, type MyProfile } from "@/lib/profile";
import { useSession } from "@/lib/session";
import { birthDateSchema, today } from "@/lib/validation";

export default function SettingsPage() {
  return <ProfileGate>{(profile) => <SettingsForm profile={profile} />}</ProfileGate>;
}

const schema = z.object({
  displayName: z.string().max(50, "At most 50 characters"),
  bio: z.string().max(300, "At most 300 characters"),
  dateOfBirth: birthDateSchema,
  isPrivate: z.boolean(),
});

function SettingsForm({ profile }: { profile: MyProfile }) {
  const userId = useSession((s) => s.userId);
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      displayName: profile.displayName ?? "",
      bio: profile.bio ?? "",
      dateOfBirth: profile.dateOfBirth ?? "",
      isPrivate: profile.isPrivate,
    },
  });
  const isPrivate = useWatch({ control, name: "isPrivate" });

  const save = useMutation({
    mutationFn: (values: z.infer<typeof schema>) =>
      apiFetch<MyProfile>("/api/users/me", { method: "PATCH", body: JSON.stringify(values) }),
    onSuccess: (updated) => {
      queryClient.setQueryData(myProfileKey(userId), updated);
      reset({
        displayName: updated.displayName ?? "",
        bio: updated.bio ?? "",
        dateOfBirth: updated.dateOfBirth ?? "",
        isPrivate: updated.isPrivate,
      });
      // Going public accepts pending requests, which changes counts elsewhere.
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: ["profile", "view"] }),
        queryClient.invalidateQueries({ queryKey: ["users", "list"] }),
        queryClient.invalidateQueries({ queryKey: ["users", "requests-count"] }),
      ]);
    },
  });

  return (
    <Page width="narrow">
      <h1 className="mb-6 font-display text-3xl font-semibold">Edit profile</h1>
      <form
        onSubmit={handleSubmit((values) => save.mutate(values))}
        noValidate
        className="flex flex-col gap-4"
      >
        <FormError message={save.error?.message} />
        {/* Read-only (I2), so it's plain text rather than a disabled field that looks editable. */}
        <div className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Username</span>
          <p className="flex items-center gap-2 rounded-md bg-neutral-200/50 px-3 py-2 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            @{profile.username}
          </p>
          <span className="opacity-60">Usernames can’t be changed.</span>
        </div>
        <Field label="Display name" optional error={errors.displayName?.message}>
          <Input {...register("displayName")} />
        </Field>
        <Field label="Bio" optional error={errors.bio?.message}>
          <Textarea {...register("bio")} />
        </Field>
        <Field
          label="Date of birth"
          required
          error={errors.dateOfBirth?.message}
          hint={<span className="opacity-60">Only you can see your date of birth.</span>}
        >
          <Controller
            control={control}
            name="dateOfBirth"
            render={({ field }) => <DateInput {...field} max={today()} autoComplete="bday" aria-invalid={Boolean(errors.dateOfBirth)} />}
          />
        </Field>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-1" {...register("isPrivate")} />
          <span>
            <span className="font-medium">Private account</span>
            <span className="block opacity-70">
              Only people you approve see your travel logs and follower lists.
            </span>
            {profile.isPrivate && !isPrivate && (
              <span className="mt-1 block text-amber-700 dark:text-amber-400">
                Making your account public accepts all pending follow requests.
              </span>
            )}
          </span>
        </label>
        <Button type="submit" disabled={!isDirty || save.isPending}>
          {save.isPending ? "Saving…" : isDirty ? "Save changes" : "No changes to save"}
        </Button>
        {save.isSuccess && !isDirty && <p className="text-sm text-green-700 dark:text-green-400">Saved.</p>}
      </form>
    </Page>
  );
}
