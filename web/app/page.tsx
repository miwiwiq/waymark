"use client";

import { ProfileGate } from "@/components/profile-gate";
import { Feed } from "./feed";

export default function HomePage() {
  return <ProfileGate>{() => <Feed />}</ProfileGate>;
}
