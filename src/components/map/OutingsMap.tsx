"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { OutingCardData } from "@/server/data";

const MapInner = dynamic(() => import("./OutingsMapInner"), {
  ssr: false,
  loading: () => (
    <div className="h-full grid place-items-center text-[13px] text-ink-faint bg-surface-2 rounded-[var(--radius-card)]">
      Loading map…
    </div>
  ),
});

/**
 * Client-only wrapper. Leaflet touches `window` at import time, so it must
 * never run during SSR -- `dynamic(..., { ssr: false })` plus this mount gate
 * keeps the server bundle clean.
 */
export function OutingsMap({ outings, className }: { outings: OutingCardData[]; className?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const points = useMemo(
    () => outings.filter((o) => Number.isFinite(o.approxLat) && Number.isFinite(o.approxLng)),
    [outings],
  );

  if (!mounted) {
    return <div className={className} />;
  }

  return <MapInner outings={points} className={className} />;
}
