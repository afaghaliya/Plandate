/**
 * Read-side data access. Server components import from here directly; nothing
 * in this file mutates. Every list path sweeps expiry first and strips blocked
 * users, and every coordinate that reaches a discovery surface is coarsened.
 */
import { prisma } from "@/lib/prisma";
import { currentUserId } from "@/lib/auth";
import { parseStringList } from "@/lib/json";
import { coarsen, distanceKm, geocode, type GeoPoint } from "@/lib/geo";
import { scoreMatch } from "@/lib/matching";
import { sweepExpired } from "@/lib/expiry";
import { readItinerary } from "@/lib/ai/read";
import type { Itinerary } from "@/lib/ai/schema";

export type ViewerSummary = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  homeCity: string | null;
  interests: string[];
  verification: string;
};

export async function getViewer(): Promise<ViewerSummary | null> {
  const id = await currentUserId();
  if (!id) return null;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    homeCity: user.homeCity,
    interests: parseStringList(user.interests),
    verification: user.verification,
  };
}

async function blockedIdsFor(userId: string | null): Promise<Set<string>> {
  if (!userId) return new Set();
  const blocks = await prisma.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  const ids = new Set<string>();
  for (const block of blocks) {
    ids.add(block.blockerId === userId ? block.blockedId : block.blockerId);
  }
  return ids;
}

// ------------------------------------------------------------- discovery

export type DiscoverFilters = {
  q?: string;
  category?: string;
  city?: string;
  when?: "now" | "today" | "tomorrow" | "week" | "any";
  maxDistanceKm?: number;
  minSpots?: number;
  maxDurationMinutes?: number;
  hereNowOnly?: boolean;
  sort?: "match" | "soonest" | "popular";
};

export type OutingCardData = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  locationName: string;
  city: string;
  /** Coarsened to a ~500m grid. Precise venue coords are never in a list. */
  approxLat: number;
  approxLng: number;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  capacity: number;
  goingCount: number;
  spotsLeft: number;
  isHereNow: boolean;
  status: string;
  minAge: number | null;
  maxAge: number | null;
  host: { id: string; name: string; image: string | null; verification: string };
  going: Array<{ id: string; name: string; image: string | null }>;
  matchScore: number;
  matchWhy: string[];
  distanceKm: number | null;
  viewerStatus: "host" | "accepted" | "pending" | "declined" | "none";
};

