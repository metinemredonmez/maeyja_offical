import { videoMatches } from './media.service';

describe('upload signatures (FIL-01)', () => {
  it('accepts real MP4 and WebM headers', () => {
    const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from('ftypisom'), Buffer.alloc(8)]);
    const webm = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(8)]);
    expect(videoMatches('video/mp4', mp4)).toBe(true);
    expect(videoMatches('video/webm', webm)).toBe(true);
  });

  it('refuses other files sent as video', () => {
    const html = Buffer.from('<html><script>alert(1)</script></html>');
    expect(videoMatches('video/mp4', html)).toBe(false);
    expect(videoMatches('video/webm', html)).toBe(false);
  });
});
