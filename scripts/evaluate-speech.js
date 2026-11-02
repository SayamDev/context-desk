import fs from 'node:fs/promises';import {speechMetrics} from '../lib/evaluation.js';
const [reference,hypothesis,...options]=process.argv.slice(2);if(!reference||!hypothesis){console.error('Usage: node scripts/evaluate-speech.js reference.txt hypothesis.txt [--strip-diacritics]');process.exit(1)}
console.log(JSON.stringify(speechMetrics(await fs.readFile(reference,'utf8'),await fs.readFile(hypothesis,'utf8'),{stripDiacritics:options.includes('--strip-diacritics')}),null,2));
