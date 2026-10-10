import { cn } from "./cn";

const PALETTE = [
  "bg-brand-soft text-brand-ink",
  "bg-teal-soft text-teal-ink",
  "bg-amber-soft text-amber",
  "bg-success-soft text-success",
  "bg-surface-3 text-ink-soft",
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function paletteFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 997;
  return PALETTE[hash % PALETTE.length];
}

export function Avatar({
  name,
  image,
  size = 36,
  className,
}: {
  name: string;
  image?: string | null;
  size?: number;
  className?: string;
}) {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt={name}
        width={size}
        height={size}
        className={cn("rounded-full object-cover border border-line", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      title={name}
      className={cn(
        "inline-flex items-center justify-center rounded-full font-bold border border-line/60 shrink-0",
        paletteFor(name),
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.36) }}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({
  people,
  max = 4,
  size = 28,
}: {
  people: Array<{ id: string; name: string; image?: string | null }>;
  max?: number;
  size?: number;
}) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span className="flex items-center">
      {shown.map((person, index) => (
        <span key={person.id} className={index === 0 ? "" : "-ml-2"}>
          <Avatar name={person.name} image={person.image} size={size} className="ring-2 ring-surface" />
        </span>
      ))}
      {extra > 0 ? (
        <span
          className="-ml-2 inline-flex items-center justify-center rounded-full bg-surface-3 text-ink-soft font-bold ring-2 ring-surface"
          style={{ width: size, height: size, fontSize: Math.max(10, size * 0.34) }}
        >
          +{extra}
        </span>
      ) : null}
    </span>
  );
}
