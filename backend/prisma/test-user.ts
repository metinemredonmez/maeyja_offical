/**
 * A verified customer account for trying the shop end to end (sign-in, cart, checkout, account pages):
 *   npm run user:test                          test@maeyja.com
 *   npm run user:test -- you@example.com       another address (yours, to receive the order e-mails)
 *   npm run user:test -- --remove              delete it again (its orders stay, without an owner)
 * Every run prints a new random password; if the account exists its password is reset. Never touches staff accounts.
 */
import 'dotenv/config';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();
const args = process.argv.slice(2);
const email = (args.find((a) => a.includes('@')) ?? 'test@maeyja.com').toLowerCase();

async function main() {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.role !== UserRole.CUSTOMER) throw new Error(`${email} bir yönetici hesabı; dokunulmadı.`);

  if (args.includes('--remove')) {
    if (existing) await prisma.user.delete({ where: { id: existing.id } });
    console.log(existing ? `✓ ${email} silindi` : `– ${email} zaten yok`);
    return;
  }

  const password = randomBytes(9).toString('base64url'); // 12 characters
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    update: { passwordHash, emailVerifiedAt: existing?.emailVerifiedAt ?? new Date() },
    create: { email, passwordHash, firstName: 'Test', lastName: 'Müşteri', locale: 'tr', emailVerifiedAt: new Date() },
  });
  console.log(`✓ test hesabı hazır\n  e-posta: ${email}\n  şifre:   ${password}\n  giriş:   https://maeyja.com/tr/account/login`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
