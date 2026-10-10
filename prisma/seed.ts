/* eslint-disable no-console */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ACTIVITIES } from "./activities";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "planadate123";

type SeedUser = {
  email: string;
  name: string;
  bio: string;
  homeCity: string;
  birthYear: number;
  interests: string[];
  verification: string;
  reputation: number;
  outingsDone: number;
  visited: Array<{ name: string; city: string }>;
};

const USERS: SeedUser[] = [
  {
    email: "meera@planadate.demo",
    name: "Meera Nair",
    bio: "Kochi-based architect. I will get up at 5am for a good sunrise and a bad cup of chai.",
    homeCity: "Kochi",
    birthYear: 1995,
    interests: ["photography", "hiking", "cafes", "history", "hidden_gems"],
    verification: "id_verified",
    reputation: 42,
    outingsDone: 14,
    visited: [
      { name: "Kolukkumalai", city: "Munnar" },
      { name: "Fort Kochi", city: "Kochi" },
    ],
  },
  {
    email: "arjun@planadate.demo",
    name: "Arjun Menon",
    bio: "Plays badminton four nights a week. Always short two people.",
    homeCity: "Kochi",
    birthYear: 1997,
    interests: ["sports", "food", "nightlife", "entertainment"],
    verification: "email",
    reputation: 31,
    outingsDone: 22,
    visited: [{ name: "Kaloor Indoor Stadium", city: "Kochi" }],
  },
  {
    email: "sana@planadate.demo",
    name: "Sana Rahim",
    bio: "Surf-obsessed. Varkala most weekends, Kochi during the week.",
    homeCity: "Varkala",
    birthYear: 1999,
    interests: ["beaches", "adventure", "sports", "relaxation"],
    verification: "id_verified",
    reputation: 55,
    outingsDone: 31,
    visited: [
      { name: "Papanasam Beach", city: "Varkala" },
      { name: "Kappil Beach", city: "Varkala" },
    ],
  },
  {
    email: "dev@planadate.demo",
    name: "Dev Prakash",
    bio: "Cyclist and slow-food evangelist. I know where the good toddy shops are.",
    homeCity: "Kochi",
    birthYear: 1991,
    interests: ["cycling", "food", "local_experiences", "nature"],
    verification: "email",
    reputation: 27,
    outingsDone: 9,
    visited: [{ name: "Vypin", city: "Kochi" }],
  },
  {
    email: "priya@planadate.demo",
    name: "Priya Iyer",
    bio: "Weekend trekker, weekday spreadsheet person. Two kids, both faster than me uphill.",
    homeCity: "Ernakulam",
    birthYear: 1988,
    interests: ["hiking", "nature", "kids", "relaxation"],
    verification: "email",
    reputation: 38,
    outingsDone: 11,
    visited: [{ name: "Eravikulam National Park", city: "Munnar" }],
  },
  {
    email: "tom@planadate.demo",
    name: "Tom Varghese",
    bio: "Film photographer. Happy to walk 12km if the light is right.",
    homeCity: "Kochi",
    birthYear: 1993,
    interests: ["photography", "art_culture", "history", "cafes"],
    verification: "none",
    reputation: 12,
    outingsDone: 4,
    visited: [],
  },
  {
    email: "lakshmi@planadate.demo",
    name: "Lakshmi Pillai",
    bio: "Munnar homestay host. I'll tell you which viewpoints are worth it and which are car parks.",
    homeCity: "Munnar",
    birthYear: 1985,
    interests: ["nature", "food", "local_experiences", "hiking"],
    verification: "id_verified",
    reputation: 64,
    outingsDone: 47,
    visited: [{ name: "Chokramudi", city: "Munnar" }],
  },
  {
    email: "rahul@planadate.demo",
    name: "Rahul Das",
    bio: "New in Kochi, no friends here yet, extremely up for anything.",
    homeCity: "Kochi",
    birthYear: 2000,
    interests: ["food", "nightlife", "adventure", "sports", "beaches"],
    verification: "email",
    reputation: 8,
    outingsDone: 2,
    visited: [],
  },
];

function at(hoursFromNow: number, minutes = 0): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setTime(d.getTime() + hoursFromNow * 3_600_000 + minutes * 60_000);
  return d;
}

function atClock(daysFromNow: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, minute, 0, 0);
  return d;
}

type SeedOuting = {
  key: string;
  creator: string;
  title: string;
  description: string;
  category: string;
  locationName: string;
  city: string;
  lat: number;
  lng: number;
  startTime: Date;
  endTime: Date;
  capacity: number;
  minAge?: number;
  maxAge?: number;
  isHereNow?: boolean;
  accepted?: string[];
  pending?: string[];
  chat?: Array<{ from: string | null; body: string; minutesAgo: number }>;
};

