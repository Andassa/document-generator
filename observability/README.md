# Observabilité (Prometheus + Grafana)

## Métriques côté application

- **GET /metrics** (API sur le port HTTP, worker sur `WORKER_METRICS_PORT`, ex. 9464) — format Prometheus.
- **GET /observability** — résumé texte + rappels PromQL (registre du processus qui répond).

Les compteurs PDF (`documents_generated_total`, `batch_processing_duration_seconds`) sont surtout mis à jour par le **worker** ; l’API alimente notamment `queue_size` et les métriques HTTP.

## Démarrer Prometheus et Grafana (Docker)

Depuis la racine du dépôt :

```bash
docker compose -f docker-compose.yml -f docker-compose.observability.yml up -d
```

- Prometheus : http://localhost:9090  
- Grafana : http://localhost:3001 (compte par défaut `admin` / `admin`)

Le tableau de bord **Document generator — observabilité** est chargé automatiquement (dossier `grafana/dashboards`).

## Hors Docker

Configurez Prometheus pour scraper :

- `http://<hôte-api>:3000/metrics` (job `document-generator-api`),
- `http://<hôte-worker>:9464/metrics` (job `document-generator-worker`),

puis importez `grafana/dashboards/document-generator.json` dans Grafana (datasource Prometheus pointant vers votre Prometheus).
