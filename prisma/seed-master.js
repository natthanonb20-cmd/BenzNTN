/**
 * สร้าง Master Admin ตัวแรก
 * รัน: node prisma/seed-master.js
 *
 * ตั้งค่า env ก่อน:
 *   MASTER_USERNAME=admin  MASTER_PASSWORD=yourpassword  node prisma/seed-master.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const username = process.env.MASTER_USERNAME || 'masteradmin';
  const password = process.env.MASTER_PASSWORD || 'changeme123';

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    console.log(`✅ Master Admin "${username}" มีอยู่แล้ว`);
    return;
  }

  const hashed = await bcrypt.hash(password, 12);
  const user   = await prisma.user.create({
    data: {
      username,
      password:   hashed,
      role:       'MASTER_ADMIN',
      propertyId: null,
    },
  });

  console.log(`✅ สร้าง Master Admin สำเร็จ`);
  console.log(`   Username: ${username}`);
  console.log(`   Password: ${password}`);
  console.log(`   ID: ${user.id}`);
  console.log(`\n⚠️  กรุณาเปลี่ยนรหัสผ่านหลังจาก Login ครั้งแรก`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
