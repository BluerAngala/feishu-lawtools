import { xmlEscape, buildText } from '../core/xml.mjs';

function plainRun(text, rPr) {
  if (!text) return '';
  return `<w:r>${rPr}${buildText(text)}</w:r>`;
}

function delRun(text, rPr) {
  if (!text) return '';
  return `<w:r>${rPr}<w:delText xml:space="preserve">${xmlEscape(text)}</w:delText></w:r>`;
}

function wrapIns(content, id, author, date) {
  return `<w:ins w:id="${id}" w:author="${xmlEscape(author)}" w:date="${date}">${content}</w:ins>`;
}

function wrapDel(content, id, author, date) {
  return `<w:del w:id="${id}" w:author="${xmlEscape(author)}" w:date="${date}">${content}</w:del>`;
}

export function planRevisionReplace(hits, toText, { idPool, author, date }) {
  const ops = [];
  for (const h of hits) {
    const newText = typeof toText === 'function' ? toText(h) : toText;
    const delId = idPool.take();
    const insId = idPool.take();
    ops.push({
      paragraph: h.paragraph,
      edit: {
        start: h.start,
        end: h.end,
        build: ({ rPr, removed }) =>
          wrapDel(delRun(removed, rPr), delId, author, date) +
          wrapIns(plainRun(newText, rPr), insId, author, date),
      },
      removed: h.match,
      inserted: newText,
      meta: { kind: 'revise.replace', delId, insId },
    });
  }
  return ops;
}

export function planRevisionDelete(hits, { idPool, author, date }) {
  const ops = [];
  for (const h of hits) {
    const delId = idPool.take();
    ops.push({
      paragraph: h.paragraph,
      edit: {
        start: h.start,
        end: h.end,
        build: ({ rPr, removed }) => wrapDel(delRun(removed, rPr), delId, author, date),
      },
      removed: h.match,
      meta: { kind: 'revise.delete', delId },
    });
  }
  return ops;
}

export function planRevisionInsert(hits, text, { idPool, author, date, mode = 'before' }) {
  const ops = [];
  for (const h of hits) {
    const pos = mode === 'after' ? h.end : h.start;
    const insId = idPool.take();
    ops.push({
      paragraph: h.paragraph,
      edit: {
        start: pos,
        end: pos,
        build: ({ rPr }) => wrapIns(plainRun(text, rPr), insId, author, date),
      },
      inserted: text,
      anchor: h.match,
      meta: { kind: 'revise.insert', insId },
    });
  }
  return ops;
}
