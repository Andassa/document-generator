/**
 * Benchmark lot de documents : par défaut POST /api/documents/batch (userIds) + polling GET alignés sujet.
 * Variante legacy : BENCHMARK_LEGACY_BATCH=1 → POST /batch + { documents }.
 *
 * Produit benchmark-report.json + benchmark-series.csv (courbes).
 *
 * Variables d'environnement :
 *   BASE_URL                 (défaut http://127.0.0.1:3000)
 *   BATCH_COUNT              (défaut 1000)
 *   POLL_MS                  (défaut 2000)
 *   BATCH_TIMEOUT_MS         (défaut 1800000 = 30 min)
 *   REPORT_PATH, SERIES_CSV_PATH
 *   BENCHMARK_LEGACY_BATCH   (défaut 0) → 1 pour /batch + documents[]
 *   BENCHMARK_CSV_DELIMITER  (défaut ,) → mettre ; pour Excel français (colonnes dans A,B,C…)
 *
 * Usage : npm run benchmark:batch
 * Prérequis : API + worker + Redis + Mongo, BATCH_MAX_DOCUMENTS >= BATCH_COUNT
 *
 * CPU/RAM dans le rapport = processus Node de ce script (client). Pour API/worker : /metrics, Prometheus, docker stats.
 */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const COUNT = Math.min(
  parseInt(process.env.BATCH_COUNT ?? '1000', 10),
  5000,
);
const POLL_MS = parseInt(process.env.POLL_MS ?? '2000', 10);
const TIMEOUT_MS = parseInt(
  process.env.BATCH_TIMEOUT_MS ?? String(30 * 60 * 1000),
  10,
);
const REPORT_PATH = resolve(
  __dirname,
  '..',
  process.env.REPORT_PATH ?? 'benchmark-report.json',
);
const SERIES_CSV_PATH = resolve(
  __dirname,
  '..',
  process.env.SERIES_CSV_PATH ?? 'benchmark-series.csv',
);
const LEGACY = process.env.BENCHMARK_LEGACY_BATCH === '1';
const CSV_SEP = process.env.BENCHMARK_CSV_DELIMITER ?? ',';

function buildDocuments(n) {
  return Array.from({ length: n }, (_, i) => ({
    title: `Benchmark ${i + 1}`,
    content: `Contenu synthétique pour le document ${i + 1}. `.repeat(5),
  }));
}

function buildUserIds(n) {
  return Array.from({ length: n }, (_, i) => `bench-user-${String(i + 1)}`);
}

function appendSample(samples, t0, batchStatus, completed, failed) {
  const elapsedSec = (performance.now() - t0) / 1000;
  const mu = process.memoryUsage();
  samples.push({
    elapsedSec: Number(elapsedSec.toFixed(3)),
    batchStatus,
    completed,
    failed,
    heapUsedMb: Number((mu.heapUsed / 1024 / 1024).toFixed(2)),
    rssMb: Number((mu.rss / 1024 / 1024).toFixed(2)),
  });
}

function writeSeriesCsv(samples) {
  const sep = CSV_SEP;
  const header = `elapsed_sec${sep}batch_status${sep}completed${sep}failed${sep}heap_used_mb${sep}rss_mb\n`;
  const rows = samples
    .map(
      (s) =>
        `${s.elapsedSec}${sep}${s.batchStatus}${sep}${s.completed}${sep}${s.failed}${sep}${s.heapUsedMb}${sep}${s.rssMb}`,
    )
    .join('\n');
  // BOM UTF-8 : Excel Windows reconnaît mieux l’encodage et les colonnes avec import ou ;
  writeFileSync(SERIES_CSV_PATH, `\uFEFF${header}${rows}\n`, 'utf8');
}

function cpuDeltaMs(cpuBefore) {
  const d = process.cpuUsage(cpuBefore);
  const userMs = d.user / 1000;
  const systemMs = d.system / 1000;
  return { userMs, systemMs, totalMs: userMs + systemMs };
}

