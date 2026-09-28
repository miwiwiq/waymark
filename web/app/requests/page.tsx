"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ProfileGate } from "@/components/profile-gate";
import { Button, Page } from "@/components/ui";
import { UserList } from "@/components/user-list";
import { apiFetch } from "@/lib/api";
import { useUserList, type UserSummary } from "@/lib/users";

export default function RequestsPage() {
  return <ProfileGate>{() => <Requests />}</ProfileGate>;
}

function Requests() {
  const requests = useUserList("/api/users/me/requests");

  return (
    <Page width="wide">
      <h1 className="mb-4 font-display text-3xl font-semibold">Follow requests</h1>
      <UserList
        query={requests}
        empty="No pending requests."
        actions={(user) => <RequestActions user={user} />}
      />
    </Page>
  );
}

function RequestActions({ user }: { user: UserSummary }) {
  const queryClient = useQueryClient();
  const respond = useMutation({
    mutationFn: (decision: "accept" | "reject") =>
      apiFetch(`/api/users/me/requests/${user.id}/${decision}`, { method: "POST" }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["users", "list"] }),
        queryClient.invalidateQueries({ queryKey: ["users", "requests-count"] }),
        queryClient.invalidateQueries({ queryKey: ["profile", "view"] }),
      ]),
  });

  return (
    <div className="flex shrink-0 gap-2">
      <Button onClick={() => respond.mutate("accept")} disabled={respond.isPending}>
        Accept
      </Button>
      <Button variant="secondary" onClick={() => respond.mutate("reject")} disabled={respond.isPending}>
        Reject
      </Button>
    </div>
  );
}
