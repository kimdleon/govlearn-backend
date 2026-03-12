import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

async function main() {
  console.log('🌱 Seeding database...');

  // Clear existing users (optional - comment out to keep existing data)
  // await db.user.deleteMany();

  const hashedPassword = await hashPassword('admin123');

  // Create admin user
  const adminUser = await db.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Admin User',
      password: hashedPassword,
      role: 'ADMIN',
      emailVerified: true,
    },
  });

  console.log('✓ Created admin user:', adminUser.email);

  // Create instructor user
  const instructorUser = await db.user.upsert({
    where: { email: 'instructor@example.com' },
    update: {},
    create: {
      email: 'instructor@example.com',
      name: 'Instructor User',
      password: hashedPassword,
      role: 'INSTRUCTOR',
      emailVerified: true,
    },
  });

  console.log('✓ Created instructor user:', instructorUser.email);

  // Create manager user
  const managerUser = await db.user.upsert({
    where: { email: 'manager@example.com' },
    update: {},
    create: {
      email: 'manager@example.com',
      name: 'Manager User',
      password: hashedPassword,
      role: 'MANAGER',
      emailVerified: true,
    },
  });

  console.log('✓ Created manager user:', managerUser.email);

  // Create learner users
  const learners = [
    { email: 'learner@example.com', name: 'Learner User' },
    { email: 'john@example.com', name: 'John Doe' },
    { email: 'jane@example.com', name: 'Jane Smith' },
    { email: 'bob@example.com', name: 'Bob Johnson' },
  ];

  for (const learner of learners) {
    const user = await db.user.upsert({
      where: { email: learner.email },
      update: {},
      create: {
        email: learner.email,
        name: learner.name,
        password: hashedPassword,
        role: 'LEARNER',
        emailVerified: true,
      },
    });
    console.log(`✓ Created learner user: ${user.email}`);
  }

  console.log('✅ Users seeding complete!');

  // Create test speakers
  const speaker1 = await db.speaker.create({
    data: {
      name: 'Dr. Sarah Johnson',
      email: 'speaker1@example.com',
      bio: 'Expert in digital transformation and cloud technologies',
      credentials: 'PhD in Computer Science, 15+ years experience',
      photoUrl: 'https://via.placeholder.com/150',
      company: 'Tech Innovations Inc.',
      jobRole: 'Chief Technology Officer',
    },
  });

  const speaker2 = await db.speaker.create({
    data: {
      name: 'Prof. Michael Chen',
      email: 'speaker2@example.com',
      bio: 'Leading expert in artificial intelligence and machine learning',
      credentials: 'PhD in AI, Author of 3 bestselling books',
      photoUrl: 'https://via.placeholder.com/150',
      company: 'AI Research Labs',
      jobRole: 'Research Director',
    },
  });

  console.log('✓ Created speakers');

  // Create test webinars
  const webinar1 = await db.webinar.upsert({
    where: { slug: 'future-of-cloud-computing' },
    update: {},
    create: {
      slug: 'future-of-cloud-computing',
      title: 'Future of Cloud Computing',
      outline: 'Explore the latest trends and innovations in cloud computing technology',
      sessionDate: new Date('2026-04-15T10:00:00Z'),
      durationMins: 60,
      status: 'published',
      price: 0,
      certificatePrice: 0,
      priceType: 'ALWAYS_FREE',
      speakers: {
        connect: [{ id: speaker1.id }],
      },
    },
  });

  const webinar2 = await db.webinar.upsert({
    where: { slug: 'ai-in-enterprise-applications' },
    update: {},
    create: {
      slug: 'ai-in-enterprise-applications',
      title: 'AI in Enterprise Applications',
      outline: 'How to implement AI solutions in your organization effectively',
      sessionDate: new Date('2026-04-20T14:00:00Z'),
      durationMins: 90,
      status: 'published',
      price: 149.99,
      certificatePrice: 0,
      priceType: 'ALWAYS_PAID',
      speakers: {
        connect: [{ id: speaker2.id }],
      },
    },
  });

  const webinar3 = await db.webinar.upsert({
    where: { slug: 'cybersecurity-best-practices' },
    update: {},
    create: {
      slug: 'cybersecurity-best-practices',
      title: 'Cybersecurity Best Practices',
      outline: 'Essential security measures every organization should implement',
      sessionDate: new Date('2026-04-25T09:00:00Z'),
      durationMins: 75,
      status: 'published',
      price: 0,
      certificatePrice: 0,
      priceType: 'ALWAYS_FREE',
      speakers: {
        connect: [{ id: speaker1.id }, { id: speaker2.id }],
      },
    },
  });

  console.log('✓ Created webinars: Future of Cloud Computing, AI in Enterprise Applications, Cybersecurity Best Practices');

  console.log('✅ Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
