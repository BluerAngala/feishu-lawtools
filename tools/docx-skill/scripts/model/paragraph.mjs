import { RE, firstMatch, matchAll, buildRun, buildDelRun, buildText, xmlEscape } from '../core/xml.mjs';

const TEXT_RE_G = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
const RUN_RE_G = /<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>|<w:r(?:\s[^>]*)?\/>/g;
const PARA_RE_G = /<w:p\b[^>]*>[\s\S]*?<\/w:p>|<w:p\b[^>]*\/>/g;

function pad4(n) {
  return String(n).padStart(4, '0');
}

function splitParagraph(pXml) {
  const openMatch = pXml.match(/<w:p\b[^>]*>/);
  if (!openMatch) {
    return { openTag: '<w:p>', pPr: '', body: '', closeTag: '</w:p>', selfClose: true };
  }
  const openTag = openMatch[0];
  const closeIdx = pXml.lastIndexOf('</w:p>');
  if (closeIdx < 0) {
    return { openTag, pPr: '', body: '', closeTag: '', selfClose: true };
  }
  const inner = pXml.slice(openTag.length, closeIdx);
  const pPrMatch = inner.match(RE.pPr);
  let pPr = '';
  let body = inner;
  if (pPrMatch && pPrMatch.index === 0) {
    pPr = pPrMatch[0];
    body = inner.slice(pPrMatch[0].length);
  } else if (pPrMatch) {
    pPr = pPrMatch[0];
    body = inner.slice(0, pPrMatch.index) + inner.slice(pPrMatch.index + pPrMatch[0].length);
  }
  return { openTag, pPr, body, closeTag: '</w:p>', selfClose: false };
}

function extractRunRPr(runXml) {
  const m = runXml.match(RE.rPr);
  return m ? m[0] : '';
}

function extractRunTexts(runXml) {
  const out = [];
  TEXT_RE_G.lastIndex = 0;
  let m;
  while ((m = TEXT_RE_G.exec(runXml)) !== null) {
    out.push({ raw: m[0], content: m[1], runOffset: m.index, runLen: m[0].length });
  }
  return out;
}

export function parseParagraph(pXml, index) {
  const { openTag, pPr, body, closeTag, selfClose } = splitParagraph(pXml);
  const id = `P${pad4(index + 1)}`;

  const runs = [];
  let paraCursor = 0;
  if (!selfClose) {
    RUN_RE_G.lastIndex = 0;
    let m;
    while ((m = RUN_RE_G.exec(body)) !== null) {
      const raw = m[0];
      const rPr = extractRunRPr(raw);
      const texts = extractRunTexts(raw);
      const runText = texts.map((t) => t.content).join('');
      const paraStart = paraCursor;
      const paraEnd = paraCursor + runText.length;
      runs.push({
        idx: runs.length,
        raw,
        rPr: rPr || '<w:rPr/>',
        rawRPr: rPr,
        texts,
        text: runText,
        bodyStart: m.index,
        bodyEnd: m.index + raw.length,
        paraStart,
        paraEnd,
      });
      paraCursor = paraEnd;
    }
  }

  const text = runs.map((r) => r.text).join('');
  const pStyleMatch = pPr.match(RE.pStyleVal);
  const styleId = pStyleMatch ? pStyleMatch[1] : null;
  const headingLevel = styleId && /^Heading(\d)$/i.test(styleId)
    ? parseInt(styleId.match(/(\d)/)[1], 10)
    : null;
  const isList = RE.numPr.test(pPr);

  return {
    id,
    index,
    raw: pXml,
    openTag,
    pPr,
    body,
    closeTag,
    selfClose,
    runs,
    text,
    styleId,
    headingLevel,
    isList,
  };
}

export function listParagraphs(docXml) {
  const out = [];
  PARA_RE_G.lastIndex = 0;
  let m;
  while ((m = PARA_RE_G.exec(docXml)) !== null) {
    const p = parseParagraph(m[0], out.length);
    p.docStart = m.index;
    p.docEnd = m.index + m[0].length;
    out.push(p);
  }
  return out;
}

export function indexParagraphs(docXml) {
  const list = listParagraphs(docXml);
  const byId = new Map(list.map((p) => [p.id, p]));
  return { list, byId };
}

