import type { Histogram } from 'prom-client';
import {
  batchProcessingDurationSeconds,
  documentsGeneratedTotal,
  queueSize,
} from '../utils/metrics';

function sumCounterValues(getResult: { values: Array<{ value: number }> }): number {
  return getResult.values.reduce((a, v) => a + v.value, 0);
}

function firstGaugeValue(getResult: { values: Array<{ value: number }> }): number {
  return getResult.values[0]?.value ?? 0;
}

function histogramTotals(h: Awaited<ReturnType<Histogram['get']>>): { count: number; sum: number } {
  let count = 0;
  let sum = 0;
  for (const v of h.values) {
    const mn = 'metricName' in v ? String((v as { metricName?: string }).metricName) : '';
    if (mn.endsWith('_count')) {
      count += v.value;
    } else if (mn.endsWith('_sum')) {
      sum += v.value;
    }
  }
  return { count, sum };
}

/** Résumé texte des métriques clés du sujet (registre du processus courant). */
export async function buildObservabilityTextSummary(): Promise<string> {
  const doc = await documentsGeneratedTotal.get();
  const q = await queueSize.get();
  const batch = await batchProcessingDurationSeconds.get();
  const { count, sum } = histogramTotals(batch);
  const lines = [
    '# Observabilité — instantané (registre Prometheus de ce processus)',
    '',
    '# Métriques clés (sujet)',
    `documents_generated_total ${String(sumCounterValues(doc))}`,
    `queue_size ${String(firstGaugeValue(q))}`,
    `batch_processing_duration_seconds_count ${String(count)}`,
    `batch_processing_duration_seconds_sum_seconds ${String(sum)}`,
    '',
    '# Notes',
    '- Les PDF incrémentent surtout `documents_generated_total` et `batch_processing_duration_seconds` dans le **worker** (GET /metrics sur WORKER_METRICS_PORT, ex. :9464).',
    '- L’API met à jour typiquement `queue_size` (sondage Redis) et les métriques HTTP.',
    '- Export brut Prometheus : GET /metrics',
    '',
    '# Exemples PromQL (Grafana / Prometheus)',
    'rate(documents_generated_total[5m])',
    'histogram_quantile(0.95, sum(rate(batch_processing_duration_seconds_bucket[5m])) by (le, outcome))',
    'queue_size',
  ];
  return `${lines.join('\n')}\n`;
}
