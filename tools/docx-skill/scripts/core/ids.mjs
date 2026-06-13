import { readText } from './zip.mjs';
import { RE, firstMatch, matchAll, getAttr } from './xml.mjs';

export class IdPool {
  constructor(start = 0) {
    this.next = start;
  }
  take() {
    return this.next++;
  }
  peek() {
    return this.next;
  }
}

export async function buildIdPool(zip) {
  let maxId = 0;

  const docXml = await readText(zip, 'word/document.xml');
  if (docXml) {
    for (const tag of ['w:commentRangeStart', 'w:commentReference', 'w:ins', 'w:del']) {
      const re = new RegExp(`<${tag}\\b[^>]*\\bw:id="(\\d+)"`, 'g');
      let m;
      while ((m = re.exec(docXml)) !== null) {
        const n = parseInt(m[1], 10);
        if (!Number.isNaN(n)) maxId = Math.max(maxId, n);
      }
    }
  }

  const commentsXml = await readText(zip, 'word/comments.xml');
  if (commentsXml) {
    const re = /<w:comment\b[^>]*\bw:id="(\d+)"/g;
    let m;
    while ((m = re.exec(commentsXml)) !== null) {
      const n = parseInt(m[1], 10);
      if (!Number.isNaN(n)) maxId = Math.max(maxId, n);
    }
  }

  return new IdPool(maxId + 1);
}
