import { FollowList } from "../follow-list";

export default async function FollowersPage({ params }: PageProps<"/u/[username]/followers">) {
  const { username } = await params;
  return <FollowList username={username.toLowerCase()} kind="followers" />;
}