export async function listOutings(
  filters: DiscoverFilters = {},
  viewerId: string | null = null,
): Promise<OutingCardData[]> {
  await sweepExpired();

  const now = new Date();
  const blocked = await blockedIdsFor(viewerId);

  const windowEnd = (() => {
    switch (filters.when) {
      case "now":
        return new Date(now.getTime() + 3 * 60 * 60_000);
      case "today": {
        const end = new Date(now);
        end.setHours(23, 59, 59, 999);
        return end;
      }
      case "tomorrow": {
        const end = new Date(now);
        end.setDate(end.getDate() + 1);
        end.setHours(23, 59, 59, 999);
        return end;
      }
      case "week":
        return new Date(now.getTime() + 7 * 24 * 60 * 60_000);
      default:
        return null;
    }
  })();

  const rows = await prisma.outing.findMany({
    where: {
      status: { in: ["open", "full"] },
      visibility: "public",
      endTime: { gte: now },
      ...(windowEnd ? { startTime: { lte: windowEnd } } : {}),
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.city ? { city: { contains: filters.city.toLowerCase() } } : {}),
      ...(filters.hereNowOnly ? { isHereNow: true } : {}),
      ...(filters.q
        ? {
            OR: [
              { title: { contains: filters.q } },
              { description: { contains: filters.q } },
              { locationName: { contains: filters.q } },
            ],
          }
        : {}),
      ...(blocked.size ? { creatorId: { notIn: Array.from(blocked) } } : {}),
    },
    include: {
      creator: { select: { id: true, name: true, image: true, verification: true } },
      participants: {
        include: { user: { select: { id: true, name: true, image: true } } },
      },
    },
    orderBy: { startTime: "asc" },
    take: 120,
  });

  const viewer = viewerId ? await prisma.user.findUnique({ where: { id: viewerId } }) : null;
  const viewerPoint = viewer?.homeCity ? await geocode(viewer.homeCity) : null;

  const cards: OutingCardData[] = [];

  for (const outing of rows) {
    const accepted = outing.participants.filter((p) => p.status === "accepted");
    const spotsLeft = Math.max(0, outing.capacity - accepted.length);
    const durationMinutes = Math.round(
      (outing.endTime.getTime() - outing.startTime.getTime()) / 60_000,
    );

    if (filters.minSpots && spotsLeft < filters.minSpots) continue;
    if (filters.maxDurationMinutes && durationMinutes > filters.maxDurationMinutes) continue;

    const dist = viewerPoint
      ? distanceKm(viewerPoint, { lat: outing.lat, lng: outing.lng })
      : null;
    if (filters.maxDistanceKm && dist !== null && dist > filters.maxDistanceKm) continue;

    const match = viewer
      ? scoreMatch(outing, { user: viewer, point: viewerPoint, now })
      : { score: 0, reasons: [] };

    const mine = viewerId ? outing.participants.find((p) => p.userId === viewerId) : undefined;
    const approx = coarsen({ lat: outing.lat, lng: outing.lng });

    cards.push({
      id: outing.id,
      title: outing.title,
      description: outing.description,
      category: outing.category,
      locationName: outing.locationName,
      city: outing.city,
      approxLat: approx.lat,
      approxLng: approx.lng,
      startTime: outing.startTime.toISOString(),
      endTime: outing.endTime.toISOString(),
      durationMinutes,
      capacity: outing.capacity,
      goingCount: accepted.length,
      spotsLeft,
      isHereNow: outing.isHereNow,
      status: outing.status,
      minAge: outing.minAge,
      maxAge: outing.maxAge,
      host: outing.creator,
      going: accepted.slice(0, 6).map((p) => p.user),
      matchScore: match.score,
      matchWhy: match.reasons,
      distanceKm: dist === null ? null : Number(dist.toFixed(1)),
      viewerStatus:
        outing.creatorId === viewerId
          ? "host"
          : mine?.status === "accepted"
            ? "accepted"
            : mine?.status === "pending"
              ? "pending"
              : mine?.status === "declined"
                ? "declined"
                : "none",
    });
  }

  const sort = filters.sort ?? (viewerId ? "match" : "soonest");
  cards.sort((a, b) => {
    if (sort === "popular") return b.goingCount - a.goingCount || cmpStart(a, b);
    if (sort === "match") return b.matchScore - a.matchScore || cmpStart(a, b);
    return cmpStart(a, b);
  });

  return cards;
}

function cmpStart(a: OutingCardData, b: OutingCardData): number {
  return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
}

// ---------------------------------------------------------- outing detail

export type OutingDetail = {
  card: OutingCardData;
  exactLat: number;
  exactLng: number;
  visibility: string;
  planId: string | null;
  requests: Array<{
    participantId: string;
    userId: string;
    name: string;
    image: string | null;
    verification: string;
    bio: string | null;
    interests: string[];
    matchScore: number;
    matchWhy: string[];
    message: string | null;
    outingsDone: number;
  }>;
  members: Array<{
    userId: string;
    name: string;
    image: string | null;
    role: string;
    verification: string;
  }>;
  chat: { conversationId: string; closed: boolean; expiresAt: string } | null;
  canChat: boolean;
  isBlockedHost: boolean;
};

