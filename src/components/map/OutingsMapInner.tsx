"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import Link from "next/link";
import type { OutingCardData } from "@/server/data";
import { interestEmoji } from "@/lib/domain";
import { formatWhen } from "@/lib/time";

const TILE_URL =
  process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || "&copy; OpenStreetMap contributors";

function pin(emoji: string, live: boolean): L.DivIcon {
  return L.divIcon({
    html: `<div style="
      display:flex;align-items:center;justify-content:center;
      width:34px;height:34px;border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      background:${live ? "#e8452a" : "#0f766e"};
      box-shadow:0 2px 6px rgba(0,0,0,.3);
      border:2px solid white;
    "><span style="transform:rotate(45deg);font-size:15px;">${emoji}</span></div>`,
    className: "",
    iconSize: [34, 34],
    iconAnchor: [17, 30],
    popupAnchor: [0, -30],
  });
}

export default function OutingsMapInner({
  outings,
  className,
}: {
  outings: OutingCardData[];
  className?: string;
}) {
  const center: [number, number] =
    outings.length > 0 ? [outings[0].approxLat, outings[0].approxLng] : [9.9312, 76.2673];

  return (
    <div className={className}>
      <MapContainer
        center={center}
        zoom={outings.length > 0 ? 11 : 6}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer url={TILE_URL} attribution={ATTRIBUTION} />
        {outings.map((outing) => (
          <Marker
            key={outing.id}
            position={[outing.approxLat, outing.approxLng]}
            icon={pin(interestEmoji(outing.category), outing.isHereNow)}
          >
            <Popup>
              <p className="font-bold text-[13px]">{outing.title}</p>
              <p className="text-ink-faint">{formatWhen(new Date(outing.startTime))}</p>
              <p className="text-ink-faint">{outing.goingCount} going</p>
              <Link href={`/outings/${outing.id}`} className="text-brand font-semibold">
                View →
              </Link>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
