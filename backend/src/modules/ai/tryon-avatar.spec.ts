import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AvatarChoice, avatarKey, avatarPrompt, heightGroup } from './tryon-avatar';
import { TryOnAvatarDto } from './tryon.controller';
import { TryOnService } from './tryon.service';

Logger.overrideLogger(false);

const choice: AvatarChoice = { height: 166, body: 'slim', skin: 'medium', hair: 'brown', length: 'long' };

describe('avatar choices', () => {
  it('groups heights so one avatar serves everyone of about the same height', () => {
    expect([150, 160, 161, 172, 173, 195].map(heightGroup)).toEqual(['petite', 'petite', 'average', 'average', 'tall', 'tall']);
    expect(avatarKey(choice)).toBe('average-slim-medium-brown-long');
    expect(avatarKey({ ...choice, height: 170 })).toBe(avatarKey(choice));
  });

  it('describes the avatar at the height of its group, in a plain studio, without a bag', () => {
    const prompt = avatarPrompt(choice);
    expect(prompt).toContain('about 167 cm tall');
    expect(prompt).toContain('long, past the shoulders brown hair');
    expect(prompt).toMatch(/No jewellery, no bag/);
    expect(prompt).not.toMatch(/istanbul/i);
  });
});

describe('avatar request (INP-01)', () => {
  const errors = async (body: object) => (await validate(plainToInstance(TryOnAvatarDto, body))).map((e) => e.property);

  it('takes only known choices and a sensible height', async () => {
    expect(await errors({ slug: 'petal-box', ...choice })).toEqual([]);
    expect(await errors({ slug: 'petal-box', ...choice, height: 260 })).toEqual(['height']);
    expect(await errors({ slug: 'petal-box', ...choice, skin: '../../etc' })).toEqual(['skin']);
    expect(await errors({ slug: '../x', ...choice })).toEqual(['slug']);
  });
});

describe('TryOnService.startAvatar', () => {
  function setup(made: { imageUrl: string } | null) {
    const prisma = {
      product: {
        findFirst: jest.fn(async () => ({ id: 'p1', slug: 'petal-box', name: 'Petal Box', dimensions: '24 × 16 × 10 cm', images: [{ url: 'https://api.test/uploads/a.webp', color: null }] })),
      },
      tryonLook: { findFirst: jest.fn(async () => made) },
    };
    const settings = { get: jest.fn(async () => ({ enabled: true })) };
    const usage = { take: jest.fn(async () => true), takeDaily: jest.fn(async () => true) };
    const env: Record<string, unknown> = { GEMINI_API_KEY: 'k', TRYON_DAILY_LIMIT: 100, UPLOAD_DIR: '/tmp/none', UPLOAD_PUBLIC_URL: 'https://api.test/uploads' };
    const svc = new TryOnService(prisma as never, settings as never, usage as never, { get: (k: string) => env[k] } as never);
    // The product photo is read from disk; here it is enough that one exists.
    jest.spyOn(svc as unknown as { readUpload: () => Promise<Buffer> }, 'readUpload').mockResolvedValue(Buffer.from('x'));
    return { svc, prisma, usage };
  }

  it('shows a look made before at once, without counting against any limit', async () => {
    const { svc, usage } = setup({ imageUrl: 'https://api.test/uploads/tryon/looks/x.jpg' });
    await expect(svc.startAvatar(choice, 'petal-box', undefined, '203.0.113.5')).resolves.toEqual({ id: null, status: 'done', image: 'https://api.test/uploads/tryon/looks/x.jpg' });
    expect(usage.take).not.toHaveBeenCalled();
  });

  it('counts a new look against the limits and starts it', async () => {
    const { svc, usage } = setup(null);
    jest.spyOn(svc as unknown as { runAvatar: () => Promise<void> }, 'runAvatar').mockResolvedValue(undefined);
    const out = await svc.startAvatar(choice, 'petal-box', undefined, '203.0.113.5');
    expect(out).toMatchObject({ status: 'working', image: null });
    expect(out.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(usage.take).toHaveBeenCalled();
  });
});
