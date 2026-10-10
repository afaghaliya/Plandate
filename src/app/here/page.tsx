import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { OutingForm } from "@/components/outing/OutingForm";
import { Chip } from "@/components/ui/Chip";
import { HERE_NOW_TEMPLATES } from "@/lib/domain";

export const metadata = { title: "I'm here now" };

export default async function HereNowPage() {
  const userId = await currentUserId();
  if (!userId) redirect("/signin?from=%2Fhere");

  return (
    <div className="container-page max-w-xl py-10">
      <div className="flex items-center gap-2 mb-1">
        <span className="relative flex size-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-60" />
          <span className="relative inline-flex rounded-full size-2.5 bg-danger" />
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold">I&apos;m here now</h1>
      </div>
      <p className="text-[13.5px] text-ink-faint mb-4">
        You&apos;re somewhere and free right now — let nearby Planadate users know.
      </p>
      <div className="flex flex-wrap gap-2 mb-6">
        {HERE_NOW_TEMPLATES.map((t) => (
          <Chip key={t.label}>{t.label}</Chip>
        ))}
      </div>
      <OutingForm hereNowDefault />
    </div>
  );
}
