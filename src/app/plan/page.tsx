import { PlannerForm } from "@/components/plan/PlannerForm";
import { getViewer } from "@/server/data";

export const metadata = { title: "Plan an outing" };

export default async function PlanPage() {
  const viewer = await getViewer();

  return (
    <div className="container-page max-w-2xl py-10">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold">Plan your outing</h1>
        <p className="text-[13.5px] text-ink-faint mt-1.5">
          A few details, and we&apos;ll turn them into a real, sequenced plan.
        </p>
      </div>
      <PlannerForm signedIn={!!viewer} />
    </div>
  );
}
