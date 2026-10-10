import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getViewer } from "@/server/data";
import { TopNav } from "@/components/shell/TopNav";
import { MobileTabBar } from "@/components/shell/MobileTabBar";
import { SiteFooter } from "@/components/shell/SiteFooter";

export const metadata: Metadata = {
  title: {
    default: "Planadate — plan outings, find people",
    template: "%s · Planadate",
  },
  description:
    "Tell Planadate where you are, who you're with and how much time you have. We'll plan the outing and help you find people to enjoy it with.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdfaf6" },
    { media: "(prefers-color-scheme: dark)", color: "#14110e" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();

  return (
    <html lang="en">
      <body className="min-h-dvh flex flex-col">
        <TopNav viewer={viewer} />
        <main className="flex-1 pb-24 md:pb-10">{children}</main>
        <SiteFooter />
        <MobileTabBar signedIn={!!viewer} />
      </body>
    </html>
  );
}