export async function getOutingDetail(
  outingId: string,
  viewerId: string | null,
): Promise<OutingDetail | null> {
  await sweepExpired();

  const outing = await prisma.outing.findUnique({
    where: { id: outingId },
    include: {
      creator: { select: { id: true, name: true, image: true, verification: true } },
      conversation: true,
      participants: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
              verification: true,
              bio: true,
              interests: true,
              outingsDone: true,
            },
          },
        },
      },
    },
  });
  if (!outing) return null;

  const blocked = await blockedIdsFor(viewerId);
  if (blocked.has(outing.creatorId)) return null;
  const isBlockedHost = viewerId
    ? !!(await prisma.block.findUnique({
        where: { blockerId_blockedId: { blockerId: viewerId, blockedId: outing.creatorId } },
      }))
    : false;

  const accepted = outing.participants.filter((p) => p.status === "accepted");
  const pending = outing.participants.filter((p) => p.status === "pending");
  const mine = viewerId ? outing.participants.find((p) => p.userId === viewerId) : undefined;
  const isHost = outing.creatorId === viewerId;
  const durationMinutes = Math.round(
    (outing.endTime.getTime() - outing.startTime.getTime()) / 60_000,
  );

  const viewer = viewerId ? await prisma.user.findUnique({ where: { id: viewerId } }) : null;
  const viewerPoint = viewer?.homeCity ? await geocode(viewer.homeCity) : null;
  const match = viewer ? scoreMatch(outing, { user: viewer, point: viewerPoint }) : { score: 0, reasons: [] };
  const approx = coarsen({ lat: outing.lat, lng: outing.lng });

  const card: OutingCardData = {
    id: outing.id,
    title: outing.title,
    description: outing.description,
    category: outing.category,
    locationName: outing.locationName,
    city: outing.city,
    approxLat: approx.lat,
    approxLng: approx.lng,
    startTime: outing.startTime.toISOString(),
    endTime: outing.endTime.toISOString(),
    durationMinutes,
    capacity: outing.capacity,
    goingCount: accepted.length,
    spotsLeft: Math.max(0, outing.capacity - accepted.length),
    isHereNow: outing.isHereNow,
    status: outing.status,
    minAge: outing.minAge,
    maxAge: outing.maxAge,
    host: outing.creator,
    going: accepted.map((p) => ({ id: p.user.id, name: p.user.name, image: p.user.image })),
    matchScore: match.score,
    matchWhy: match.reasons,
    distanceKm: viewerPoint
      ? Number(distanceKm(viewerPoint, { lat: outing.lat, lng: outing.lng }).toFixed(1))
      : null,
    viewerStatus: isHost
      ? "host"
      : mine?.status === "accepted"
        ? "accepted"
        : mine?.status === "pending"
          ? "pending"
          : mine?.status === "declined"
            ? "declined"
            : "none",
  };

  const canChat =
    mine?.status === "accepted" &&
    !!outing.conversation &&
    !outing.conversation.closedAt &&
    ["open", "full"].includes(outing.status);

  return {
    card,
    exactLat: outing.lat,
    exactLng: outing.lng,
    visibility: outing.visibility,
    planId: outing.planId,
    requests: isHost
      ? pending.map((p) => ({
          participantId: p.id,
          userId: p.user.id,
          name: p.user.name,
          image: p.user.image,
          verification: p.user.verification,
          bio: p.user.bio,
          interests: parseStringList(p.user.interests),
          matchScore: p.matchScore,
          matchWhy: parseStringList(p.matchWhy),
          message: p.message,
          outingsDone: p.user.outingsDone,
        }))
      : [],
    members: accepted.map((p) => ({
      userId: p.user.id,
      name: p.user.name,
      image: p.user.image,
      role: p.role,
      verification: p.user.verification,
    })),
    chat: outing.conversation
      ? {
          conversationId: outing.conversation.id,
          closed: !!outing.conversation.closedAt,
          expiresAt: outing.conversation.expiresAt.toISOString(),
        }
      : null,
    canChat: !!canChat,
    isBlockedHost,
  };
}

// ------------------------------------------------------------------ chat

export type ChatMessage = {
  id: string;
  body: string;
  isSystem: boolean;
  createdAt: string;
  sender: { id: string; name: string; image: string | null } | null;
};

export async function listMessages(
  outingId: string,
  viewerId: string | null,
): Promise<{ authorised: boolean; closed: boolean; messages: ChatMessage[] }> {
  if (!viewerId) return { authorised: false, closed: false, messages: [] };

  const outing = await prisma.outing.findUnique({
    where: { id: outingId },
    include: {
      conversation: { select: { id: true, closedAt: true } },
      participants: { where: { userId: viewerId }, select: { status: true } },
    },
  });
  if (!outing?.conversation) return { authorised: false, closed: false, messages: [] };
  if (outing.participants[0]?.status !== "accepted") {
    return { authorised: false, closed: !!outing.conversation.closedAt, messages: [] };
  }

  const rows = await prisma.message.findMany({
    where: { conversationId: outing.conversation.id },
    orderBy: { createdAt: "asc" },
    take: 300,
    include: { sender: { select: { id: true, name: true, image: true } } },
  });

  return {
    authorised: true,
    closed: !!outing.conversation.closedAt,
    messages: rows.map((row) => ({
      id: row.id,
      body: row.body,
      isSystem: row.isSystem,
      createdAt: row.createdAt.toISOString(),
      sender: row.sender,
    })),
  };
}

export type ConversationSummary = {
  outingId: string;
  title: string;
  locationName: string;
  startTime: string;
  endTime: string;
  status: string;
  closed: boolean;
  memberCount: number;
  lastMessage: { body: string; createdAt: string; senderName: string | null } | null;
};

