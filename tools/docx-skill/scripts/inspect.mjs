import { loadDocx, readText, listFiles } from './core/zip.mjs';
import { listParagraphs } from './model/paragraph.mjs';
import { buildOutline } from './model/outline.mjs';
import { RE, getAttr } from './core/xml.mjs';

export async function inspectDocx(input) {
  const zip = await loadDocx(input);
  const docXml = await readText(zip, 'word/document.xml');
  if (!docXml) throw new Error('inspect: word/document.xml not found');

  const paragraphs = listParagraphs(docXml);
  const text = paragraphs.map((p) => p.text).join('\n');
  const tables = (docXml.match(/<w:tbl>/g) || []).length;
  const tableRows = (docXml.match(/<w:tr\b/g) || []).length;
  const tableCells = (docXml.match(/<w:tc\b/g) || []).length;
  const hyperlinks = (docXml.match(/<w:hyperlink\b/g) || []).length;
  const drawings = (docXml.match(/<w:drawing\b/g) || []).length;
  const sectPrs = (docXml.match(/<w:sectPr\b/g) || []).length;
  const commentsXml = await readText(zip, 'word/comments.xml');
  const comments = commentsXml ? (commentsXml.match(/<w:comment\b/g) || []).length : 0;
  const insMarks = (docXml.match(/<w:ins\b/g) || []).length;
  const delMarks = (docXml.match(/<w:del\b/g) || []).length;

  const headers = listFiles(zip).filter((p) => /^word\/header\d*\.xml$/.test(p));
  const footers = listFiles(zip).filter((p) => /^word\/footer\d*\.xml$/.test(p));

  return {
    paragraphs: paragraphs.length,
    runs: paragraphs.reduce((s, p) => s + p.runs.length, 0),
    chars: text.length,
    tables,
    tableRows,
    tableCells,
    hyperlinks,
    drawings,
    sectPrs,
    headerFiles: headers,
    footerFiles: footers,
    comments,
    revisionInsertions: insMarks,
    revisionDeletions: delMarks,
    headings: buildOutline(docXml).length,
  };
}

export async function outline(input) {
  const zip = await loadDocx(input);
  const docXml = await readText(zip, 'word/document.xml');
  if (!docXml) throw new Error('outline: word/document.xml not found');
  return buildOutline(docXml);
}

export async function dump(input, { includeEmpty = false } = {}) {
  const zip = await loadDocx(input);
  const docXml = await readText(zip, 'word/document.xml');
  if (!docXml) throw new Error('dump: word/document.xml not found');
  const paragraphs = listParagraphs(docXml);
  const out = paragraphs.map((p) => ({
    id: p.id,
    index: p.index,
    text: p.text,
    runs: p.runs.length,
    style: p.styleId,
    heading: p.headingLevel,
    isList: p.isList,
  }));
  return includeEmpty ? out : out.filter((p) => p.text.trim());
}

export async function find(input, needle, { regex = false, context = 20, includeEmpty = false } = {}) {
  const zip = await loadDocx(input);
  const docXml = await readText(zip, 'word/document.xml');
  if (!docXml) throw new Error('find: word/document.xml not found');
  const paragraphs = listParagraphs(docXml);
  const hits = [];
  let re = null;
  if (regex) {
    re = needle instanceof RegExp
      ? new RegExp(needle.source, needle.flags.includes('g') ? needle.flags : needle.flags + 'g')
      : new RegExp(needle, 'g');
  }
  for (const p of paragraphs) {
    if (!p.text && !includeEmpty) continue;
    if (regex) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(p.text)) !== null) {
        hits.push(mkHit(p, m.index, m.index + m[0].length, m[0], context));
        if (m.index === re.lastIndex) re.lastIndex++;
      }
    } else {
      const s = String(needle);
      if (!s) continue;
      let from = 0;
      while (true) {
        const idx = p.text.indexOf(s, from);
        if (idx === -1) break;
        hits.push(mkHit(p, idx, idx + s.length, s, context));
        from = idx + s.length;
      }
    }
  }
  return hits;
}

function mkHit(p, start, end, match, context) {
  const pre = p.text.slice(Math.max(0, start - context), start);
  const post = p.text.slice(end, Math.min(p.text.length, end + context));
  return {
    paragraphId: p.id,
    paragraphIndex: p.index,
    start,
    end,
    match,
    runsInParagraph: p.runs.length,
    context: `${pre}【${match}】${post}`,
  };
}

export async function aiContext(input, { paragraphLimit = 5000 } = {}) {
  const zip = await loadDocx(input);
  const docXml = await readText(zip, 'word/document.xml');
  if (!docXml) throw new Error('ai-context: word/document.xml not found');

  const paragraphs = listParagraphs(docXml);
  const outlineItems = buildOutline(docXml);

  const commentsXml = await readText(zip, 'word/comments.xml');
  const comments = [];
  if (commentsXml) {
    const re = /<w:comment\b([^>]*)>([\s\S]*?)<\/w:comment>/g;
    const textRe = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
    let m;
    while ((m = re.exec(commentsXml)) !== null) {
      const tag = '<x' + m[1] + '/>';
      const id = getAttr(tag, 'w:id');
      const author = getAttr(tag, 'w:author');
      const date = getAttr(tag, 'w:date');
      let text = '';
      textRe.lastIndex = 0;
      let tm;
      while ((tm = textRe.exec(m[2])) !== null) text += tm[1];
      comments.push({ id, author, date, text });
    }
  }

  const headers = listFiles(zip)
    .filter((p) => /^word\/header\d*\.xml$/.test(p))
    .sort();
  const headerSnippets = [];
  for (const h of headers) {
    const xml = await readText(zip, h);
    let text = '';
    const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
    let m;
    while ((m = re.exec(xml)) !== null) text += m[1];
    headerSnippets.push({ path: h, text });
  }

  return {
    summary: await inspectDocx(input),
    outline: outlineItems,
    headers: headerSnippets,
    comments,
    paragraphs: paragraphs.slice(0, paragraphLimit).map((p) => ({
      id: p.id,
      heading: p.headingLevel,
      style: p.styleId,
      isList: p.isList,
      runs: p.runs.length,
      text: p.text,
    })),
    paragraphCount: paragraphs.length,
    truncated: paragraphs.length > paragraphLimit,
  };
}
