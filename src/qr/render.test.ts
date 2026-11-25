import { encodeQR } from 'qr';
import { describe, expect, it } from 'vitest';
import { QR_QUIET_ZONE_MODULES, renderQrSvg } from './render';

function viewBoxSize(svg: string): number {
  const match = /viewBox="0 0 (\d+) (\d+)"/.exec(svg);
  if (match?.[1] === undefined) {
    throw new Error('rendered SVG has no numeric viewBox');
  }
  return Number(match[1]);
}

describe('renderQrSvg', () => {
  it('renders a guarded inline SVG with no dimensions or colors of its own', () => {
    const svg = renderQrSvg('https://example.com/');

    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toMatch(/viewBox="0 0 \d+ \d+"/);
    expect(svg).not.toMatch(/\s(?:width|height|fill|color|style)=/);
    expect(svg).not.toContain('<script');
    expect(svg).not.toContain('foreignObject');
  });

  it('surrounds the symbol with the four-module quiet zone', () => {
    const payload = 'https://example.com/';
    // `raw` includes the border it is given; a one-module border lets us recover
    // the bare symbol size without trusting our renderer's own border choice.
    const symbolModules = encodeQR(payload, 'raw', { ecc: 'medium', border: 1 }).length - 2;

    expect(QR_QUIET_ZONE_MODULES).toBe(4);
    expect(viewBoxSize(renderQrSvg(payload))).toBe(symbolModules + 2 * 4);
  });

  it('uses the medium error-correction level', () => {
    const payload = 'a'.repeat(100);
    const bareSymbol = (ecc: 'low' | 'medium'): number =>
      encodeQR(payload, 'raw', { ecc, border: 1 }).length - 2;

    expect(bareSymbol('medium')).not.toBe(bareSymbol('low'));
    expect(viewBoxSize(renderQrSvg(payload))).toBe(bareSymbol('medium') + 2 * QR_QUIET_ZONE_MODULES);
  });

  it('encodes an 800-byte Payload at the ceiling', () => {
    const svg = renderQrSvg('a'.repeat(800));
    expect(svg.startsWith('<svg')).toBe(true);
  });

  it('never embeds the Payload in the SVG markup', () => {
    const payload = '</svg><script>alert(1)</script>';
    const svg = renderQrSvg(payload);

    expect(svg).not.toContain('<script');
    expect(svg).not.toContain('alert(1)');
  });
});