export async function listMyConversations(userId: string): Promise<ConversationSummary[]> {
  await sweepExpired();

  const rows = await prisma.outing.findMany({
    where: { participants: { some: { userId, status: "accepted" } } },
    include: {
      conversation: {
        include: {
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { sender: { select: { name: true } } },
          },
        },
      },
      participants: { where: { status: "accepted" }, select: { id: true } },
    },
    orderBy: { startTime: "desc" },
    take: 50,
  });

  return rows.map((outing) => {
    const last = outing.conversation?.messages[0];
    return {
      outingId: outing.id,
      title: outing.title,
      locationName: outing.locationName,
      startTime: outing.startTime.toISOString(),
      endTime: outing.endTime.toISOString(),
      status: outing.status,
      closed: !!outing.conversation?.closedAt,
      memberCount: outing.participants.length,
      lastMessage: last
        ? {
            body: last.body,
            createdAt: last.createdAt.toISOString(),
            senderName: last.sender?.name ?? null,
          }
        : null,
    };
  });
}

// ------------------------------------------------------------------ plans

export type PlanSummary = {
  id: string;
  title: string;
  location: string;
  startTime: string;
  durationMinutes: number;
  groupType: string;
  status: string;
  itemCount: number;
  costPerPerson: number;
  currency: string;
};

export async function listMyPlans(userId: string): Promise<PlanSummary[]> {
  const rows = await prisma.plan.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return rows.map((plan) => {
    const itinerary = readItinerary(plan.itinerary);
    return {
      id: plan.id,
      title: plan.title,
      location: plan.location,
      startTime: plan.startTime.toISOString(),
      durationMinutes: plan.durationMinutes,
      groupType: plan.groupType,
      status: plan.status,
      itemCount: itinerary?.totals.itemCount ?? 0,
      costPerPerson: itinerary?.totals.costPerPerson ?? 0,
      currency: itinerary?.totals.currency ?? "INR",
    };
  });
}

export type PlanDetail = {
  id: string;
  title: string;
  location: string;
  lat: number | null;
  lng: number | null;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  groupType: string;
  adults: number;
  children: number;
  budgetTier: string;
  budgetPerPerson: number | null;
  interests: string[];
  surpriseMe: boolean;
  notes: string | null;
  status: string;
  generator: string | null;
  itinerary: Itinerary | null;
  revisions: Array<{ id: string; instruction: string | null; summary: string | null; createdAt: string }>;
  /** Outings already spun off this plan, keyed by itinerary item id. */
  outingsByItem: Record<string, { id: string; goingCount: number; capacity: number; status: string }>;
};

export async function getPlanDetail(planId: string, userId: string): Promise<PlanDetail | null> {
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    include: {
      revisions: { orderBy: { createdAt: "desc" }, take: 12 },
      outings: {
        include: { participants: { where: { status: "accepted" }, select: { id: true } } },
      },
    },
  });
  if (!plan || plan.userId !== userId) return null;

  const outingsByItem: PlanDetail["outingsByItem"] = {};
  for (const outing of plan.outings) {
    if (!outing.planItemId) continue;
    outingsByItem[outing.planItemId] = {
      id: outing.id,
      goingCount: outing.participants.length,
      capacity: outing.capacity,
      status: outing.status,
    };
  }

  return {
    id: plan.id,
    title: plan.title,
    location: plan.location,
    lat: plan.lat,
    lng: plan.lng,
    startTime: plan.startTime.toISOString(),
    endTime: plan.endTime.toISOString(),
    durationMinutes: plan.durationMinutes,
    groupType: plan.groupType,
    adults: plan.adults,
    children: plan.children,
    budgetTier: plan.budgetTier,
    budgetPerPerson: plan.budgetPerPerson,
    interests: parseStringList(plan.interests),
    surpriseMe: plan.surpriseMe,
    notes: plan.notes,
    status: plan.status,
    generator: plan.generator,
    itinerary: readItinerary(plan.itinerary),
    revisions: plan.revisions.map((rev) => ({
      id: rev.id,
      instruction: rev.instruction,
      summary: rev.summary,
      createdAt: rev.createdAt.toISOString(),
    })),
    outingsByItem,
  };
}

// ---------------------------------------------------------------- profile

