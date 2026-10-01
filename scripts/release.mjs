// Local release: node scripts/release.mjs [--dry]
// Builds the installer, tags the commit, publishes a GitHub release with exe + blockmap + latest.yml, then verifies the update feed.
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

const dry = process.argv.includes('--dry');
const repo = 'Han034/ForceStudio';
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const tag = `v${version}`;
const run = (cmd, opts = {}) => execSync(cmd, { stdio: 'inherit', ...opts });
const out = cmd => execSync(cmd, { encoding: 'utf8' }).trim();

if (out('git status --porcelain')) throw new Error('Commit your changes first (working tree is not clean).');
if (JSON.parse(out(`gh release list --repo ${repo} --json tagName`)).some(r => r.tagName === tag)) throw new Error(`${tag} already exists on GitHub - bump "version" in package.json first.`);

run('npm run dist');
const files = [`out/ForceStudio-Setup-${version}.exe`, `out/ForceStudio-Setup-${version}.exe.blockmap`, 'out/latest.yml'];
for (const f of files) if (!existsSync(f)) throw new Error(`Missing build output: ${f}`);
if (dry) { console.log(`dry run OK: would publish ${tag}`); process.exit(0); }

run(`git tag ${tag}`);
run(`git push origin HEAD ${tag}`);
run(`gh release create ${tag} ${files.map(f => `"${f}"`).join(' ')} --repo ${repo} --title "Force Studio ${version}" --latest --notes "Force Studio ${version}"`);

const feed = out(`curl -sL https://github.com/${repo}/releases/latest/download/latest.yml`);
if (!feed.includes(`version: ${version}`)) throw new Error('Release published, but the update feed does not show the new version yet.');
console.log(`\nPublished ${tag}; update feed OK.`);