async function main() {
  const memBefore = process.memoryUsage();
  const cpuBefore = process.cpuUsage();
  const samples = [];

  const postPath = LEGACY ? '/batch' : '/api/documents/batch';
  const getPath = (batchId) =>
    LEGACY ? `/batch/${batchId}` : `/api/documents/batch/${batchId}`;

  const body = LEGACY
    ? JSON.stringify({ documents: buildDocuments(COUNT) })
    : JSON.stringify({ userIds: buildUserIds(COUNT) });

  const t0 = performance.now();
  const res = await fetch(`${BASE}${postPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  const tPost = performance.now();
  const text = await res.text();
  if (!res.ok) {
    console.error(`POST ${postPath} échoué`, res.status, text.slice(0, 500));
    process.exit(1);
  }
  const { batchId, documentIds } = JSON.parse(text);
  console.log(
    `POST ${postPath} OK en ${((tPost - t0) / 1000).toFixed(2)} s — batchId=${batchId} — ${documentIds?.length ?? 0} documentIds`,
  );

  const tPollStart = performance.now();
  let lastStatus = '';
  let lastCompleted = 0;
  let lastFailed = 0;
  let pollN = 0;

  while (performance.now() - tPollStart < TIMEOUT_MS) {
    pollN += 1;
    const r = await fetch(`${BASE}${getPath(batchId)}`);
    if (!r.ok) {
      console.error(`GET ${getPath(batchId)}`, r.status, await r.text());
      process.exit(1);
    }
    const j = await r.json();
    lastStatus = j.status ?? '?';
    const docs = j.documents ?? [];
    let pending = 0;
    let processing = 0;
    for (const d of docs) {
      if (d.status === 'pending') pending += 1;
      else if (d.status === 'processing') processing += 1;
    }
    lastCompleted = docs.filter((d) => d.status === 'completed').length;
    lastFailed = docs.filter((d) => d.status === 'failed').length;
    appendSample(samples, t0, lastStatus, lastCompleted, lastFailed);
    const elapsedPoll = ((performance.now() - tPollStart) / 1000).toFixed(1);
    console.log(
      `[poll #${pollN} +${elapsedPoll}s] batch=${lastStatus} | completed ${lastCompleted}/${COUNT} | failed ${lastFailed} | pending ${pending} | processing ${processing}`,
    );
    if (pollN === 3 && lastCompleted === 0 && processing === 0 && pending >= COUNT) {
      console.warn(
        '→ Aucun document en traitement : le worker Bull est probablement arrêté. Lancez `npm run dev:worker` ou le service `worker` Docker.',
      );
    }
    if (
      lastStatus === 'completed' ||
      lastStatus === 'failed' ||
      lastStatus === 'partial'
    ) {
      break;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, POLL_MS));
  }

  const tEnd = performance.now();
  const memAfter = process.memoryUsage();

  const totalSec = (tEnd - t0) / 1000;
  const pollSec = (tEnd - tPollStart) / 1000;
  const postSec = (tPost - t0) / 1000;
  const throughput = COUNT / totalSec;
  const cpu = cpuDeltaMs(cpuBefore);

  console.log('\n--- Résumé ---');
  console.log('Statut final lot     :', lastStatus);
  console.log('Documents complétés  :', lastCompleted, '/', COUNT);
  console.log('Documents en échec   :', lastFailed);
  console.log(`Durée POST ${postPath.padEnd(28)}`, postSec.toFixed(2), 's');
  console.log('Durée polling        :', pollSec.toFixed(2), 's');
  console.log('Durée totale         :', totalSec.toFixed(2), 's');
  console.log('Débit (docs / s)     :', throughput.toFixed(2));
  console.log(
    'CPU processus script (user+sys, approx) :',
    cpu.totalMs.toFixed(0),
    'ms',
  );

  writeSeriesCsv(samples);

  const report = {
    generatedAt: new Date().toISOString(),
    apiContract: LEGACY
      ? 'POST /batch { documents[] } + GET /batch/:id'
      : 'POST /api/documents/batch { userIds[] } + GET /api/documents/batch/:batchId',
    measurementNote:
      'Temps total et débit = bout-en-bout côté client. CPU/RAM clientProcess = script Node uniquement. Pour charge API/worker : GET /metrics (ports 3000 et 9464), docker stats, etc.',
    baseUrl: BASE,
    batchCount: COUNT,
    batchId,
    finalBatchStatus: lastStatus,
    completed: lastCompleted,
    failed: lastFailed,
    seconds: {
      post: postSec,
      poll: pollSec,
      total: totalSec,
    },
    documentsPerSecond: throughput,
    clientProcess: {
      cpuUsageMs: {
        user: Number(cpu.userMs.toFixed(2)),
        system: Number(cpu.systemMs.toFixed(2)),
        total: Number(cpu.totalMs.toFixed(2)),
      },
      memoryMb: {
        heapUsedStart: Number((memBefore.heapUsed / 1024 / 1024).toFixed(2)),
        heapUsedEnd: Number((memAfter.heapUsed / 1024 / 1024).toFixed(2)),
        heapDelta: Number(
          ((memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024).toFixed(2),
        ),
        rssEnd: Number((memAfter.rss / 1024 / 1024).toFixed(2)),
      },
    },
    seriesSampleCount: samples.length,
    seriesCsvPath: SERIES_CSV_PATH,
    series: samples,
  };
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
  console.log('Rapport JSON écrit  :', REPORT_PATH);
  console.log('Série CSV (courbes) :', SERIES_CSV_PATH);

  if (lastStatus !== 'completed' || lastCompleted !== COUNT) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