export type ProfileData = {
  id: string;
  name: string;
  image: string | null;
  bio: string | null;
  homeCity: string | null;
  age: number | null;
  interests: string[];
  verification: string;
  reputation: number;
  outingsDone: number;
  joinedAt: string;
  visitedPlaces: Array<{ id: string; name: string; city: string }>;
  hostedOutings: Array<{ id: string; title: string; startTime: string; category: string; status: string }>;
  isSelf: boolean;
  isBlocked: boolean;
};

export async function getProfile(
  profileId: string,
  viewerId: string | null,
): Promise<ProfileData | null> {
  const user = await prisma.user.findUnique({
    where: { id: profileId },
    include: {
      visitedPlaces: { orderBy: { createdAt: "desc" }, take: 12 },
      createdOutings: {
        where: { visibility: "public" },
        orderBy: { startTime: "desc" },
        take: 6,
        select: { id: true, title: true, startTime: true, category: true, status: true },
      },
    },
  });
  if (!user) return null;

  const isBlocked = viewerId
    ? !!(await prisma.block.findUnique({
        where: { blockerId_blockedId: { blockerId: viewerId, blockedId: profileId } },
      }))
    : false;

  return {
    id: user.id,
    name: user.name,
    image: user.image,
    bio: user.bio,
    homeCity: user.homeCity,
    age: user.birthYear ? new Date().getFullYear() - user.birthYear : null,
    interests: parseStringList(user.interests),
    verification: user.verification,
    reputation: user.reputation,
    outingsDone: user.outingsDone,
    joinedAt: user.createdAt.toISOString(),
    visitedPlaces: user.visitedPlaces.map((p) => ({ id: p.id, name: p.name, city: p.city })),
    hostedOutings: user.createdOutings.map((o) => ({
      id: o.id,
      title: o.title,
      startTime: o.startTime.toISOString(),
      category: o.category,
      status: o.status,
    })),
    isSelf: viewerId === profileId,
    isBlocked,
  };
}

export async function getProfileForEdit(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  return {
    name: user.name,
    bio: user.bio,
    homeCity: user.homeCity,
    birthYear: user.birthYear,
    interests: parseStringList(user.interests),
  };
}

// --------------------------------------------------------------- homepage

export type HomeFeed = {
  today: OutingCardData[];
  nearby: OutingCardData[];
  hereNow: OutingCardData[];
  popularPlaces: Array<{
    id: string;
    name: string;
    locationName: string;
    city: string;
    category: string;
    emoji: string;
    durationMinutes: number;
    costPerPerson: number;
    currency: string;
  }>;
};

export async function getHomeFeed(viewerId: string | null): Promise<HomeFeed> {
  const [all, activities] = await Promise.all([
    listOutings({ when: "week" }, viewerId),
    prisma.activity.findMany({ take: 60 }),
  ]);

  const viewer = viewerId ? await prisma.user.findUnique({ where: { id: viewerId } }) : null;
  const viewerPoint: GeoPoint | null = viewer?.homeCity ? await geocode(viewer.homeCity) : null;

  const now = Date.now();
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const interests = viewer ? parseStringList(viewer.interests) : [];
  const cityHint = viewer?.homeCity ? viewer.homeCity.toLowerCase() : null;

  const popular = activities
    .map((activity) => ({
      activity,
      rank:
        (interests.includes(activity.category) ? 2 : 0) +
        (cityHint && activity.city.includes(cityHint.split(/[ ,]/)[0]) ? 3 : 0) +
        (viewerPoint
          ? Math.max(0, 2 - distanceKm(viewerPoint, { lat: activity.lat, lng: activity.lng }) / 25)
          : 0),
    }))
    .sort((a, b) => b.rank - a.rank || a.activity.name.localeCompare(b.activity.name))
    .slice(0, 6)
    .map(({ activity }) => ({
      id: activity.id,
      name: activity.name,
      locationName: activity.locationName,
      city: activity.city,
      category: activity.category,
      emoji: activity.imageEmoji,
      durationMinutes: activity.durationMinutes,
      costPerPerson: activity.costPerPerson,
      currency: activity.currency,
    }));

  return {
    today: all
      .filter((o) => new Date(o.startTime).getTime() <= endOfToday.getTime())
      .slice(0, 6),
    nearby: all
      .filter((o) => o.distanceKm === null || o.distanceKm <= 40)
      .slice(0, 6),
    hereNow: all
      .filter((o) => o.isHereNow && new Date(o.endTime).getTime() > now)
      .slice(0, 6),
    popularPlaces: popular,
  };
}
