import type { Job } from 'bull';
import type { PdfJobPayload } from '../types/pdf';

type QueuedItem = { id: string; data: PdfJobPayload };

/**
 * File minimale en RAM pour QUEUE_BACKEND=memory (API et worker dans le même processus).
 * Ne remplace pas Redis entre processus distincts.
 */
export class InMemoryPdfQueue {
  private readonly waiting: QueuedItem[] = [];
  private active = 0;
  private concurrency = 1;
  private handler: ((job: Job<PdfJobPayload>) => Promise<void>) | null = null;
  private nextId = 1;
  private closed = false;

  add(name: string, data: PdfJobPayload, _opts?: unknown): Promise<Job<PdfJobPayload>> {
    if (name !== 'generate') {
      throw new Error(`Type de job inconnu: ${name}`);
    }
    if (this.closed) {
      return Promise.reject(new Error('File PDF fermée'));
    }
    const id = String(this.nextId++);
    this.waiting.push({ id, data });
    this.pump();
    return Promise.resolve({ id, data } as unknown as Job<PdfJobPayload>);
  }

  process(name: string, concurrency: number, handler: (job: Job<PdfJobPayload>) => Promise<void>): void {
    if (name !== 'generate') {
      throw new Error(`Type de job inconnu: ${name}`);
    }
    this.concurrency = concurrency;
    this.handler = handler;
    this.pump();
  }

  async getJobCounts(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  }> {
    return {
      waiting: this.waiting.length,
      active: this.active,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: 0,
    };
  }

  async close(): Promise<void> {
    this.closed = true;
    const deadline = Date.now() + 60_000;
    while (this.active > 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  private pump(): void {
    if (this.closed || !this.handler) {
      return;
    }
    while (this.active < this.concurrency && this.waiting.length > 0) {
      const item = this.waiting.shift();
      if (!item) {
        break;
      }
      this.active++;
      const job = { id: item.id, data: item.data } as unknown as Job<PdfJobPayload>;
      const h = this.handler;
      void h(job)
        .catch(() => undefined)
        .finally(() => {
          this.active--;
          this.pump();
        });
    }
  }
}
