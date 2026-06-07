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

Evidencia visual:

![Almacenamiento imagenes desarrollo](./evidencias/alamcenamiento%20imagenes%20dev.jpeg)

![Almacenamiento imagenes produccion](./evidencias/almacenamiento%20imagenes%20prod.jpeg)

### Evidencia de tiempo de startup API

Comando utilizado para medir desarrollo:

```bash
time sh -c 'docker compose up -d api && until curl -s http://localhost:3000/health > /dev/null; do sleep 1; done'
```

Resultado:

```text
real 738.8s
```

Evidencia visual:

![Tiempo startup desarrollo](./evidencias/tiempo%20star%20up%20dev.jpeg)

Comando utilizado para medir produccion:

```bash
time sh -c 'docker compose --env-file .env.example -f docker-compose.prod.yml -p alentapp-prod up -d api && until curl -s http://localhost:3000/health > /dev/null; do sleep 1; done'
```

Resultado:

```text
real 1m4.091s
```

Evidencia visual:

![Tiempo startup produccion](./evidencias/tiempo%20start%20up%20prod.jpeg)

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
## 4.2. Verificacion de seguridad

### API con usuario no-root

Comando:

```bash
docker exec alentapp-api-prod id
```

Resultado:

```text
uid=1000(node) gid=1000(node) groups=1000(node)
```

Conclusion: la API corre con el usuario `node`, no con `root`.

### Herramientas ausentes en la imagen final

Comando:

```bash
docker exec alentapp-api-prod sh -c "which npm || echo 'npm no esta instalado'; which npx || echo 'npx no esta instalado'; which tsc || echo 'tsc no esta instalado'; which python || echo 'python no esta instalado'; which python3 || echo 'python3 no esta instalado'"
```

Resultado:

```text
npm no esta instalado
npx no esta instalado
tsc no esta instalado
python no esta instalado
python3 no esta instalado
```

Conclusion: la imagen final no contiene herramientas de desarrollo o scripting innecesarias.

### Filesystem read-only

Comando:

```bash
docker exec alentapp-api-prod sh -c "touch /test 2>/dev/null && echo 'filesystem escribible' || echo 'filesystem read-only confirmado'"
```

Resultado:

```text
filesystem read-only confirmado
```

Conclusion: el filesystem del contenedor de la API esta en modo solo lectura.

### Capabilities minimas

Comando:

```bash
docker exec alentapp-api-prod sh -c "ping -c 1 127.0.0.1 >/dev/null 2>&1 && echo 'ping permitido' || echo 'ping bloqueado/no disponible'; mount -t tmpfs tmpfs /mnt >/dev/null 2>&1 && echo 'mount permitido' || echo 'mount bloqueado'"
```

Resultado:

```text
ping bloqueado/no disponible
mount bloqueado
```

Tambien se inspecciono la configuracion del contenedor:

```bash
docker inspect alentapp-api-prod --format 'Readonly={{.HostConfig.ReadonlyRootfs}} CapDrop={{json .HostConfig.CapDrop}} CapAdd={{json .HostConfig.CapAdd}} SecurityOpt={{json .HostConfig.SecurityOpt}} User={{json .Config.User}}'
```

Resultado:

```text
Readonly=true CapDrop=["ALL"] CapAdd=null SecurityOpt=["no-new-privileges=true"] User="node"
```

Conclusion: la API corre con capabilities reducidas, sin capabilities agregadas y con `no-new-privileges=true`.

### Variables sensibles via `.env`

En `docker-compose.prod.yml` no se escriben credenciales directamente. Se usan variables requeridas:

```yaml
POSTGRES_USER: ${POSTGRES_USER:?POSTGRES_USER is required}
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}
POSTGRES_DB: ${POSTGRES_DB:?POSTGRES_DB is required}
DATABASE_URL: ${DATABASE_URL:?DATABASE_URL is required}
```

El archivo `.env.example` solo contiene valores de ejemplo para documentar que variables se necesitan.

Conclusion: las variables sensibles se leen desde entorno externo y no quedan hardcodeadas en el compose productivo.

### Healthchecks funcionando

Se verifico con `docker ps` que los servicios principales quedan en estado `healthy`:

```text
alentapp-web-prod  Up ... (healthy)
alentapp-api-prod  Up ... (healthy)
alentapp-db-prod   Up ... (healthy)
```

Tambien se valido manualmente:

```bash
docker exec alentapp-api-prod node -e "fetch('http://127.0.0.1:3000/health').then(async r => { console.log(r.status); console.log(await r.text()) })"
```

Resultado:

```text
200
{"status":"ok"}
```
