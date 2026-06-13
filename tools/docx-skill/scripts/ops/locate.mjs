import { findInParagraph } from '../model/paragraph.mjs';

export function locate(paragraphs, byId, locator) {
  if (!locator || typeof locator !== 'object') {
    throw new Error('locate: locator object required');
  }
  const { paragraph, keyword, regex, offset, length, end, nth, all = true } = locator;

  let pool = paragraphs;
  if (paragraph) {
    const p = byId.get(paragraph);
    if (!p) throw new Error(`locate: paragraph "${paragraph}" not found`);
    pool = [p];
  }

  if (keyword === undefined && regex === undefined && offset === undefined) {
    throw new Error('locate: must provide keyword, regex, or offset');
  }

  const hits = [];

  if (keyword !== undefined) {
    for (const p of pool) {
      const found = findInParagraph(p, keyword, { regex: false });
      for (const h of found) hits.push({ paragraph: p, ...h });
    }
  } else if (regex !== undefined) {
    for (const p of pool) {
      const found = findInParagraph(p, regex, { regex: true });
      for (const h of found) hits.push({ paragraph: p, ...h });
    }
  } else {
    if (!paragraph) {
      throw new Error('locate: offset locator requires "paragraph"');
    }
    const p = byId.get(paragraph);
    const off = Number(offset);
    const len = length !== undefined ? Number(length) : end !== undefined ? Number(end) - off : 0;
    const startIdx = off < 0 ? p.text.length + off : off;
    hits.push({
      paragraph: p,
      start: startIdx,
      end: startIdx + len,
      match: p.text.slice(startIdx, startIdx + len),
      groups: [],
    });
  }

  if (typeof nth === 'number') {
    if (nth < 0 || nth >= hits.length) {
      return [];
    }
    return [hits[nth]];
  }
  if (all === false && hits.length > 1) {
    return [hits[0]];
  }
  return hits;
}

export function describeLocator(locator) {
  const parts = [];
  if (locator.paragraph) parts.push(`para=${locator.paragraph}`);
  if (locator.keyword !== undefined) parts.push(`keyword=${JSON.stringify(locator.keyword)}`);
  if (locator.regex !== undefined) parts.push(`regex=${JSON.stringify(locator.regex)}`);
  if (locator.offset !== undefined) parts.push(`offset=${locator.offset}`);
  if (locator.length !== undefined) parts.push(`len=${locator.length}`);
  if (locator.end !== undefined) parts.push(`end=${locator.end}`);
  if (locator.nth !== undefined) parts.push(`nth=${locator.nth}`);
  return parts.join(' ');
}