const OUTINGS: SeedOuting[] = [
  {
    key: "volleyball-varkala",
    creator: "sana@planadate.demo",
    title: "Beach volleyball at Papanasam",
    description:
      "Net's already up. Need 3 more to make two proper sides. Total beginners welcome, we rotate every game.",
    category: "sports",
    locationName: "Papanasam Beach, Varkala",
    city: "varkala",
    lat: 8.7331,
    lng: 76.7047,
    startTime: at(2),
    endTime: at(4),
    capacity: 8,
    isHereNow: true,
    accepted: ["rahul@planadate.demo", "tom@planadate.demo"],
    pending: ["arjun@planadate.demo"],
    chat: [
      { from: null, body: "Sana Rahim created this activity.", minutesAgo: 95 },
      { from: "sana@planadate.demo", body: "I'm by the lifeguard tower in a yellow shirt 🟡", minutesAgo: 80 },
      { from: "rahul@planadate.demo", body: "20 min away, first time playing so be gentle", minutesAgo: 62 },
      { from: "sana@planadate.demo", body: "Perfect, we'll put you on my side", minutesAgo: 55 },
    ],
  },
  {
    key: "sunset-trek-munnar",
    creator: "lakshmi@planadate.demo",
    title: "Sunset trek up Chokramudi shoulder",
    description:
      "Moderate 3km climb, wide valley view at the top. I do this most weeks -- bring a head torch for coming down.",
    category: "hiking",
    locationName: "Chokramudi trailhead, Munnar",
    city: "munnar",
    lat: 10.0947,
    lng: 77.1372,
    startTime: atClock(0, 16),
    endTime: atClock(0, 19),
    capacity: 6,
    minAge: 16,
    accepted: ["meera@planadate.demo", "priya@planadate.demo"],
    pending: [],
    chat: [
      { from: null, body: "Lakshmi Pillai created this activity.", minutesAgo: 300 },
      { from: "lakshmi@planadate.demo", body: "Meeting at the tea shop by the trailhead at 3:50.", minutesAgo: 280 },
      { from: "meera@planadate.demo", body: "Bringing a camera, might be slow on the way up 📷", minutesAgo: 200 },
    ],
  },
  {
    key: "cafe-meetup-kochi",
    creator: "tom@planadate.demo",
    title: "Coffee and a Fort Kochi wander",
    description: "Kashi Art Cafe first, then whichever lanes look good. No fixed route, no rush.",
    category: "cafes",
    locationName: "Kashi Art Cafe, Fort Kochi",
    city: "kochi",
    lat: 9.9655,
    lng: 76.2431,
    startTime: atClock(0, 16, 30),
    endTime: atClock(0, 19),
    capacity: 4,
    accepted: ["dev@planadate.demo"],
    pending: ["meera@planadate.demo"],
    chat: [
      { from: null, body: "Tom Varghese created this activity.", minutesAgo: 420 },
      { from: "dev@planadate.demo", body: "In. I'll be the one with the bicycle.", minutesAgo: 390 },
    ],
  },
  {
    key: "badminton-kochi",
    creator: "arjun@planadate.demo",
    title: "Badminton doubles — need 2",
    description: "Court booked 7-8:30pm at Kaloor. Spare rackets available. Intermediate-ish rallies.",
    category: "sports",
    locationName: "Kaloor Indoor Stadium, Kochi",
    city: "kochi",
    lat: 9.9989,
    lng: 76.2947,
    startTime: atClock(0, 19),
    endTime: atClock(0, 20, 30),
    capacity: 4,
    accepted: ["rahul@planadate.demo"],
    pending: ["dev@planadate.demo"],
    chat: [
      { from: null, body: "Arjun Menon created this activity.", minutesAgo: 500 },
      { from: "arjun@planadate.demo", body: "Court 3. Non-marking shoes only, they're strict about it.", minutesAgo: 480 },
    ],
  },
  {
    key: "sunrise-cycle-kochi",
    creator: "dev@planadate.demo",
    title: "6am Vypin island cycle",
    description:
      "Flat 18km through village roads and a ferry crossing. Cycles can be hired at the terminal if you don't have one.",
    category: "cycling",
    locationName: "Vypin Ferry Terminal, Kochi",
    city: "kochi",
    lat: 9.9744,
    lng: 76.2436,
    startTime: atClock(1, 6),
    endTime: atClock(1, 9),
    capacity: 6,
    accepted: ["meera@planadate.demo"],
    pending: [],
    chat: [{ from: null, body: "Dev Prakash created this activity.", minutesAgo: 600 }],
  },
  {
    key: "street-food-kochi",
    creator: "rahul@planadate.demo",
    title: "Broadway street food crawl",
    description:
      "Four stops, roughly ₹350 a head. I'm new here and want to eat everything, so bring opinions.",
    category: "food",
    locationName: "Broadway, Ernakulam",
    city: "kochi",
    lat: 9.9757,
    lng: 76.2837,
    startTime: atClock(1, 18, 30),
    endTime: atClock(1, 20, 30),
    capacity: 6,
    accepted: ["arjun@planadate.demo", "tom@planadate.demo"],
    pending: [],
    chat: [{ from: null, body: "Rahul Das created this activity.", minutesAgo: 240 }],
  },
  {
    key: "weekend-trek-wayanad",
    creator: "meera@planadate.demo",
    title: "Weekend trek — Edakkal and Soochipara",
    description:
      "Saturday: Edakkal caves early, falls in the afternoon. Sharing a cab from Kochi, splitting fuel.",
    category: "hiking",
    locationName: "Ambukuthi Mala, Wayanad",
    city: "wayanad",
    lat: 11.6244,
    lng: 76.2483,
    startTime: atClock(daysUntilSaturday(), 7),
    endTime: atClock(daysUntilSaturday(), 17),
    capacity: 7,
    minAge: 18,
    accepted: ["priya@planadate.demo", "dev@planadate.demo", "sana@planadate.demo"],
    pending: ["rahul@planadate.demo"],
    chat: [
      { from: null, body: "Meera Nair created this activity.", minutesAgo: 1400 },
      { from: "meera@planadate.demo", body: "Cab leaves Kaloor at 4am sharp. Two seats left.", minutesAgo: 1300 },
      { from: "priya@planadate.demo", body: "In for both seats — bringing my sister.", minutesAgo: 1200 },
    ],
  },
  {
    key: "photo-walk-kochi",
    creator: "tom@planadate.demo",
    title: "Golden hour photo walk, Mattancherry",
    description: "Spice warehouses and painted doors. Any camera, phones absolutely fine.",
    category: "photography",
    locationName: "Jew Town, Mattancherry",
    city: "kochi",
    lat: 9.9578,
    lng: 76.2593,
    startTime: atClock(2, 16, 30),
    endTime: atClock(2, 18, 30),
    capacity: 5,
    accepted: [],
    pending: ["meera@planadate.demo"],
    chat: [{ from: null, body: "Tom Varghese created this activity.", minutesAgo: 120 }],
  },
  {
    key: "here-now-coffee-kochi",
    creator: "rahul@planadate.demo",
    title: "At Marine Drive, anyone up for coffee?",
    description: "Free for the next couple of hours. Sitting near the Rainbow Bridge end.",
    category: "cafes",
    locationName: "Marine Drive, Ernakulam",
    city: "kochi",
    lat: 9.9793,
    lng: 76.2761,
    startTime: at(0, 15),
    endTime: at(2, 15),
    capacity: 4,
    isHereNow: true,
    accepted: [],
    pending: [],
    chat: [{ from: null, body: "Rahul Das created this activity.", minutesAgo: 10 }],
  },
  {
    key: "here-now-sunset-varkala",
    creator: "sana@planadate.demo",
    title: "Watching sunset from North Cliff",
    description: "Grabbing a spot on the cliff about an hour before sundown. Come say hi.",
    category: "nature",
    locationName: "North Cliff, Varkala",
    city: "varkala",
    lat: 8.7379,
    lng: 76.7063,
    startTime: at(3),
    endTime: at(5),
    capacity: 6,
    isHereNow: true,
    accepted: ["tom@planadate.demo"],
    pending: [],
    chat: [{ from: null, body: "Sana Rahim created this activity.", minutesAgo: 25 }],
  },
  {
    key: "houseboat-alleppey",
    creator: "priya@planadate.demo",
    title: "Sharing a day houseboat in Alleppey",
    description:
      "Boat holds 8, we're 4 (2 adults, 2 kids). Splitting the cost four more ways makes it cheap for everyone.",
    category: "relaxation",
    locationName: "Finishing Point, Alleppey",
    city: "alleppey",
    lat: 9.4924,
    lng: 76.3413,
    startTime: atClock(daysUntilSaturday() + 1, 11),
    endTime: atClock(daysUntilSaturday() + 1, 17),
    capacity: 8,
    accepted: ["lakshmi@planadate.demo"],
    pending: [],
    chat: [{ from: null, body: "Priya Iyer created this activity.", minutesAgo: 900 }],
  },
];

