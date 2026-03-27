import request from 'supertest';
import type { Application } from 'express';
import { createApp } from './app';
import { checkHealth } from './services/health.service';
import { createBatch, getBatchById } from './services/batch.service';
import { streamDocumentPdf } from './services/document.service';
jest.mock('./services/health.service', () => ({
  checkHealth: jest.fn(),
}));

jest.mock('./services/batch.service', () => ({
  createBatch: jest.fn(),
  getBatchById: jest.fn(),
}));

jest.mock('./services/document.service', () => ({
  streamDocumentPdf: jest.fn(),
}));

const mockedCheckHealth = jest.mocked(checkHealth);
const mockedCreateBatch = jest.mocked(createBatch);
const mockedGetBatchById = jest.mocked(getBatchById);
const mockedStreamDocumentPdf = jest.mocked(streamDocumentPdf);

describe('Application Express', () => {
  let app: Application;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedCheckHealth.mockResolvedValue({ ok: true, mongo: true, redis: true });
    mockedCreateBatch.mockResolvedValue({
      batchId: '507f1f77bcf86cd799439011',
      documentIds: ['507f1f77bcf86cd799439012'],
    });
    mockedGetBatchById.mockResolvedValue({
      batchId: '507f1f77bcf86cd799439011',
      status: 'processing',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      documents: [
        {
          documentId: '507f1f77bcf86cd799439012',
          title: 'Titre',
          status: 'pending',
        },
      ],
    });
    mockedStreamDocumentPdf.mockImplementation(async (_id, res) => {
      res.status(200).type('application/pdf').send(Buffer.from('%PDF-mock'));
    });
    app = createApp();
  });

  it('GET /health renvoie 200 lorsque le service signale OK', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(mockedCheckHealth).toHaveBeenCalled();
    expect(res.body.status).toBe('ok');
  });

  it('GET /health renvoie 503 lorsque le service signale une dégradation', async () => {
    mockedCheckHealth.mockResolvedValueOnce({ ok: false, mongo: true, redis: false });
    const res = await request(app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
  });

  it('GET /metrics renvoie les métriques Prometheus', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain|openmetrics/);
    expect(res.text.length).toBeGreaterThan(0);
  });

  it('POST /batch valide le corps et délègue au service', async () => {
    const res = await request(app)
      .post('/batch')
      .send({ documents: [{ title: 'A', content: 'B' }] });
    expect(res.status).toBe(202);
    expect(mockedCreateBatch).toHaveBeenCalled();
    expect(res.body.batchId).toBe('507f1f77bcf86cd799439011');
  });

  it('POST /batch renvoie 400 si la validation échoue', async () => {
    const res = await request(app).post('/batch').send({ documents: [] });
    expect(res.status).toBe(400);
    expect(mockedCreateBatch).not.toHaveBeenCalled();
  });

  it('GET /batch/:id délègue au service', async () => {
    const res = await request(app).get('/batch/507f1f77bcf86cd799439011');
    expect(res.status).toBe(200);
    expect(mockedGetBatchById).toHaveBeenCalledWith('507f1f77bcf86cd799439011', expect.any(Object));
  });

  it('GET /:documentId délègue au service pour un ObjectId valide', async () => {
    const res = await request(app).get('/507f1f77bcf86cd799439012');
    expect(res.status).toBe(200);
    expect(mockedStreamDocumentPdf).toHaveBeenCalled();
  });
});
