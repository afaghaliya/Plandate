import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { OutingForm } from "@/components/outing/OutingForm";

export const metadata = { title: "Post an activity" };

export default async function NewOutingPage() {
  const userId = await currentUserId();
  if (!userId) redirect("/signin?from=%2Fpeople%2Fnew");

  return (
    <div className="container-page max-w-xl py-10">
      <h1 className="text-2xl sm:text-3xl font-extrabold mb-1">Find people for something</h1>
      <p className="text-[13.5px] text-ink-faint mb-6">
        Post what you want to do, and let others request to join.
      </p>
      <OutingForm />
    </div>
  );
}
