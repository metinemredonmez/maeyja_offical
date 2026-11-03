/**
 * Lost phone: removes a staff member's two-step verification so they can set it up again (AUT-04).
 * Run on the server only, by someone with shell access:
 *   npm run mfa:reset -- canan@maeyja.com
 * Every session of the account is closed; the owner sets MFA up again at the next sign-in. Leaves an audit log entry.
 */
import 'dotenv/config';
import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();
const email = process.argv.slice(2).find((a) => a.includes('@'))?.toLowerCase();

async function main() {
  if (!email) throw new Error('Kullanım: npm run mfa:reset -- kisi@ornek.com');
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`${email} bulunamadı`);
  if (user.role === UserRole.CUSTOMER) throw new Error(`${email} bir müşteri hesabı; iki adımlı doğrulama yalnız personelde var`);
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { mfaSecret: null, mfaEnabledAt: null, mfaBackupCodes: [], mfaFailures: 0, mfaLockedUntil: null, mfaLastStep: null } }),
    prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
    prisma.auditLog.create({ data: { action: 'CLI mfa:reset', entity: 'users', entityId: user.id, meta: { email } } }),
  ]);
  console.log(`✓ ${email}: iki adımlı doğrulama kaldırıldı, oturumlar kapatıldı. Bir sonraki girişte yeniden kurulacak.`);
}

main()
  .catch((e) => {
    console.error(`✗ ${(e as Error).message}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
