import { listParagraphs } from './paragraph.mjs';

export function buildOutline(docXml) {
  const paragraphs = listParagraphs(docXml);
  const items = [];
  for (const p of paragraphs) {
    if (p.headingLevel) {
      items.push({
        id: p.id,
        index: p.index,
        level: p.headingLevel,
        text: p.text,
      });
    }
  }
  return items;
}

export function tocText(docXml) {
  const items = buildOutline(docXml);
  return items.map((it) => `${'  '.repeat(it.level - 1)}${it.text}  [${it.id}]`).join('\n');
}
