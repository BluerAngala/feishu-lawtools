import { readText, writeText } from './zip.mjs';
import { getAttr, xmlEscape } from './xml.mjs';

const CT_PATH = '[Content_Types].xml';
const RELS_PATH = 'word/_rels/document.xml.rels';

export async function ensureContentType(zip, partName, contentType) {
  const xml = await readText(zip, CT_PATH);
  if (!xml) return false;
  const partRe = new RegExp(
    `<Override\\s+[^>]*PartName="${partName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^/]*/>`
  );
  if (partRe.test(xml)) return false;
  const insertion = `<Override PartName="${xmlEscape(partName)}" ContentType="${xmlEscape(contentType)}"/>`;
  const next = xml.replace(/<\/Types>\s*$/, `${insertion}</Types>`);
  writeText(zip, CT_PATH, next);
  return true;
}

export async function listRelationships(zip, relsPath = RELS_PATH) {
  const xml = await readText(zip, relsPath);
  if (!xml) return [];
  const out = [];
  const re = /<Relationship\b[^/]*\/>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    out.push({
      Id: getAttr(m[0], 'Id'),
      Type: getAttr(m[0], 'Type'),
      Target: getAttr(m[0], 'Target'),
      raw: m[0],
    });
  }
  return out;
}

export async function ensureRelationship(zip, target, relType, relsPath = RELS_PATH) {
  const xml = await readText(zip, relsPath);
  if (!xml) return null;
  const list = await listRelationships(zip, relsPath);
  const exist = list.find((r) => r.Target === target && r.Type === relType);
  if (exist) return exist.Id;

  let max = 0;
  for (const r of list) {
    const m = /rId(\d+)/.exec(r.Id || '');
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const newId = `rId${max + 1}`;
  const insertion = `<Relationship Id="${newId}" Type="${xmlEscape(relType)}" Target="${xmlEscape(target)}"/>`;
  const next = xml.replace(/<\/Relationships>\s*$/, `${insertion}</Relationships>`);
  writeText(zip, relsPath, next);
  return newId;
}

export const REL_TYPES = {
  comments: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments',
  commentsExtended:
    'http://schemas.microsoft.com/office/2011/relationships/commentsExtended',
  header: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/header',
  footer: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer',
  people: 'http://schemas.microsoft.com/office/2011/relationships/people',
};

export const CONTENT_TYPES = {
  comments: 'application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml',
  header: 'application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml',
  footer: 'application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml',
  people: 'application/vnd.openxmlformats-officedocument.wordprocessingml.people+xml',
};
