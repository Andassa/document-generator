import request from 'supertest';
import { createApp } from './app';

describe('Corps JSON invalide (body-parser)', () => {
  const app = createApp();

  it('POST /batch avec JSON mal formé renvoie 400 et INVALID_JSON', async () => {
    const res = await request(app)
      .post('/batch')
      .set('Content-Type', 'application/json')
      .send('{"documents":}');
    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe('INVALID_JSON');
    expect(typeof res.body.error?.message).toBe('string');
  });
});
