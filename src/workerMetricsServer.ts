import http from 'node:http';
import { registry } from './utils/metrics';
import { rootLogger } from './utils/logger';

export function startWorkerMetricsServer(port: number): http.Server {
  const server = http.createServer((req, res) => {
    if (req.method !== 'GET') {
      res.statusCode = 405;
      res.end();
      return;
    }
    const path = req.url?.split('?')[0] ?? '';
    if (path !== '/metrics') {
      res.statusCode = 404;
      res.end();
      return;
    }
    void registry.metrics().then(
      (body) => {
        res.setHeader('Content-Type', registry.contentType);
        res.statusCode = 200;
        res.end(body);
      },
      (err: unknown) => {
        res.statusCode = 500;
        res.end(err instanceof Error ? err.message : String(err));
      },
    );
  });
  server.listen(port, () => {
    rootLogger.info('Worker : endpoint Prometheus', { path: '/metrics', port });
  });
  return server;
}

export async function closeWorkerMetricsServer(server: http.Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}
