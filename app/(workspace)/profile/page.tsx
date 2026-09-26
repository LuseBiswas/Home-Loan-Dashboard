import type { Metadata } from "next";
import { ProfileApp } from "./profile-app";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profile · Home Loan Compass",
};

export default function ProfilePage() {
  return <ProfileApp />;
}
