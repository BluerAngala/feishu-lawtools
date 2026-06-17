import { readText, writeText } from '../core/zip.mjs';
import { ensureContentType, ensureRelationship, REL_TYPES, CONTENT_TYPES } from '../core/relations.mjs';
import { xmlEscape, RE } from '../core/xml.mjs';

const W_HDR_NS =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

function defaultHeaderXml(text) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr ${W_HDR_NS}>
  <w:p>
    <w:pPr>
      <w:jc w:val="right"/>
      <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="SimSun" w:hint="eastAsia"/><w:sz w:val="18"/></w:rPr>
    </w:pPr>
    <w:r>
      <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="SimSun" w:hint="eastAsia"/><w:sz w:val="18"/></w:rPr>
      <w:t xml:space="preserve">${xmlEscape(text)}</w:t>
    </w:r>
  </w:p>
</w:hdr>`;
}

function pickFreeHeaderName(existingFiles) {
  for (let i = 1; i <= 99; i++) {
    const name = `header${i}.xml`;
    if (!existingFiles.includes(`word/${name}`)) return name;
  }
  throw new Error('no free header file slot');
}

export async function setHeader(zip, text, { type = 'default', mode = 'replace' } = {}) {
  if (!text) throw new Error('setHeader: text required');

  const docXml = await readText(zip, 'word/document.xml');
  if (!docXml) throw new Error('setHeader: word/document.xml missing');

  const existingFiles = Object.keys(zip.files);
  const headerName = pickFreeHeaderName(existingFiles);
  const headerPath = `word/${headerName}`;
  writeText(zip, headerPath, defaultHeaderXml(text));

  const rId = await ensureRelationship(zip, headerName, REL_TYPES.header);
  await ensureContentType(zip, `/${headerPath}`, CONTENT_TYPES.header);

  const newDocXml = attachHeaderRefToSectPrs(docXml, rId, type, mode);
  writeText(zip, 'word/document.xml', newDocXml);

  return { headerPath, rId };
}

function attachHeaderRefToSectPrs(docXml, rId, type, mode) {
  const ref = `<w:headerReference w:type="${type}" r:id="${rId}"/>`;

  let touched = 0;
  const next = docXml.replace(RE.sectPr, (sectXml) => {
    touched++;
    const stripped = mode === 'replace'
      ? sectXml.replace(
          new RegExp(`<w:headerReference\\b[^/]*w:type="${type}"[^/]*/>`, 'g'),
          '',
        )
      : sectXml;

    const isSelfClose = !stripped.endsWith('</w:sectPr>');
    if (isSelfClose) {
      return stripped.replace(/<w:sectPr\b([^>]*)\/>$/, `<w:sectPr$1>${ref}</w:sectPr>`);
    }
    return stripped.replace(/^<w:sectPr\b([^>]*)>/, `<w:sectPr$1>${ref}`);
  });

  if (touched === 0) {
    const fallback =
      `<w:sectPr>${ref}<w:pgSz w:w="11906" w:h="16838"/>` +
      `<w:pgMar w:top="1440" w:right="1800" w:bottom="1440" w:left="1800" w:header="851" w:footer="992" w:gutter="0"/>` +
      `<w:cols w:space="425"/></w:sectPr>`;
    return next.replace(/<\/w:body>\s*<\/w:document>\s*$/, `${fallback}</w:body></w:document>`);
  }
  return next;
}

export async function getHeaders(zip) {
  const out = [];
  for (const path of Object.keys(zip.files)) {
    if (!/^word\/header\d*\.xml$/.test(path)) continue;
    const xml = await readText(zip, path);
    let text = '';
    const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
    let m;
    while ((m = re.exec(xml)) !== null) text += m[1];
    out.push({ path, text });
  }
  return out;
}
