import type { Badge, IconName, TagContent } from '../behaviour';

const SVG = 'http://www.w3.org/2000/svg';

/** Icon outlines (24 × 24, stroked), from the prototype. */
const ICONS: Readonly<Record<IconName, string>> = {
  reading: 'M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z',
  coding: 'M16 18l6-6-6-6M8 6l-6 6 6 6',
  testing: 'M9 12l2 2 4-4M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
  vcs: 'M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9a9 9 0 0 1-9 9',
  terminal: 'M4 17l6-6-6-6M12 19h8',
  research:
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20',
  delegating:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  planning: 'M3 6l2 2 4-4M3 16l2 2 4-4M13 6h8M13 12h8M13 18h8',
  designing:
    'M12 19l7-7 3 3-7 7zM18 13l-1.5-7.5L2 2l3.5 14.5L13 18zM2 2l7.6 7.6M11 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  monitoring: 'M22 12h-4l-3 9L9 3l-3 9H2',
  integration: 'M12 22v-5M9 8V2M15 8V2M18 8v5a6 6 0 0 1-12 0V8z',
  working: 'M3 7h18v13H3zM8 7V4h8v3',
  coffee: 'M17 8h1a4 4 0 1 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4zM6 2v2M10 2v2M14 2v2',
  walking: 'M13 4a1 1 0 1 0 2 0 1 1 0 0 0-2 0M7 21l3-4M16 21l-2-4-3-3 1-6M6 12l2-3 4-1 3 3 3 1',
  waiting:
    'M5 22h14M5 2h14M17 22v-4.2a2 2 0 0 0-.6-1.4L12 12l-4.4 4.4a2 2 0 0 0-.6 1.4V22M7 2v4.2a2 2 0 0 0 .6 1.4L12 12l4.4-4.4a2 2 0 0 0 .6-1.4V2',
};

function icon(name: IconName): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '14');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('d', ICONS[name]);
  svg.append(path);
  return svg;
}

function span(className: string, text?: string): HTMLSpanElement {
  const el = document.createElement('span');
  el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function badgeMark(badge: Badge): HTMLElement | SVGSVGElement | undefined {
  if (badge.dots) {
    const dots = span('hf-dots');
    dots.append(span(''), span(''), span(''));
    return dots;
  }
  return badge.icon === undefined ? undefined : icon(badge.icon);
}

/**
 * Fills a robot's tag (W4): a small bulb with just the icon, and the details
 * that replace it while the tag is open. Every piece of text goes in through
 * `textContent`, never as HTML.
 *
 * @param element - The tag's element.
 * @param content - What to show.
 * @param color - The room colour, for the outline.
 */
export function renderTag(element: HTMLElement, content: TagContent, color: string): void {
  element.style.setProperty('--hf-tag-color', color);
  const { badge } = content;
  const bulb = span(
    ['hf-bulb', badge?.quiet === true ? 'hf-bulb-quiet' : '', content.subagent ? 'hf-bulb-sub' : '']
      .filter((name) => name !== '')
      .join(' '),
  );
  const details = span('hf-details');
  if (badge !== undefined) {
    const mark = badgeMark(badge);
    if (mark !== undefined) bulb.append(mark);
    const pill = span(badge.quiet ? 'hf-badge hf-badge-quiet' : 'hf-badge');
    const pillMark = badgeMark(badge);
    if (pillMark !== undefined) pill.append(pillMark);
    pill.append(document.createTextNode(badge.text));
    details.append(pill);
  }
  details.append(span(content.subagent ? 'hf-name hf-name-sub' : 'hf-name', content.name));
  if (content.goal !== undefined) details.append(span('hf-goal', content.goal));
  element.replaceChildren(bulb, details);
}

/**
 * Fills a room's label: a colour swatch, the name and who is in it.
 *
 * @param element - The label's element.
 * @param name - The room's name.
 * @param color - The room colour.
 * @param detail - For example "2 sessions + 1 subagent".
 * @param more - Robots beyond the render cap, as "+N" (E8).
 * @param dim - Whether the room's lights are off (E2).
 */
export function renderRoomLabel(
  element: HTMLElement,
  name: string,
  color: string,
  detail: string,
  more: string | undefined,
  dim: boolean,
): void {
  const swatch = span('hf-swatch');
  swatch.style.background = color;
  const children: HTMLElement[] = [
    swatch,
    span('hf-room-name', name),
    span('hf-room-detail', detail),
  ];
  if (more !== undefined) children.push(span('hf-more', more));
  element.classList.toggle('hf-dim', dim);
  element.replaceChildren(...children);
}
