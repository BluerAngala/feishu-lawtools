import { loadDocx, readText, writeText, saveDocx } from './core/zip.mjs';
import { buildIdPool } from './core/ids.mjs';
import { indexParagraphs } from './model/paragraph.mjs';
import { locate, describeLocator } from './ops/locate.mjs';
import { planReplace, planInsert, planDelete, applyParagraphEdits } from './ops/replace.mjs';
import {
  planRevisionReplace,
  planRevisionDelete,
  planRevisionInsert,
} from './ops/revision.mjs';
import { planComment, commitComments, collectCommentMetas } from './ops/comment.mjs';
import { setHeader, getHeaders } from './ops/header.mjs';

const DEFAULT_AUTHOR = 'AI Reviewer';

function defaultDate() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

const OP_KINDS = new Set([
  'replace',
  'insert',
  'delete',
  'revise.replace',
  'revise.insert',
  'revise.delete',
  'comment.add',
  'header.set',
]);

function ensureLocator(op) {
  if (!op.locate) throw new Error(`op[${op.type}] missing "locate"`);
}

export async function apply(input, ops, options = {}) {
  if (!Array.isArray(ops)) throw new TypeError('apply: ops must be an array');

  const author = options.author || DEFAULT_AUTHOR;
  const date = options.date || defaultDate();
  const dryRun = !!options.dryRun;
  const onProgress = options.onProgress || (() => {});

  const zip = await loadDocx(input);
  const docXml = await readText(zip, 'word/document.xml');
  if (!docXml) throw new Error('apply: word/document.xml not found');

  const { list: paragraphs, byId } = indexParagraphs(docXml);
  const idPool = await buildIdPool(zip);

  const report = [];
  const paragraphOps = [];
  const headerOps = [];
  const commentMetas = [];

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    if (!op || !op.type) {
      report.push({ index: i, type: null, status: 'error', message: 'op missing "type"' });
      continue;
    }
    if (!OP_KINDS.has(op.type)) {
      report.push({ index: i, type: op.type, status: 'error', message: `unknown op type "${op.type}"` });
      continue;
    }

    try {
      const r = planOp(op, { paragraphs, byId, idPool, author, date, options });
      paragraphOps.push(...r.paragraphOps);
      headerOps.push(...r.headerOps);
      report.push({ index: i, type: op.type, status: r.status, ...r.summary });
      if (r.commentMetas) commentMetas.push(...r.commentMetas);
    } catch (e) {
      report.push({ index: i, type: op.type, status: 'error', message: e.message });
    }
    onProgress(report[report.length - 1]);
  }

  if (dryRun) {
    if (paragraphOps.length) {
      try {
        applyParagraphEdits(paragraphs, paragraphOps, docXml);
      } catch (e) {
        const conflict = parseOverlapError(e.message, paragraphOps);
        if (conflict) {
          report.push({
            index: report.length,
            type: '__commit__',
            status: 'error',
            message: `paragraph edit conflict: ${conflict.summary}`,
            conflict,
          });
        } else {
          report.push({
            index: report.length,
            type: '__commit__',
            status: 'error',
            message: e.message,
          });
        }
      }
    }
    return { report, dryRun: true };
  }

  if (paragraphOps.length) {
    try {
      const newDocXml = applyParagraphEdits(paragraphs, paragraphOps, docXml);
      writeText(zip, 'word/document.xml', newDocXml);
    } catch (e) {
      const conflict = parseOverlapError(e.message, paragraphOps);
      if (conflict) {
        report.push({
          index: report.length,
          type: '__commit__',
          status: 'error',
          message: `paragraph edit conflict: ${conflict.summary}`,
          conflict,
        });
        return { report, dryRun: false, buffer: null, aborted: true };
      }
      throw e;
    }
  }

  if (commentMetas.length) {
    await commitComments(zip, commentMetas);
  }

  for (const headerOp of headerOps) {
    await setHeader(zip, headerOp.text, { type: headerOp.type, mode: headerOp.mode });
  }

  let outBuf = null;
  if (options.outPath) {
    outBuf = await saveDocx(zip, options.outPath);
  } else if (options.returnBuffer) {
    outBuf = await saveDocx(zip);
  }

  return { report, dryRun: false, buffer: outBuf };
}

