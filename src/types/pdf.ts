export interface PdfWorkerStartMessage {
  type: 'start';
  title: string;
  content: string;
}

export type PdfWorkerParentMessage =
  | { type: 'chunk'; buf: Buffer }
  | { type: 'done'; byteLength: number }
  | { type: 'error'; message: string };

export interface PdfJobPayload {
  documentId: string;
  batchId: string;
  title: string;
  content: string;
  correlationId: string;
}
