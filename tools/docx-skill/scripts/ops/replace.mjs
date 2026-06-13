import { buildText, xmlEscape } from '../core/xml.mjs';
import { spliceParagraph } from '../model/paragraph.mjs';

function plainRun(text, rPr) {
  if (!text) return '';
  return `<w:r>${rPr}${buildText(text)}</w:r>`;
}

export function planReplace(hits, toText) {
  const byPara = groupByPara(hits);
  const ops = [];
  for (const [, group] of byPara) {
    for (const h of group) {
      ops.push({
        paragraph: group[0].paragraph,
        edit: {
          start: h.start,
          end: h.end,
          build: ({ rPr }) => plainRun(typeof toText === 'function' ? toText(h) : toText, rPr),
        },
        removed: h.match,
        inserted: typeof toText === 'function' ? toText(h) : toText,
      });
    }
  }
  return ops;
}

export function planInsert(hits, text, { mode = 'before' } = {}) {
  const ops = [];
  for (const h of hits) {
    const pos = mode === 'after' ? h.end : h.start;
    ops.push({
      paragraph: h.paragraph,
      edit: {
        start: pos,
        end: pos,
        build: ({ rPr }) => plainRun(text, rPr),
      },
      inserted: text,
      anchor: h.match,
    });
  }
  return ops;
}

export function planDelete(hits) {
  const ops = [];
  for (const h of hits) {
    ops.push({
      paragraph: h.paragraph,
      edit: {
        start: h.start,
        end: h.end,
        build: () => '',
      },
      removed: h.match,
    });
  }
  return ops;
}

export function applyParagraphEdits(paragraphs, ops, docXml) {
  const byPara = new Map();
  for (const op of ops) {
    const list = byPara.get(op.paragraph.id) || { para: op.paragraph, edits: [] };
    list.edits.push(op.edit);
    byPara.set(op.paragraph.id, list);
  }

  const newRawById = new Map();
  for (const [id, { para, edits }] of byPara) {
    newRawById.set(id, spliceParagraph(para, edits));
  }

  if (!docXml) {
    return paragraphs.map((p) => newRawById.get(p.id) ?? p.raw).join('');
  }

  const ordered = paragraphs
    .filter((p) => typeof p.docStart === 'number')
    .sort((a, b) => a.docStart - b.docStart);
  if (ordered.length === 0) return docXml;

  const parts = [];
  let cursor = 0;
  for (const p of ordered) {
    parts.push(docXml.slice(cursor, p.docStart));
    parts.push(newRawById.get(p.id) ?? p.raw);
    cursor = p.docEnd;
  }
  parts.push(docXml.slice(cursor));
  return parts.join('');
}

function groupByPara(hits) {
  const map = new Map();
  for (const h of hits) {
    const k = h.paragraph.id;
    const list = map.get(k) || [];
    list.push(h);
    map.set(k, list);
  }
  return map;
}
