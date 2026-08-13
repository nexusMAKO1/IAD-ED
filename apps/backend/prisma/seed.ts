import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Initialisation de la base de données...');

  // 1. Créer le compte administrateur (idempotent)
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
  console.log(`Compte administrateur : ${admin.email} (rôle=${admin.role})`);

  // 2. Créer les campagnes par défaut (une par tranche d'âge)
  const campaignsData = [
    { name: 'Campagne Enfant',        age: 'child',       url: 'https://picsum.photos/seed/child/1920/1080' },
    { name: 'Campagne Adolescent',    age: 'teen',        url: 'https://picsum.photos/seed/teen/1920/1080' },
    { name: 'Campagne Jeune Adulte',  age: 'young_adult', url: 'https://picsum.photos/seed/ya/1920/1080' },
    { name: 'Campagne Adulte',        age: 'adult',       url: 'https://picsum.photos/seed/adult/1920/1080' },
    { name: 'Campagne Adulte Senior', age: 'middle_aged', url: 'https://picsum.photos/seed/ma/1920/1080' },
    { name: 'Campagne Senior',        age: 'senior',      url: 'https://picsum.photos/seed/senior/1920/1080' },
  ];

  for (const c of campaignsData) {
    const existing = await prisma.campaign.findFirst({ where: { name: c.name } });
    if (!existing) {
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
      console.log(`Campagne créée : ${campaign.name}`);
    } else {
      console.log(`Campagne déjà existante : ${c.name}`);
    }
  }

  console.log('Initialisation terminée.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
