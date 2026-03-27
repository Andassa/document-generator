/**
 * Convertit benchmark-series.csv (virgules) → benchmark-series-excel-fr.csv (point-virgule + BOM).
 * À lancer depuis la racine du projet si tout s’affiche dans la cellule A1 sous Excel français.
 *
 * Usage : node scripts/benchmark-csv-for-excel-fr.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const src = resolve(__dirname, '..', 'benchmark-series.csv');
const dest = resolve(__dirname, '..', 'benchmark-series-excel-fr.csv');

const raw = readFileSync(src, 'utf8').replace(/^\uFEFF/, '');
const lines = raw.trim().split(/\r?\n/);
const out = lines.map((line) => line.split(',').join(';')).join('\r\n');
writeFileSync(dest, `\uFEFF${out}\r\n`, 'utf8');
console.log('Écrit :', dest);
console.log('Ouvre ce fichier dans Excel : les colonnes doivent être en A, B, C…');
