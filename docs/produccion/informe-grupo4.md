# Informe de verificacion y entrega - Grupo 4

## Fase 4: Verificar y entregar

Este informe resume la verificacion tecnica realizada sobre la infraestructura productiva implementada para Alentapp.

El objetivo de esta fase es demostrar que los Dockerfiles productivos, el `docker-compose.prod.yml`, las medidas de seguridad y el entorno de ejecucion funcionan correctamente

Ademas, se documenta la integracion de la observabilidad sobre la API: la instrumentacion con OpenTelemetry para exponer metricas RED, la configuracion de Prometheus para scrapear el endpoint de la API y el dashboard RED en Grafana con seis paneles funcionales que reflejan el comportamiento del sistema en tiempo real

## 4.1. Verificacion tecnica

### Tabla de metricas

| Metrica | Antes (desarrollo) | Despues (produccion) | Mejora |
|---|---:|---:|---|
| Tamano imagen API | `alentapp-api:latest` = `1.54GB` | `alentapp-api:prod` = `394MB` | Reduccion aproximada de `74.4%` |
| Tamano imagen Web | `alentapp-web:latest` = `873MB` | `alentapp-web:prod` = `93.7MB` | Reduccion aproximada de `89.3%` |
| Tiempo de startup API | `738.8s` | `64.091s` | Reduccion aproximada de `91.3%` |
| Memoria API (idle) | `alentapp-api` = `199.8MiB / 2.85GiB` | `alentapp-api-prod` = `47.05MiB / 512MiB` | Reduccion aproximada de `76.5%` |
| Endpoints accesibles | API de desarrollo en `:3000` | Endpoints productivos responden `200` | Produccion validada |
| Frontend via nginx | No aplica en desarrollo, se usaba Vite | `alentapp-web-prod` responde en puerto `80` | Se reemplaza Vite por nginx |

### Evidencia de tamanos de imagen

Comando utilizado:

```bash
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
```

Resultado relevante:

```text
alentapp-api  prod    394MB
alentapp-web  prod    93.7MB
alentapp-web  latest  873MB
alentapp-api  latest  1.54GB
```

### Evidencia de tiempo de startup API

Comando utilizado para medir desarrollo:

```bash
time sh -c 'docker compose up -d api && until curl -s http://localhost:3000/health > /dev/null; do sleep 1; done'
```

Resultado:

```text
real 738.8s
```

Comando utilizado para medir produccion:

```bash
time sh -c 'docker compose --env-file .env.example -f docker-compose.prod.yml -p alentapp-prod up -d api && until curl -s http://localhost:3000/health > /dev/null; do sleep 1; done'
```

Resultado:

```text
real 1m4.091s
```

La medicion se toma hasta que el endpoint `/health` responde correctamente, porque ese punto indica que la API esta lista para recibir trafico.

### Evidencia de memoria idle

Comando utilizado para medir desarrollo:

```bash
docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}" alentapp-api
```

Resultado:

```text
NAME           MEM USAGE / LIMIT
alentapp-api   199.8MiB / 2.85GiB
```

Comando utilizado para medir produccion:

```bash
docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}" alentapp-api-prod
```

Resultado:

```text
NAME                MEM USAGE / LIMIT
alentapp-api-prod   47.05MiB / 512MiB
```

La medicion se hizo con la API en reposo, luego de confirmar que `/health` respondia correctamente.

### Evidencia de healthchecks

Comando utilizado:

```bash
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"
```

Resultado relevante:

```text
alentapp-web-prod  alentapp-web:prod    Up ... (healthy)
alentapp-api-prod  alentapp-api:prod    Up ... (healthy)
alentapp-db-prod   postgres:16-alpine   Up ... (healthy)
```

### Evidencia de endpoints accesibles

Comando utilizado dentro del contenedor de la API:

```bash
docker exec alentapp-api-prod node -e "const urls=['/health','/api/v1/socios','/api/v1/lockers','/api/v1/medical-certificates','/api/v1/sports','/api/v1/equipment-loans']; for (const u of urls) { const r = await fetch('http://127.0.0.1:3000'+u); console.log(u, r.status); }"
```

Resultado:

```text
/health 200
/api/v1/socios 200
/api/v1/lockers 200
/api/v1/medical-certificates 200
/api/v1/sports 200
/api/v1/equipment-loans 200
```

### Evidencia del frontend via nginx

El frontend productivo corre en el contenedor:

```text
alentapp-web-prod
```

La imagen final usa nginx y expone el puerto `80`, no el puerto `5173` de Vite.

Se valido que el contenedor queda `healthy` y que nginx responde correctamente en:

```text
http://127.0.0.1:80/
```