function daysUntilSaturday(): number {
  const today = new Date().getDay();
  const diff = (6 - today + 7) % 7;
  return diff === 0 ? 7 : diff;
}

async function main() {
  console.log("Seeding Planadate…");

  await prisma.$transaction([
    prisma.message.deleteMany(),
    prisma.conversation.deleteMany(),
    prisma.outingParticipant.deleteMany(),
    prisma.report.deleteMany(),
    prisma.outing.deleteMany(),
    prisma.planRevision.deleteMany(),
    prisma.plan.deleteMany(),
    prisma.visitedPlace.deleteMany(),
    prisma.block.deleteMany(),
    prisma.activity.deleteMany(),
    prisma.session.deleteMany(),
    prisma.account.deleteMany(),
    prisma.user.deleteMany({ where: { isDemo: true } }),
  ]);

  for (const activity of ACTIVITIES) {
    await prisma.activity.create({
      data: {
        slug: activity.slug,
        name: activity.name,
        description: activity.description,
        city: activity.city,
        locationName: activity.locationName,
        lat: activity.lat,
        lng: activity.lng,
        category: activity.category,
        tags: JSON.stringify(activity.tags),
        durationMinutes: activity.durationMinutes,
        costPerPerson: activity.costPerPerson,
        suitableFor: JSON.stringify(activity.suitableFor),
        kidFriendly: activity.kidFriendly ?? false,
        indoor: activity.indoor ?? false,
        bestTimes: JSON.stringify(activity.bestTimes ?? ["any"]),
        openFrom: activity.openFrom ?? 0,
        openTo: activity.openTo ?? 1440,
        bookingRequired: activity.bookingRequired ?? false,
        tips: activity.tips ?? null,
        imageEmoji: activity.imageEmoji ?? "📍",
      },
    });
  }
  console.log(`  ${ACTIVITIES.length} activities`);

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const userIds = new Map<string, string>();

  for (const user of USERS) {
    const created = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        bio: user.bio,
        homeCity: user.homeCity,
        birthYear: user.birthYear,
        interests: JSON.stringify(user.interests),
        verification: user.verification,
        reputation: user.reputation,
        outingsDone: user.outingsDone,
        passwordHash,
        isDemo: true,
      },
      create: {
        email: user.email,
        name: user.name,
        bio: user.bio,
        homeCity: user.homeCity,
        birthYear: user.birthYear,
        interests: JSON.stringify(user.interests),
        verification: user.verification,
        reputation: user.reputation,
        outingsDone: user.outingsDone,
        passwordHash,
        isDemo: true,
      },
    });
    userIds.set(user.email, created.id);

    for (const place of user.visited) {
      await prisma.visitedPlace.create({
        data: { userId: created.id, name: place.name, city: place.city },
      });
    }
  }
  console.log(`  ${USERS.length} demo users (password: ${DEMO_PASSWORD})`);

  for (const seed of OUTINGS) {
    const creatorId = userIds.get(seed.creator)!;
    const outing = await prisma.outing.create({
      data: {
        creatorId,
        title: seed.title,
        description: seed.description,
        category: seed.category,
        locationName: seed.locationName,
        city: seed.city,
        lat: seed.lat,
        lng: seed.lng,
        startTime: seed.startTime,
        endTime: seed.endTime,
        capacity: seed.capacity,
        minAge: seed.minAge ?? null,
        maxAge: seed.maxAge ?? null,
        isHereNow: seed.isHereNow ?? false,
        expiresAt: seed.endTime,
        status: "open",
        participants: {
          create: [
            { userId: creatorId, role: "host", status: "accepted", matchScore: 100 },
            ...(seed.accepted ?? []).map((email) => ({
              userId: userIds.get(email)!,
              role: "member",
              status: "accepted",
              matchScore: 70 + Math.floor(Math.random() * 25),
            })),
            ...(seed.pending ?? []).map((email) => ({
              userId: userIds.get(email)!,
              role: "member",
              status: "pending",
              matchScore: 60 + Math.floor(Math.random() * 30),
              message: "Would love to join if there's room!",
            })),
          ],
        },
        conversation: { create: { expiresAt: seed.endTime } },
      },
      include: { conversation: true },
    });

    if (outing.conversation && seed.chat) {
      for (const message of seed.chat) {
        await prisma.message.create({
          data: {
            conversationId: outing.conversation.id,
            senderId: message.from ? userIds.get(message.from)! : null,
            isSystem: message.from === null,
            body: message.body,
            createdAt: new Date(Date.now() - message.minutesAgo * 60_000),
          },
        });
      }
    }

    const acceptedCount = 1 + (seed.accepted?.length ?? 0);
    if (acceptedCount >= seed.capacity) {
      await prisma.outing.update({ where: { id: outing.id }, data: { status: "full" } });
    }
  }
  console.log(`  ${OUTINGS.length} outings with participants and chat`);

  console.log("\nDone. Sign in with any demo email, e.g.:");
  console.log(`  meera@planadate.demo / ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
