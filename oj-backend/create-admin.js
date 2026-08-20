const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('admin1234!', 10);
  const user = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      role: 'ADMIN',
      passwordHash,
      emailVerified: true,
      isRootAdmin: true
    },
    create: {
      username: 'admin',
      email: 'admin@cbsh.hs.kr',
      passwordHash,
      role: 'ADMIN',
      emailVerified: true,
      mustChangePassword: false,
      isRootAdmin: true
    },
  });
  console.log('Admin user created/updated successfully!');
  console.log('Username:', user.username);
  console.log('Email:', user.email);
  console.log('Role:', user.role);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
