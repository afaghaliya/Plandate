import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface-2/50 mt-8">
      <div className="container-page py-8 flex flex-col sm:flex-row gap-4 sm:items-center justify-between text-[12.5px] text-ink-faint">
        <p>
          <span className="font-bold text-ink">Planadate</span> — plan the outing, find the people.
        </p>
        <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Footer">
          <Link href="/safety" className="hover:text-ink">
            Community guidelines
          </Link>
          <Link href="/how-it-works" className="hover:text-ink">
            How it works
          </Link>
          <Link href="/discover" className="hover:text-ink">
            Discover
          </Link>
        </nav>
      </div>
    </footer>
  );
}
