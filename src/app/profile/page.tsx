import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";

export default async function ProfileRedirect() {
  const userId = await currentUserId();
  if (!userId) redirect("/signin?from=%2Fprofile");
  redirect(`/profile/${userId}`);
}
