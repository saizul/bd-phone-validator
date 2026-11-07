import { readFileSync, writeFileSync } from 'node:fs';
import { runCli } from './cli';

const code = runCli(process.argv.slice(2), {
  readFile: (p) => readFileSync(p, 'utf8'),
  readStdin: () => {
    try {
      return readFileSync(0, 'utf8');
    } catch {
      return '';
    }
  },
  writeFile: (p, d) => writeFileSync(p, d, 'utf8'),
  stdout: (t) => process.stdout.write(t),
  stderr: (t) => process.stderr.write(t),
});
process.exitCode = code;
