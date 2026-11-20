import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS } from '../../../src/domain/params';
import {
  CUSTOM_COVER_ICONS,
  coverIcon,
  ICON_NAMES,
  icon,
  isCustomCoverIcon,
} from '../../../src/ui/icons';

describe('icon', () => {
  it('returns one decorative stroke SVG for every name', () => {
    for (const name of ICON_NAMES) {
      const svg = icon(name);
      expect(svg).toMatch(/^<svg [^>]*>.+<\/svg>$/);
      expect(svg.match(/<svg/g)).toHaveLength(1);
      expect(svg).toContain('aria-hidden="true"');
      expect(svg).toContain('focusable="false"');
      expect(svg).toContain('stroke="currentColor"');
      expect(svg).not.toMatch(/fill="(?!none)/);
    }
  });

  it('draws the icons moved from the features exactly as before', () => {
    // the markup the theme switch, date-time pickers, cover pills and save button used to inline
    const svg = (size: number, stroke: number, body: string, cls = ''): string =>
      `<svg${cls} viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
    expect(icon('dark')).toBe(
      svg(18, 1.5, '<path d="M15.5 10.5A6.5 6.5 0 1 1 7.5 2.5a5 5 0 0 0 8 8z"/>'),
    );
    expect(icon('calendar')).toBe(
      svg(
        18,
        1.5,
        '<rect x="2.5" y="3.5" width="13" height="12" rx="1.5"/><path d="M2.5 7.5h13M6 2v3M12 2v3"/>',
      ),
    );
    expect(icon('chevronLeft')).toBe(svg(18, 1.75, '<path d="M11 4 6 9l5 5"/>'));
    expect(icon('pillOn', 'ico on')).toBe(
      svg(14, 2, '<path d="M2.5 7.5l3 3 6-7"/>', ' class="ico on"'),
    );
    expect(icon('saved')).toBe(svg(16, 2, '<path d="M3 8.5l3 3 7-7"/>'));
  });
});

describe('coverIcon', () => {
  it('has its own icon for every cover in the catalog', () => {
    const fallback = icon('cover');
    for (const c of DEFAULT_PARAMS.covers) expect(coverIcon(c)).not.toBe(fallback);
  });

  it('falls back to the neutral cover icon for a cover without one', () => {
    expect(coverIcon({ id: 'custom:shelf' })).toBe(icon('cover'));
    expect(coverIcon({ id: 'custom:shelf' }, 'ico')).toBe(icon('cover', 'ico'));
  });

  it("uses a user-defined cover's own icon", () => {
    expect(coverIcon({ id: 'custom:shelf', icon: 'bucket' }, 'ico')).toBe(icon('bucket', 'ico'));
  });
});

describe('isCustomCoverIcon', () => {
  it('accepts only the icons offered to user-defined covers', () => {
    for (const name of CUSTOM_COVER_ICONS) expect(isCustomCoverIcon(name)).toBe(true);
    for (const name of ['', 'plus', 'warning', 'nope']) expect(isCustomCoverIcon(name)).toBe(false);
  });
});
