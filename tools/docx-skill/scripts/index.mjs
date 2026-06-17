export { loadDocx, saveDocx, readText, writeText, listFiles } from './core/zip.mjs';
export { inspectDocx, outline, dump, find, aiContext } from './inspect.mjs';
export { apply, formatReport } from './apply.mjs';
export { indexParagraphs, listParagraphs, parseParagraph, spliceParagraph, findInParagraph } from './model/paragraph.mjs';
export { buildOutline, tocText } from './model/outline.mjs';
export { locate, describeLocator } from './ops/locate.mjs';
export { setHeader, getHeaders } from './ops/header.mjs';
