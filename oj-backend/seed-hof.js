const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = Array.from({length: 12}, (_, i) => ({
    email: `cbsh380${i+1}@example.com`,
    username: `fake_user_${i+1}`,
    name: `명예회원 ${i+1}`,
    passwordHash: 'dummy',
    role: 'MEMBER'
  }));
  
  await prisma.user.createMany({
    data: users,
    skipDuplicates: true
  });
  console.log('Fake users created successfully.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
