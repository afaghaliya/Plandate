import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { getProfileForEdit } from "@/server/data";
import { ProfileEditForm } from "./ProfileEditForm";

export const metadata = { title: "Edit profile" };

export default async function EditProfilePage() {
  const userId = await currentUserId();
  if (!userId) redirect("/signin?from=%2Fprofile%2Fedit");

  const profile = await getProfileForEdit(userId);
  if (!profile) redirect("/profile");

  return (
    <div className="container-page max-w-lg py-10">
      <h1 className="text-2xl font-extrabold mb-6">Edit your profile</h1>
      <ProfileEditForm initial={profile} userId={userId} />
    </div>
  );
}
