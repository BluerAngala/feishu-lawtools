import { ensureContentType, ensureRelationship, REL_TYPES, CONTENT_TYPES } from '../core/relations.mjs';
import { readText, writeText } from '../core/zip.mjs';
import { xmlEscape } from '../core/xml.mjs';

export function planComment(hits, text, { idPool, author, date, initials = 'AI' }) {
  const ops = [];
  for (const h of hits) {
    const id = idPool.take();
    ops.push({
      paragraph: h.paragraph,
      edit: {
        start: h.start,
        end: h.start,
        build: () => `<w:commentRangeStart w:id="${id}"/>`,
      },
      meta: { kind: 'comment.start', id, text, author, date, initials, anchor: h.match },
    });
    ops.push({
      paragraph: h.paragraph,
      edit: {
        start: h.end,
        end: h.end,
        build: () =>
          `<w:commentRangeEnd w:id="${id}"/>` +
          `<w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr>` +
          `<w:commentReference w:id="${id}"/></w:r>`,
      },
      meta: { kind: 'comment.end', id },
    });
  }
  return ops;
}

const W_NS =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

function buildCommentNode({ id, author, date, initials, text }) {
  return (
    `<w:comment w:id="${id}" w:author="${xmlEscape(author)}" ` +
    `w:initials="${xmlEscape(initials)}" w:date="${date}">` +
    `<w:p><w:r><w:rPr/><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:p>` +
    `</w:comment>`
  );
}

export async function commitComments(zip, comments) {
  if (!comments || comments.length === 0) return { added: 0 };

  let xml = await readText(zip, 'word/comments.xml');
  if (!xml) {
    xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:comments ${W_NS}></w:comments>`;
  }

  const insertion = comments.map(buildCommentNode).join('');
  const next = xml.replace(/<\/w:comments>\s*$/, `${insertion}</w:comments>`);
  writeText(zip, 'word/comments.xml', next);

  await ensureRelationship(zip, 'comments.xml', REL_TYPES.comments);
  await ensureContentType(zip, '/word/comments.xml', CONTENT_TYPES.comments);

  return { added: comments.length };
}

export function collectCommentMetas(ops) {
  return ops.filter((o) => o.meta && o.meta.kind === 'comment.start').map((o) => ({
    id: o.meta.id,
    author: o.meta.author,
    date: o.meta.date,
    initials: o.meta.initials,
    text: o.meta.text,
  }));
}
