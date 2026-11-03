import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import * as bcrypt from 'bcryptjs';
import { RegisterDto } from '../../modules/auth/dto/auth.dto';
import { normalizeEmail } from './email.util';
import { hashPassword, verifyPassword } from './password.util';

describe('passwords (PWD-01/03/04)', () => {
  it('hashes with Argon2id and verifies', async () => {
    const hash = await hashPassword('uzun ve sıradan olmayan bir cümle');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(hash, 'uzun ve sıradan olmayan bir cümle')).toEqual({ ok: true });
    expect((await verifyPassword(hash, 'uzun ve sıradan olmayan bir cümlE')).ok).toBe(false);
    expect((await verifyPassword(null, 'anything at all')).ok).toBe(false);
  });

  it('moves a right bcrypt password to Argon2id, never a wrong one', async () => {
    const old = await bcrypt.hash('eskiSifre123', 4);
    const good = await verifyPassword(old, 'eskiSifre123');
    expect(good.ok).toBe(true);
    expect(good.rehash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(old, 'eskiSifre124')).toEqual({ ok: false });
  });

  it('asks for 15 characters and refuses common or padded ones', () => {
    const errors = (password: string) => validateSync(plainToInstance(RegisterDto, { email: 'a@b.co', password, firstName: 'A', lastName: 'B' })).filter((e) => e.property === 'password');
    expect(errors('kısaŞifre123')).toHaveLength(1);
    expect(errors('123456789012345')).toHaveLength(1);
    expect(errors('abcabcabcabcabc')).toHaveLength(1);
    expect(errors('maeyja2026!!!!!!')).toHaveLength(1);
    expect(errors('deri çanta ve kahve')).toHaveLength(0);
  });
});

describe('e-mail normalization (PRS-01)', () => {
  it('maps variants of one address to the same value', () => {
    const base = 'irem.ince@example.com';
    for (const v of ['İREM.İNCE@EXAMPLE.COM', ' Irem.Ince@Example.com ', 'irem​.ince@example.com', 'ｉｒｅｍ.ｉｎｃｅ＠ｅｘａｍｐｌｅ.ｃｏｍ', 'irem.ince@exam­ple.com']) {
      expect(normalizeEmail(v)).toBe(base);
    }
  });
});
