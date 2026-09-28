import { Page } from "@/components/ui";
import { ProfileHeader } from "./profile-header";
import { ProfilePosts } from "./profile-posts";

export default async function ProfilePage({ params }: PageProps<"/u/[username]">) {
  const { username } = await params;
  return (
    <Page width="wide">
      <ProfileHeader username={username.toLowerCase()} />
      <ProfilePosts username={username.toLowerCase()} />
    </Page>
  );
}
