#!/usr/bin/env node
/**
 * docx — AI-friendly docx CLI
 *
 * Usage: node scripts/docx.mjs <command> [args]
 */

import { readFile } from 'node:fs/promises';
import { resolve as resolvePath } from 'node:path';
import { inspectDocx, outline, dump, find, aiContext } from './inspect.mjs';
import { apply, formatReport } from './apply.mjs';
import { getHeaders } from './ops/header.mjs';
import { loadDocx } from './core/zip.mjs';

const USAGE = `docx <command> [args]

Commands:
  inspect <file>                            Print document statistics (JSON)
  outline <file>                            Print heading outline
  dump <file> [--json|--md] [--all]         List paragraphs with stable IDs
  find <file> <needle> [--regex] [-c N]     Search text and report paragraph + offset
  ai-context <file> [--limit N]             Emit JSON snapshot for LLM
  headers <file>                            List headers and their text
  apply <file> <ops.json> [-o out.docx] [--dry-run] [--author NAME] [--date ISO]
  help                                      Show this help
`;

function parseFlags(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') flags.json = true;
    else if (a === '--md' || a === '--markdown') flags.md = true;
    else if (a === '--all') flags.all = true;
    else if (a === '--regex' || a === '-r') flags.regex = true;
    else if (a === '--dry-run' || a === '-n') flags.dryRun = true;
    else if (a === '--limit') flags.limit = parseInt(argv[++i], 10);
    else if (a === '-c' || a === '--context') flags.context = parseInt(argv[++i], 10);
    else if (a === '-o' || a === '--out') flags.out = argv[++i];
    else if (a === '--author') flags.author = argv[++i];
    else if (a === '--date') flags.date = argv[++i];
    else if (a === '--help' || a === '-h') flags.help = true;
    else positional.push(a);
  }
  return { flags, positional };
}

async function cmdInspect(args) {
  const file = args[0];
  if (!file) throw new Error('inspect: <file> required');
  const r = await inspectDocx(file);
  process.stdout.write(JSON.stringify(r, null, 2) + '\n');
}

async function cmdOutline(args) {
  const file = args[0];
  if (!file) throw new Error('outline: <file> required');
  const items = await outline(file);
  for (const it of items) {
    process.stdout.write(`${'  '.repeat(it.level - 1)}${it.text}  [${it.id}]\n`);
  }
}

async function cmdDump(args, flags) {
  const file = args[0];
  if (!file) throw new Error('dump: <file> required');
  const list = await dump(file, { includeEmpty: !!flags.all });
  if (flags.json) {
    process.stdout.write(JSON.stringify(list, null, 2) + '\n');
    return;
  }
  if (flags.md) {
    for (const p of list) {
      if (p.heading) process.stdout.write(`${'#'.repeat(p.heading)} ${p.text} <!-- ${p.id} -->\n\n`);
      else if (p.isList) process.stdout.write(`- ${p.text} <!-- ${p.id} -->\n`);
      else process.stdout.write(`${p.text}\n<!-- ${p.id} -->\n\n`);
    }
    return;
  }
  for (const p of list) {
    process.stdout.write(`[${p.id}] ${p.text}\n`);
  }
}

async function cmdFind(args, flags) {
  const file = args[0];
  const needle = args[1];
  if (!file || needle === undefined) throw new Error('find: <file> <needle> required');
  const hits = await find(file, needle, {
    regex: !!flags.regex,
    context: flags.context ?? 20,
  });
  if (flags.json) {
    process.stdout.write(JSON.stringify(hits, null, 2) + '\n');
    return;
  }
  for (const h of hits) {
    process.stdout.write(`${h.paragraphId} [${h.start},${h.end}) ${h.context}\n`);
  }
  process.stdout.write(`\nTotal: ${hits.length} hit(s)\n`);
}

async function cmdAiContext(args, flags) {
  const file = args[0];
  if (!file) throw new Error('ai-context: <file> required');
  const ctx = await aiContext(file, { paragraphLimit: flags.limit || 5000 });
  process.stdout.write(JSON.stringify(ctx, null, 2) + '\n');
}

async function cmdHeaders(args) {
  const file = args[0];
  if (!file) throw new Error('headers: <file> required');
  const zip = await loadDocx(file);
  const list = await getHeaders(zip);
  for (const h of list) {
    process.stdout.write(`${h.path}: ${JSON.stringify(h.text)}\n`);
  }
}

async function cmdApply(args, flags) {
  const file = args[0];
  const opsPath = args[1];
  if (!file || !opsPath) throw new Error('apply: <file> <ops.json> required');
  const opsRaw = await readFile(opsPath, 'utf-8');
  const opsJson = JSON.parse(opsRaw);
  const ops = Array.isArray(opsJson) ? opsJson : opsJson.ops || [];
  const meta = Array.isArray(opsJson) ? {} : opsJson.meta || {};

  const outPath = flags.out ? resolvePath(flags.out) : null;
  const result = await apply(file, ops, {
    dryRun: !!flags.dryRun,
    author: flags.author || meta.author,
    date: flags.date || meta.date,
    outPath,
  });
  process.stderr.write(formatReport(result.report) + '\n');
  if (!flags.dryRun && outPath) {
    process.stderr.write(`\nOutput: ${outPath}\n`);
  } else if (!flags.dryRun && !outPath) {
    process.stderr.write('\n(no -o specified, nothing written to disk)\n');
  }
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    process.stdout.write(USAGE);
    return;
  }
  const { flags, positional } = parseFlags(rest);
  try {
    switch (cmd) {
      case 'inspect':    return await cmdInspect(positional, flags);
      case 'outline':    return await cmdOutline(positional, flags);
      case 'dump':       return await cmdDump(positional, flags);
      case 'find':       return await cmdFind(positional, flags);
      case 'ai-context': return await cmdAiContext(positional, flags);
      case 'headers':    return await cmdHeaders(positional, flags);
      case 'apply':      return await cmdApply(positional, flags);
      default:
        process.stderr.write(`Unknown command: ${cmd}\n\n${USAGE}`);
        process.exit(1);
    }
  } catch (e) {
    process.stderr.write(`Error: ${e.message}\n`);
    if (process.env.DEBUG) process.stderr.write(e.stack + '\n');
    process.exit(1);
  }
}

main();
