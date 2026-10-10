"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/cn";

const TABS = [
  { href: "/", label: "Home", icon: "🏠", match: (p: string) => p === "/" },
  { href: "/discover", label: "Discover", icon: "🧭", match: (p: string) => p.startsWith("/discover") },
  { href: "/plan", label: "Plan", icon: "✨", match: (p: string) => p.startsWith("/plan") },
  { href: "/people", label: "People", icon: "👥", match: (p: string) => p.startsWith("/people") || p.startsWith("/here") },
  { href: "/profile", label: "Profile", icon: "🙂", match: (p: string) => p.startsWith("/profile") },
];

export function MobileTabBar({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname() ?? "/";

  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-paper/95 backdrop-blur-md border-t border-line"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-5">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          const href = tab.href === "/profile" && !signedIn ? "/signin" : tab.href;
          return (
            <li key={tab.href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2.5 text-[10.5px] font-bold transition-colors",
                  active ? "text-brand" : "text-ink-faint",
                )}
              >
                <span aria-hidden className="text-[17px] leading-none">
                  {tab.icon}
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