export function findInParagraph(para, needle, { regex = false, flags = 'g' } = {}) {
  const hits = [];
  if (!para.text) return hits;
  if (regex) {
    const re = needle instanceof RegExp
      ? new RegExp(needle.source, needle.flags.includes('g') ? needle.flags : needle.flags + 'g')
      : new RegExp(needle, flags.includes('g') ? flags : flags + 'g');
    let m;
    while ((m = re.exec(para.text)) !== null) {
      hits.push({ start: m.index, end: m.index + m[0].length, match: m[0], groups: m.slice(1) });
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  } else {
    const s = String(needle);
    if (!s) return hits;
    let from = 0;
    while (true) {
      const idx = para.text.indexOf(s, from);
      if (idx === -1) break;
      hits.push({ start: idx, end: idx + s.length, match: s, groups: [] });
      from = idx + s.length;
    }
  }
  return hits;
}

function rPrForCut(para, start) {
  for (const r of para.runs) {
    if (start >= r.paraStart && start < r.paraEnd) return r.rPr;
  }
  if (para.runs.length) return para.runs[para.runs.length - 1].rPr;
  return '<w:rPr/>';
}

export function rPrAt(para, start) {
  return rPrForCut(para, start);
}

export function spliceParagraph(para, edits) {
  if (!edits || edits.length === 0) return para.raw;
  if (para.selfClose) return para.raw;

  const sorted = [...edits].sort((a, b) => a.start - b.start);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start < sorted[i - 1].end) {
      throw new Error(
        `spliceParagraph: overlapping edits in ${para.id} at [${sorted[i].start}, ${sorted[i].end}) vs [${sorted[i - 1].start}, ${sorted[i - 1].end})`,
      );
    }
  }

  const newBodyParts = [];
  let bodyCursor = 0;

  if (para.runs.length === 0) {
    for (const ed of sorted) {
      if (ed.start !== 0 || ed.end !== 0) {
        throw new Error(`spliceParagraph: ${para.id} has no runs, can only accept insert-at-0 edits`);
      }
      const inserted = ed.build({ rPr: '<w:rPr/>', kind: 'insert' });
      if (inserted) newBodyParts.push(inserted);
    }
    return para.openTag + para.pPr + newBodyParts.join('') + para.body + para.closeTag;
  }

  const edgeInsertsBefore = new Map();
  for (const ed of sorted) {
    if (ed.start === ed.end) {
      const list = edgeInsertsBefore.get(ed.start) || [];
      list.push(ed);
      edgeInsertsBefore.set(ed.start, list);
    }
  }

  for (const run of para.runs) {
    newBodyParts.push(para.body.slice(bodyCursor, run.bodyStart));
    bodyCursor = run.bodyEnd;

    const runReplacement = rebuildRun(run, sorted, edgeInsertsBefore, para);
    newBodyParts.push(runReplacement);
  }
  newBodyParts.push(para.body.slice(bodyCursor));

  const trailingInserts = edgeInsertsBefore.get(para.text.length);
  if (trailingInserts && trailingInserts.length) {
    const insLast = para.runs[para.runs.length - 1];
    const rPr = insLast ? insLast.rPr : '<w:rPr/>';
    for (const ed of trailingInserts) {
      if (ed.__consumed) continue;
      const inserted = ed.build({ rPr, kind: 'insert' });
      if (inserted) newBodyParts.push(inserted);
      ed.__consumed = true;
    }
  }

  return para.openTag + para.pPr + newBodyParts.join('') + para.closeTag;
}

function rebuildRun(run, edits, edgeInsertsBefore, para) {
  const runStart = run.paraStart;
  const runEnd = run.paraEnd;

  const local = [];
  for (const ed of edits) {
    if (ed.end < runStart) continue;
    if (ed.start > runEnd) continue;
    if (ed.start === ed.end) {
      if (ed.start <= runStart || ed.start > runEnd) continue;
    } else {
      if (ed.end <= runStart) continue;
      if (ed.start >= runEnd) continue;
    }
    local.push(ed);
  }

  const headInsertsBefore = edgeInsertsBefore.get(runStart) || [];

  if (local.length === 0 && headInsertsBefore.length === 0) {
    return run.raw;
  }

  const pieces = [];

  for (const ed of headInsertsBefore) {
    if (ed.__consumed) continue;
    const inserted = ed.build({ rPr: run.rPr, kind: 'insert' });
    if (inserted) pieces.push(inserted);
    ed.__consumed = true;
  }

  let cursor = 0;
  const runText = run.text;
  for (const ed of local) {
    const localStart = Math.max(ed.start, runStart) - runStart;
    const localEnd = Math.min(ed.end, runEnd) - runStart;

    if (localStart > cursor) {
      pieces.push(buildPlainRun(runText.slice(cursor, localStart), run.rPr));
    }

    if (ed.start === ed.end) {
      if (!ed.__consumed) {
        const inserted = ed.build({ rPr: run.rPr, kind: 'insert' });
        if (inserted) pieces.push(inserted);
        ed.__consumed = true;
      }
    } else {
      const isHead = ed.start >= runStart && ed.start < runEnd;
      if (isHead && !ed.__consumed) {
        const removedText = runText.slice(localStart, localEnd);
        const built = ed.build({
          rPr: run.rPr,
          kind: 'splice',
          removed: para.text.slice(ed.start, ed.end),
          firstChunkText: removedText,
        });
        if (built) pieces.push(built);
        ed.__consumed = true;
      }
      cursor = localEnd;
      continue;
    }

    cursor = localEnd;
  }

  if (cursor < runText.length) {
    pieces.push(buildPlainRun(runText.slice(cursor), run.rPr));
  }

  if (pieces.length === 0) return '';
  return pieces.join('');
}

function buildPlainRun(text, rPr) {
  if (!text) return '';
  return `<w:r>${rPr}${buildText(text)}</w:r>`;
}

export function buildInsertedRun(text, rPr, { ins } = {}) {
  if (!ins) return buildPlainRun(text, rPr);
  const { id, author, date } = ins;
  return (
    `<w:ins w:id="${id}" w:author="${xmlEscape(author)}" w:date="${date}">` +
      buildPlainRun(text, rPr) +
    `</w:ins>`
  );
}

export function buildDeletedRun(text, rPr, { del } = {}) {
  if (!del) return '';
  const { id, author, date } = del;
  return (
    `<w:del w:id="${id}" w:author="${xmlEscape(author)}" w:date="${date}">` +
      `<w:r>${rPr}<w:delText xml:space="preserve">${xmlEscape(text)}</w:delText></w:r>` +
    `</w:del>`
  );
}
