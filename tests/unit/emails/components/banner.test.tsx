// Banner component — rendering tests (T011 / US2)
// Verifies that height and width props are applied correctly to the <Img> tag.

import { render } from '@react-email/render';
import { Banner } from '../../../../src/emails/components/banner';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

async function renderBanner(props: Parameters<typeof Banner>[0] = {}) {
  return render(Banner(props));
}

// ---------------------------------------------------------------------------
// default rendering
// ---------------------------------------------------------------------------

describe('Banner — default props', () => {
  it('renders an <img> tag', async () => {
    const html = await renderBanner();
    expect(html).toContain('<img');
  });

  it('uses height="40" by default', async () => {
    const html = await renderBanner();
    expect(html).toContain('height="40"');
  });

  it('does not include a width attribute when not provided', async () => {
    const html = await renderBanner();
    // width should not appear as an attribute on the img element
    expect(html).not.toMatch(/width="\d+"/);
  });
});

// ---------------------------------------------------------------------------
// custom height
// ---------------------------------------------------------------------------

describe('Banner — custom height', () => {
  it('renders with the specified height', async () => {
    const html = await renderBanner({ height: 80 });
    expect(html).toContain('height="80"');
  });

  it('renders height=60', async () => {
    const html = await renderBanner({ height: 60 });
    expect(html).toContain('height="60"');
  });
});

// ---------------------------------------------------------------------------
// custom width
// ---------------------------------------------------------------------------

describe('Banner — custom width', () => {
  it('renders with the specified width when provided', async () => {
    const html = await renderBanner({ width: 320 });
    expect(html).toContain('width="320"');
  });

  it('renders width=200', async () => {
    const html = await renderBanner({ width: 200 });
    expect(html).toContain('width="200"');
  });

  it('does not set height when only width is provided (preserves aspect ratio)', async () => {
    const html = await renderBanner({ width: 320 });
    expect(html).not.toMatch(/height="\d+"/);
  });
});

// ---------------------------------------------------------------------------
// custom height AND width
// ---------------------------------------------------------------------------

describe('Banner — height and width together', () => {
  it('applies both height and width when both are provided', async () => {
    const html = await renderBanner({ height: 80, width: 320 });
    expect(html).toContain('height="80"');
    expect(html).toContain('width="320"');
  });
});
