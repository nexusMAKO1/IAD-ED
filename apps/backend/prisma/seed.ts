import { PrismaClient, DeviceType, DeviceStatus, UserRole, TicketStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seeding...');

  // 1. Clean up existing data to ensure repeatability
  console.log('Cleaning up existing data...');
  await prisma.audienceEvent.deleteMany({});
  await prisma.ticket.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.device.deleteMany({});
  await prisma.site.deleteMany({});
  await prisma.campaign.deleteMany({});
  await prisma.mLModel.deleteMany({});

  // 2. Seed 1 Site
  console.log('Seeding sites...');
  const site = await prisma.site.create({
    data: {
      name: 'Express Display HQ',
      address: '10 Rue de la Paix, 75002 Paris, France',
    },
  });
  console.log(`Created site: ${site.name} (${site.id})`);

  // 3. Seed 2 Devices
  console.log('Seeding devices...');
  const device1 = await prisma.device.create({
    data: {
      siteId: site.id,
      type: DeviceType.KIOSK,
      status: DeviceStatus.ONLINE,
    },
  });
  const device2 = await prisma.device.create({
    data: {
      siteId: site.id,
      type: DeviceType.CAMERA,
      status: DeviceStatus.ONLINE,
    },
  });
  console.log(`Created devices: ${device1.type} (${device1.id}), ${device2.type} (${device2.id})`);

  // 4. Seed 1 Admin User (with secure password hashing)
  console.log('Seeding admin user...');
  const saltRounds = 12;
  const hashedPassword = await bcrypt.hash('AdminSecurePassword123!', saltRounds);
  const admin = await prisma.user.create({
    data: {
      email: 'admin@expressdisplay.com',
      password: hashedPassword,
      role: UserRole.ADMIN,
      siteId: site.id,
    },
  });
  console.log(`Created admin user: ${admin.email}`);

  // 5. Seed 3 Campaigns
  console.log('Seeding campaigns...');
  const campaign1 = await prisma.campaign.create({
    data: {
      name: 'Summer Sale Promotion',
      mediaUrl: 'https://cdn.expressdisplay.com/media/summer_sale_2026.mp4',
      targetAudience: {
        age_groups: ['young_adult', 'adult'],
        genders: ['male', 'female', 'unknown'],
      },
      priority: 'high',
      active: true,
    },
  });
  const campaign2 = await prisma.campaign.create({
    data: {
      name: 'VIP Queue Fast Pass',
      mediaUrl: 'https://cdn.expressdisplay.com/media/fast_pass_info.mp4',
      targetAudience: {
        age_groups: ['adult', 'senior'],
        genders: ['male', 'female'],
      },
      priority: 'critical',
      active: true,
    },
  });
  const campaign3 = await prisma.campaign.create({
    data: {
      name: 'Kids Play Zone Advertisement',
      mediaUrl: 'https://cdn.expressdisplay.com/media/kids_zone.mp4',
      targetAudience: {
        age_groups: ['child'],
        genders: ['male', 'female', 'unknown'],
      },
      priority: 'standard',
      active: false,
    },
  });
  console.log('Created campaigns');

  // 6. Seed 10 Tickets
  console.log('Seeding tickets...');
  const ticketStatuses = [
    TicketStatus.DONE,
    TicketStatus.DONE,
    TicketStatus.DONE,
    TicketStatus.DONE,
    TicketStatus.DONE,
    TicketStatus.IN_PROGRESS,
    TicketStatus.WAITING,
    TicketStatus.WAITING,
    TicketStatus.WAITING,
    TicketStatus.CANCELLED,
  ];

  const now = new Date();
  for (let i = 0; i < 10; i++) {
    const status = ticketStatuses[i];
    const createdAt = new Date(now.getTime() - (10 - i) * 15 * 60 * 1000); // 15 mins intervals
    let calledAt: Date | null = null;
    let finishedAt: Date | null = null;

    if (status === TicketStatus.DONE || status === TicketStatus.IN_PROGRESS) {
      calledAt = new Date(createdAt.getTime() + 8 * 60 * 1000); // Called after 8 mins
    }
    if (status === TicketStatus.DONE) {
      finishedAt = new Date(calledAt!.getTime() + 12 * 60 * 1000); // Finished after 12 mins
    }

    await prisma.ticket.create({
      data: {
        siteId: site.id,
        ticketNumber: `A-10${i + 1}`,
        serviceType: i % 2 === 0 ? 'billing' : 'consultation',
        status,
        createdAt,
        calledAt,
        finishedAt,
        estimatedWaitMinutes: 10 + i * 2,
      },
    });
  }
  console.log('Created 10 tickets');

  // 7. Seed 100 AudienceEvent occurrences
  console.log('Seeding 100 audience events...');
  const audienceEventsData: any[] = [];

  for (let i = 0; i < 100; i++) {
    const timestamp = new Date(now.getTime() - i * 14 * 60 * 1000); // ~14 mins interval
    const peopleCount = Math.floor(Math.random() * 5) + 1; // 1 to 5 people
    const youngCount = Math.floor(Math.random() * (peopleCount + 1));
    const adultCount = Math.floor(Math.random() * (peopleCount - youngCount + 1));
    const seniorCount = peopleCount - youngCount - adultCount;

    audienceEventsData.push({
      siteId: site.id,
      deviceId: device2.id, // CAMERA device
      timestamp,
      peopleCount,
      densityScore: parseFloat((Math.random() * 0.8 + 0.1).toFixed(2)),
      avgDwellTime: parseFloat((Math.random() * 30 + 5).toFixed(1)),
      youngCount,
      adultCount,
      seniorCount,
    });
  }

  // Use createMany to insert efficiently
  await prisma.audienceEvent.createMany({
    data: audienceEventsData,
  });
  console.log('Created 100 audience events');

  // 8. Seed MLModels
  console.log('Seeding MLModels...');
  await prisma.mLModel.create({
    data: {
      type: 'IAD',
      version: 'v1.0.0',
      mae: 0.12,
      active: true,
    },
  });
  await prisma.mLModel.create({
    data: {
      type: 'SMARTQUEUE',
      version: 'v1.2.0',
      mae: 45.5,
      active: true,
    },
  });

  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
