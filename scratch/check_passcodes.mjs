import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const passcodes = await prisma.passcode.findMany();
  console.log(JSON.stringify(passcodes, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
