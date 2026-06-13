export function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function xmlUnescape(s) {
  return String(s)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&');
}

export const RE = {
  paragraph: /<w:p\b[^>]*>[\s\S]*?<\/w:p>|<w:p\b[^>]*\/>/g,
  run: /<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>|<w:r(?:\s[^>]*)?\/>/g,
  text: /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g,
  delText: /<w:delText(?:\s[^>]*)?>([\s\S]*?)<\/w:delText>/g,
  pPr: /<w:pPr>[\s\S]*?<\/w:pPr>/,
  rPr: /<w:rPr>[\s\S]*?<\/w:rPr>/,
  pStyleVal: /<w:pStyle\s+w:val="([^"]+)"/,
  numPr: /<w:numPr>[\s\S]*?<\/w:numPr>/,
  sectPr: /<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>|<w:sectPr\b[^>]*\/>/g,
  table: /<w:tbl>[\s\S]*?<\/w:tbl>/g,
  hyperlink: /<w:hyperlink\b[^>]*>[\s\S]*?<\/w:hyperlink>/g,
  drawing: /<w:drawing\b[^>]*>[\s\S]*?<\/w:drawing>/g,
};

export function getAttr(tag, name) {
  const re = new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`);
  const m = tag.match(re);
  return m ? xmlUnescape(m[1]) : null;
}

export function matchAll(re, str) {
  const out = [];
  const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  let m;
  while ((m = r.exec(str)) !== null) {
    out.push({ match: m[0], groups: m.slice(1), index: m.index, end: m.index + m[0].length });
    if (m.index === r.lastIndex) r.lastIndex++;
  }
  return out;
}

export function firstMatch(re, str) {
  const m = str.match(re);
  return m ? { match: m[0], groups: m.slice(1), index: m.index, end: m.index + m[0].length } : null;
}

export function buildText(text, { preserveSpace = true } = {}) {
  const sp = preserveSpace ? ' xml:space="preserve"' : '';
  return `<w:t${sp}>${xmlEscape(text)}</w:t>`;
}

export function buildDelText(text) {
  return `<w:delText xml:space="preserve">${xmlEscape(text)}</w:delText>`;
}

export function buildRun(text, rPr = '<w:rPr/>') {
  return `<w:r>${rPr}${buildText(text)}</w:r>`;
}

export function buildDelRun(text, rPr = '<w:rPr/>') {
  return `<w:r>${rPr}${buildDelText(text)}</w:r>`;
}
