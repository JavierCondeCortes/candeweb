import { readFile, readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const sourceRoot = join(projectRoot, 'src', 'app');
const translationRoot = join(sourceRoot, 'core', 'i18n', 'translations');
const domains = ['home', 'candeonato', 'admin'];
const languages = ['es', 'en'];

function flatten(value, prefix = '') {
  if (typeof value === 'string') return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    flatten(child, prefix ? `${prefix}.${key}` : key),
  );
}

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? sourceFiles(path) : [path];
    }),
  );
  return files.flat().filter((path) => ['.html', '.ts'].includes(extname(path)));
}

const dictionaries = new Map();
for (const language of languages) {
  for (const domain of domains) {
    const path = join(translationRoot, language, `${domain}_${language}.json`);
    const dictionary = JSON.parse(await readFile(path, 'utf8'));
    dictionaries.set(`${language}:${domain}`, new Set(flatten(dictionary)));
  }
}

const errors = [];
for (const domain of domains) {
  const spanish = dictionaries.get(`es:${domain}`);
  const english = dictionaries.get(`en:${domain}`);
  for (const key of spanish) {
    if (!english.has(key)) errors.push(`Missing en key: ${domain}.${key}`);
  }
  for (const key of english) {
    if (!spanish.has(key)) errors.push(`Missing es key: ${domain}.${key}`);
  }
}

const keyPattern = /['"]((home|candeonato|admin)\.[A-Za-z0-9_.-]+)['"]/g;
for (const path of await sourceFiles(sourceRoot)) {
  const source = await readFile(path, 'utf8');
  for (const match of source.matchAll(keyPattern)) {
    const [, fullKey, domain] = match;
    const localKey = fullKey.slice(domain.length + 1);
    if (localKey.endsWith('.')) continue;
    for (const language of languages) {
      if (!dictionaries.get(`${language}:${domain}`).has(localKey)) {
        errors.push(`${path}: missing ${language} key ${fullKey}`);
      }
    }
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log('i18n dictionaries are in sync and all static references exist.');
}
