import 'dotenv/config';
import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Default stages for new pipelines
const DEFAULT_STAGES = [
  { name: 'Inbox', orderIndex: 0, color: '#6B7280', isDefault: true }, // Gray
  { name: 'Screening', orderIndex: 1, color: '#3B82F6', isDefault: false }, // Blue
  { name: 'Interview', orderIndex: 2, color: '#8B5CF6', isDefault: false }, // Purple
  { name: 'Offer', orderIndex: 3, color: '#F59E0B', isDefault: false }, // Amber
  { name: 'Hired', orderIndex: 4, color: '#10B981', isDefault: false }, // Green
  { name: 'Rejected', orderIndex: 5, color: '#EF4444', isDefault: false }, // Red
];

async function main() {
  console.log('🌱 Starting database seed...\n');

  // Create default owner user
  const ownerEmail = process.env.OWNER_EMAIL || 'admin@talentflow.com';
  const ownerPassword = process.env.OWNER_PASSWORD || 'admin123';
  const ownerName = process.env.OWNER_NAME || 'Admin User';

  const passwordHash = await bcrypt.hash(ownerPassword, 12);

  const owner = await prisma.user.upsert({
    where: { email: ownerEmail },
    update: {},
    create: {
      email: ownerEmail,
      name: ownerName,
      passwordHash,
      role: UserRole.OWNER,
      activatedAt: new Date(),
    },
  });

  console.log(`✅ Created owner user: ${owner.email} (${owner.role})`);

  // Create default pipeline
  const pipeline = await prisma.pipeline.upsert({
    where: { id: 'default-pipeline' },
    update: {},
    create: {
      id: 'default-pipeline',
      name: 'Sales Recruitment',
      description: 'Default pipeline for sales position hiring across Europe',
    },
  });

  console.log(`✅ Created default pipeline: ${pipeline.name}`);

  // Create default stages for the pipeline
  for (const stageData of DEFAULT_STAGES) {
    const stage = await prisma.stage.upsert({
      where: {
        pipelineId_orderIndex: {
          pipelineId: pipeline.id,
          orderIndex: stageData.orderIndex,
        },
      },
      update: {
        name: stageData.name,
        color: stageData.color,
        isDefault: stageData.isDefault,
      },
      create: {
        pipelineId: pipeline.id,
        name: stageData.name,
        orderIndex: stageData.orderIndex,
        color: stageData.color,
        isDefault: stageData.isDefault,
      },
    });

    console.log(`  📊 Stage: ${stage.name} (order: ${stage.orderIndex})`);
  }

  // Assign owner to the default pipeline
  await prisma.pipelineAssignment.upsert({
    where: {
      userId_pipelineId: {
        userId: owner.id,
        pipelineId: pipeline.id,
      },
    },
    update: {},
    create: {
      userId: owner.id,
      pipelineId: pipeline.id,
    },
  });

  console.log(`✅ Assigned owner to pipeline: ${pipeline.name}`);

  // Create some default tags
  const defaultTags = [
    { name: 'Hot Lead', color: '#EF4444' },
    { name: 'Experienced', color: '#10B981' },
    { name: 'Junior', color: '#3B82F6' },
    { name: 'Remote OK', color: '#8B5CF6' },
    { name: 'Urgent', color: '#F59E0B' },
  ];

  for (const tagData of defaultTags) {
    await prisma.tag.upsert({
      where: { name: tagData.name },
      update: { color: tagData.color },
      create: tagData,
    });
  }

  console.log(`✅ Created ${defaultTags.length} default tags`);

  console.log('\n🎉 Database seed completed successfully!');
  console.log(`\n📋 Login credentials:`);
  console.log(`   Email: ${ownerEmail}`);
  console.log(`   Password: ${ownerPassword}`);
  console.log(`\n⚠️  Remember to change the default password in production!`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
