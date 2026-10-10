import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { LinkButton } from "@/components/ui/Button";
import { SignOutButton } from "@/components/auth/SignOutButton";
import type { ViewerSummary } from "@/server/data";

const LINKS = [
  { href: "/discover", label: "Discover" },
  { href: "/plan", label: "Plan" },
  { href: "/people", label: "Find People" },
  { href: "/plans", label: "My Plans" },
  { href: "/messages", label: "Messages" },
];

export function TopNav({ viewer }: { viewer: ViewerSummary | null }) {
  return (
    <header className="sticky top-0 z-40 bg-paper/85 backdrop-blur-md hairline">
      <div className="container-page flex items-center gap-4 h-16">
        <Link href="/" className="flex items-center gap-2 font-extrabold text-lg tracking-tight shrink-0">
          <span
            aria-hidden
            className="grid place-items-center size-8 rounded-xl bg-brand text-white text-base shadow-card"
          >
            ◎
          </span>
          <span>Planadate</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 ml-2" aria-label="Main">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="px-3 py-2 rounded-full text-[13.5px] font-semibold text-ink-soft hover:text-ink hover:bg-surface-2 transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <LinkButton href="/here" variant="secondary" size="sm" className="hidden sm:inline-flex">
            <span aria-hidden>📍</span> I&apos;m here now
          </LinkButton>

          {viewer ? (
            <>
              <Link
                href="/profile"
                className="flex items-center gap-2 rounded-full pl-1 pr-3 py-1 hover:bg-surface-2 transition-colors"
                title={viewer.name}
              >
                <Avatar name={viewer.name} image={viewer.image} size={30} />
                <span className="hidden lg:block text-[13px] font-semibold max-w-28 truncate">
                  {viewer.name.split(" ")[0]}
                </span>
              </Link>
              <SignOutButton />
            </>
          ) : (
            <>
              <LinkButton href="/signin" variant="ghost" size="sm">
                Sign in
              </LinkButton>
              <LinkButton href="/signup" size="sm">
                Join
              </LinkButton>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