function planOp(op, { paragraphs, byId, idPool, author, date, options }) {
  if (op.type === 'header.set') {
    return {
      paragraphOps: [],
      headerOps: [{ text: op.value, type: op.headerType || 'default', mode: op.mode || 'replace' }],
      status: 'planned',
      summary: { message: `header.set ${JSON.stringify(op.value)} type=${op.headerType || 'default'}` },
    };
  }

  ensureLocator(op);
  const hits = locate(paragraphs, byId, op.locate);
  if (hits.length === 0) {
    return {
      paragraphOps: [],
      headerOps: [],
      status: 'no-match',
      summary: { message: `no match for ${describeLocator(op.locate)}` },
    };
  }

  const a = op.author || author;
  const d = op.date || date;

  switch (op.type) {
    case 'replace': {
      const ops = planReplace(hits, op.to ?? '');
      return paragraphResult(ops, `replace ${hits.length} hit(s)`);
    }
    case 'insert': {
      const ops = planInsert(hits, op.text ?? '', { mode: op.mode || 'before' });
      return paragraphResult(ops, `insert ${hits.length} place(s) (${op.mode || 'before'})`);
    }
    case 'delete': {
      const ops = planDelete(hits);
      return paragraphResult(ops, `delete ${hits.length} hit(s)`);
    }
    case 'revise.replace': {
      const ops = planRevisionReplace(hits, op.to ?? '', { idPool, author: a, date: d });
      return paragraphResult(ops, `revise.replace ${hits.length} hit(s)`);
    }
    case 'revise.insert': {
      const ops = planRevisionInsert(hits, op.text ?? '', {
        idPool, author: a, date: d, mode: op.mode || 'before',
      });
      return paragraphResult(ops, `revise.insert ${hits.length} place(s)`);
    }
    case 'revise.delete': {
      const ops = planRevisionDelete(hits, { idPool, author: a, date: d });
      return paragraphResult(ops, `revise.delete ${hits.length} hit(s)`);
    }
    case 'comment.add': {
      const ops = planComment(hits, op.text ?? '', {
        idPool, author: a, date: d, initials: op.initials || 'AI',
      });
      const metas = collectCommentMetas(ops);
      return {
        paragraphOps: ops,
        headerOps: [],
        commentMetas: metas,
        status: 'planned',
        summary: {
          message: `comment.add ${hits.length} place(s)`,
          hits: hits.map((h) => ({ paragraph: h.paragraph.id, start: h.start, end: h.end, match: h.match })),
        },
      };
    }
  }
  throw new Error(`planOp: unsupported type "${op.type}"`);
}

function paragraphResult(paragraphOps, message) {
  return {
    paragraphOps,
    headerOps: [],
    status: 'planned',
    summary: {
      message,
      hits: paragraphOps.map((o) => ({
        paragraph: o.paragraph.id,
        start: o.edit.start,
        end: o.edit.end,
        removed: o.removed,
        inserted: o.inserted,
      })),
    },
  };
}

function parseOverlapError(msg, paragraphOps) {
  const m = msg.match(/in (P\d+) at \[(\d+), (\d+)\) vs \[(\d+), (\d+)\)/);
  if (!m) return null;
  const [, pid, sA, eA, sB, eB] = m;
  const matchingOps = paragraphOps.filter(
    (o) => o.paragraph.id === pid &&
      ((o.edit.start === +sA && o.edit.end === +eA) ||
       (o.edit.start === +sB && o.edit.end === +eB)),
  );
  return {
    paragraph: pid,
    rangeA: [+sA, +eA],
    rangeB: [+sB, +eB],
    summary: `paragraph ${pid} has conflicting edits [${sA},${eA}) vs [${sB},${eB})`,
    ops: matchingOps,
  };
}

export function formatReport(report) {
  const lines = [];
  let ok = 0, noMatch = 0, err = 0;
  for (const r of report) {
    const tag = r.status === 'planned' ? 'OK ' : r.status === 'no-match' ? '-- ' : 'ERR';
    if (r.status === 'planned') ok++;
    else if (r.status === 'no-match') noMatch++;
    else err++;
    lines.push(`[${tag}] op[${r.index}] ${r.type.padEnd(16)} ${r.message || ''}`);
    if (r.hits && r.hits.length <= 6) {
      for (const h of r.hits) {
        const detail = h.removed !== undefined
          ? `${JSON.stringify(h.removed)} -> ${JSON.stringify(h.inserted ?? '')}`
          : JSON.stringify(h.match || '');
        lines.push(`         ${h.paragraph} [${h.start},${h.end}) ${detail}`);
      }
    } else if (r.hits) {
      lines.push(`         (${r.hits.length} hits, suppressed)`);
    }
  }
  lines.push('');
  lines.push(`Summary: ${ok} planned / ${noMatch} no-match / ${err} error / total ${report.length}`);
  return lines.join('\n');
}
