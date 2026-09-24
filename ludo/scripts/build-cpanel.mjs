// Builds build/ludo-nova-cpanel.zip: a static site plus api.php that runs on
// any PHP 7.4+ host (cPanel public_html) with no Node.js or database.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'build', 'cpanel');
const zip = path.join(root, 'build', 'ludo-nova-cpanel.zip');

execFileSync('npx', ['vite', 'build', '--mode', 'php'], { cwd: root, stdio: 'inherit' });

for (const f of ['api.php', 'engine.php']) cpSync(path.join(root, 'php', f), path.join(out, f));
cpSync(path.join(root, 'php', 'static'), out, { recursive: true });
mkdirSync(path.join(out, 'data'), { recursive: true });
writeFileSync(path.join(out, 'data', 'index.html'), '');
writeFileSync(path.join(out, 'data', '.htaccess'),
  '<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\n  Deny from all\n</IfModule>\n');

if (existsSync(zip)) rmSync(zip);
execFileSync('zip', ['-r', '-X', '-q', zip, '.'], { cwd: out });
console.log(`\ncPanel package ready: ${path.relative(root, zip)}`);
