const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Default settings
  await prisma.setting.upsert({ where: { key: 'electricRate' }, update: {}, create: { key: 'electricRate', value: '8' } });
  await prisma.setting.upsert({ where: { key: 'waterRate' },    update: {}, create: { key: 'waterRate',    value: '18' } });
  await prisma.setting.upsert({ where: { key: 'dormName' },     update: {}, create: { key: 'dormName',     value: 'หอดี' } });

  // Sample rooms
  const roomNumbers = ['101', '102', '103', '201', '202'];
  for (const num of roomNumbers) {
    await prisma.room.upsert({
      where: { roomNumber: num },
      update: {},
      create: { roomNumber: num, floor: parseInt(num[0]), monthlyRent: 3500 },
    });
  }

  console.log('Seed complete.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
