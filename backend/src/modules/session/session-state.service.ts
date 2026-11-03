import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type Tx = Prisma.TransactionClient;

/**
 * SES-02: whether an access token still belongs to a live session. Tokens carry the account's `sessionVersion`;
 * raising it (role or password change, MFA on/off, sign out everywhere) ends every session within seconds instead
 * of when the 5–15 minute access token runs out. Answers are cached for 30 s; this process forgets its own changes
 * at once.
 */
@Injectable()
export class SessionStateService {
  private readonly cache = new Map<string, { sv: number; live: boolean; at: number }>();

  constructor(private readonly prisma: PrismaService) {}

  async isCurrent(userId: string, sv: number) {
    let state = this.cache.get(userId);
    if (!state || Date.now() - state.at > 30_000) {
      const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { sessionVersion: true, isActive: true, deletedAt: true } });
      state = { sv: u?.sessionVersion ?? -1, live: Boolean(u?.isActive && !u.deletedAt), at: Date.now() };
      this.cache.set(userId, state);
      if (this.cache.size > 10_000) this.cache.clear();
    }
    return state.live && state.sv === sv;
  }

  /** Ends every session of the account: refresh tokens are revoked and issued access tokens stop working. */
  async endAll(userId: string, tx: Tx = this.prisma) {
    await tx.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } });
    await tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    this.cache.delete(userId);
  }
}
