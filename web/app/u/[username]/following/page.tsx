import { FollowList } from "../follow-list";

export default async function FollowingPage({ params }: PageProps<"/u/[username]/following">) {
  const { username } = await params;
  return <FollowList username={username.toLowerCase()} kind="following" />;
}
