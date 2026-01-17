import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Default tier configurations (migrated from MACHINE_TIERS constant)
const MACHINE_TIERS = [
  {
    tier: 1,
    name: 'RUSTY LEVER',
    emoji: '🟤',
    price: 10,
    lifespanDays: 7,
    yieldPercent: 135,
    imageUrl: '/machines/tier-1.png',
  },
  {
    tier: 2,
    name: 'LUCKY CHERRY',
    emoji: '🟠',
    price: 30,
    lifespanDays: 10,
    yieldPercent: 150,
    imageUrl: '/machines/tier-2.png',
  },
  {
    tier: 3,
    name: 'GOLDEN 7s',
    emoji: '🟡',
    price: 80,
    lifespanDays: 14,
    yieldPercent: 170,
    imageUrl: '/machines/tier-3.png',
  },
  {
    tier: 4,
    name: 'NEON NIGHTS',
    emoji: '🟢',
    price: 220,
    lifespanDays: 18,
    yieldPercent: 190,
    imageUrl: '/machines/tier-4.png',
  },
  {
    tier: 5,
    name: 'DIAMOND DASH',
    emoji: '🔵',
    price: 600,
    lifespanDays: 22,
    yieldPercent: 210,
    imageUrl: '/machines/tier-5.png',
  },
  {
    tier: 6,
    name: 'VEGAS QUEEN',
    emoji: '🟣',
    price: 1800,
    lifespanDays: 27,
    yieldPercent: 235,
    imageUrl: '/machines/tier-6.png',
  },
  {
    tier: 7,
    name: 'PLATINUM RUSH',
    emoji: '⚪',
    price: 5500,
    lifespanDays: 32,
    yieldPercent: 260,
    imageUrl: '/machines/tier-7.png',
  },
  {
    tier: 8,
    name: 'HIGH ROLLER',
    emoji: '🔴',
    price: 18000,
    lifespanDays: 37,
    yieldPercent: 285,
    imageUrl: '/machines/tier-8.png',
  },
  {
    tier: 9,
    name: 'JACKPOT EMPEROR',
    emoji: '⚫',
    price: 60000,
    lifespanDays: 42,
    yieldPercent: 310,
    imageUrl: '/machines/tier-9.png',
  },
  {
    tier: 10,
    name: 'FORTUNE KING',
    emoji: '👑',
    price: 200000,
    lifespanDays: 48,
    yieldPercent: 340,
    imageUrl: '/machines/tier-10.png',
  },
];

async function seedTiers() {
  console.log('Seeding tier configs...');

  const existingTiers = await prisma.tierConfig.count();
  if (existingTiers > 0) {
    console.log(`Tiers already exist (${existingTiers}), skipping seed.`);
    return;
  }

  await prisma.tierConfig.createMany({
    data: MACHINE_TIERS.map((t) => ({
      tier: t.tier,
      name: t.name,
      emoji: t.emoji,
      price: t.price,
      lifespanDays: t.lifespanDays,
      yieldPercent: t.yieldPercent,
      imageUrl: t.imageUrl,
      isVisible: true,
      isPubliclyAvailable: t.tier === 1, // Only tier 1 available without progression
      sortOrder: t.tier,
    })),
  });

  console.log(`Created ${MACHINE_TIERS.length} tier configs.`);
}

async function seedSystemSettings() {
  console.log('Seeding system settings...');

  const existing = await prisma.systemSettings.findUnique({
    where: { id: 'default' },
  });

  if (existing) {
    console.log('System settings already exist, skipping seed.');
    return;
  }

  await prisma.systemSettings.create({
    data: {
      id: 'default',
      maxGlobalTier: 1,
      // All other fields have defaults in schema
    },
  });

  console.log('Created default system settings.');
}

async function main() {
  console.log('Starting seed...');

  await seedTiers();
  await seedSystemSettings();

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
