import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with test data...');

  // UUID used in Edge-CV configuration
  const siteId = '123e4567-e89b-12d3-a456-426614174000';
  const deviceId = '123e4567-e89b-12d3-a456-426614174000';

  // 0. Create Admin User (idempotent)
  const adminPassword = await bcrypt.hash('Admin1234!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@expressdisplay.com' },
    update: { password: adminPassword },
    create: {
      email: 'admin@expressdisplay.com',
      password: adminPassword,
      role: 'ADMIN',
    },
  });
  console.log(`Admin user: ${admin.email} (role=${admin.role})`);

  // 1. Create Site
  const site = await prisma.site.upsert({
    where: { id: siteId },
    update: {},
    create: {
      id: siteId,
      name: 'Express Display Test Site',
      address: '1 Test Street, Test City',
    },
  });
  console.log(`Site created: ${site.name}`);

  // 2. Create Device
  const device = await prisma.device.upsert({
    where: { id: deviceId },
    update: { status: 'ONLINE' },
    create: {
      id: deviceId,
      siteId: site.id,
      name: 'Edge-CV Test Camera',
      type: 'CAMERA',
      status: 'ONLINE',
      ipAddress: '127.0.0.1',
    },
  });
  console.log(`Device created: ${device.name}`);

  // Clear existing campaigns
  await prisma.campaign.deleteMany();

  // 3. Create active Campaigns for all age groups
  const campaignsData = [
    { name: 'Child Campaign', age: 'child', url: 'https://picsum.photos/seed/child/1920/1080' },
    { name: 'Teen Campaign', age: 'teen', url: 'https://picsum.photos/seed/teen/1920/1080' },
    { name: 'Young Adult Campaign', age: 'young_adult', url: 'https://picsum.photos/seed/ya/1920/1080' },
    { name: 'Adult Campaign', age: 'adult', url: 'https://picsum.photos/seed/adult/1920/1080' },
    { name: 'Middle-aged Campaign', age: 'middle_aged', url: 'https://picsum.photos/seed/ma/1920/1080' },
    { name: 'Senior Campaign', age: 'senior', url: 'https://picsum.photos/seed/senior/1920/1080' },
  ];

  for (const c of campaignsData) {
    const campaign = await prisma.campaign.create({
      data: {
        name: c.name,
        mediaUrl: c.url,
        mediaType: 'image',
        duration: 15,
        targetAudience: { age_group: c.age },
        priority: 'high',
        active: true,
        enabled: true,
        targetAge: c.age,
      },
    });
    console.log(`Campaign created: ${campaign.name} targeting ${campaign.targetAge}`);
  }

  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
