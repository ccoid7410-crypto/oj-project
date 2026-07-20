import { BadRequestException } from '@nestjs/common';
import { bannerBytesMatchMime, normalizeBannerLink } from './banner.service';

describe('banner security helpers', () => {
  it('checks image signatures instead of trusting the declared MIME', () => {
    const html = Buffer.from('<script>alert(1)</script>');
    expect(bannerBytesMatchMime(html, 'image/png')).toBe(false);
    expect(
      bannerBytesMatchMime(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        'image/png',
      ),
    ).toBe(true);
  });

  it('only accepts credential-free HTTP(S) banner links', () => {
    expect(normalizeBannerLink('https://example.com/banner')).toBe('https://example.com/banner');
    expect(() => normalizeBannerLink('javascript:alert(1)')).toThrow(BadRequestException);
    expect(() => normalizeBannerLink('https://user:pass@example.com')).toThrow(BadRequestException);
  });
});
