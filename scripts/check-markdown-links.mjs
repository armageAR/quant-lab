import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const files = [
  'README.md',
  ...readdirSync('docs', { recursive: true })
    .filter((file) => file.endsWith('.md'))
    .map((file) => `docs/${file}`),
];
const failures = [];
const linkPattern = /\[[^\]]+\]\(([^)#]+)(?:#[^)]+)?\)/g;

for (const file of files) {
  const content = readFileSync(file, 'utf8');
  for (const match of content.matchAll(linkPattern)) {
    const link = match[1];
    if (
      link &&
      !/^(https?:\/\/|mailto:)/.test(link) &&
      !existsSync(resolve(dirname(file), link))
    ) {
      failures.push(`${file}: ${link}`);
    }
  }
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `All local Markdown links resolve (${files.length} files).\n`,
  );
}
