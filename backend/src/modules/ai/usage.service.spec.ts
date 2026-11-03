import { visitorKey } from './usage.service';

describe('visitorKey (RES-01)', () => {
  it('keeps IPv4 addresses as they are', () => {
    expect(visitorKey('203.0.113.7')).toBe('203.0.113.7');
    expect(visitorKey('::ffff:203.0.113.7')).toBe('203.0.113.7');
  });

  it('counts a whole IPv6 /64 as one visitor', () => {
    expect(visitorKey('2001:db8:1:2:aaaa::1')).toBe('2001:db8:1:2::/64');
    expect(visitorKey('2001:db8:1:2:ffff:ffff:ffff:ffff')).toBe('2001:db8:1:2::/64');
    expect(visitorKey('2001:db8::1')).toBe('2001:db8:0:0::/64');
    expect(visitorKey('fe80::1%en0')).toBe('fe80:0:0:0::/64');
  });
});
