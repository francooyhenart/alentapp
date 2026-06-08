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

## 4.3. Verificación de observabilidad

### OpenTelemetry exporta métricas en `:9464/metrics`

```bash
curl http://localhost:9464/metrics
```

El endpoint responde con métricas en formato Prometheus. Entre las más relevantes:

```
http_requests_total{method="GET",route="/health",status="200"} 10
http_request_duration_milliseconds_bucket{method="GET",route="/health",...}
http_requests_active{otel_scope_name="alentapp-api"} 0
process_memory_usage_bytes{otel_scope_name="alentapp-api"} 102338560
```

### Prometheus scrapea correctamente el endpoint

```bash
curl http://localhost:9090/-/ready
# Prometheus Server is Ready.
```

Prometheus está configurado con un job `alentapp-api` que apunta a `api:9464` por la red interna de Docker. En la UI (`http://localhost:9090/targets`) el target aparece con estado **UP**, con labels `app="alentapp"`, `instance="api:9464"`, `job="alentapp-api"`, `service="api"` y duración de scrape de ~6 ms.

Verificación de métricas disponibles en Prometheus:

```bash
curl -s http://localhost:9090/api/v1/label/__name__/values | grep -o '"http[^"]*"'
```

Resultado:

```
"http_request_duration_milliseconds_bucket"
"http_request_duration_milliseconds_count"
"http_request_duration_milliseconds_sum"
"http_requests_active"
"http_requests_errors_total"
"http_requests_total"
```

### Grafana tiene datasource Prometheus configurado

```bash
curl -s http://admin:admin@localhost:3001/api/datasources | grep -o '"uid":"[^"]*"'
# "uid":"PBFA97CFB590B2093"
```

El datasource se aprovisiona automáticamente al levantar el contenedor desde `observability/grafana/provisioning/datasources/prometheus.yml`, sin necesidad de configurarlo manualmente desde la UI.

### Dashboard RED con 6 paneles funcionales

```bash
curl -s http://admin:admin@localhost:3001/api/dashboards/uid/alentapp-red-metrics \
  | grep -o '"title": "[^"]*"'
```

Resultado:

```
"title": "Requests por segundo"
"title": "Requests por status code"
"title": "Tasa de error"
"title": "Latencia p50 / p95 / p99"
"title": "Top 5 endpoints mas lentos (promedio)"
"title": "Memoria del proceso Node.js"
"title": "RED - Alentapp API"
```

### Gráficos responden al tráfico generado

Se generó tráfico con:

```bash
for i in {1..100}; do
  curl -s http://localhost:3000/api/v1/socios > /dev/null
  curl -s http://localhost:3000/api/v1/sports > /dev/null
  curl -s http://localhost:3000/api/v1/lockers > /dev/null
  sleep 0.05
done
```

Los paneles de requests por segundo y status code reflejaron el tráfico dentro de los 30 segundos siguientes al scrape de Prometheus.

### Métricas de error reflejan 4xx/5xx

Se generó un error controlado:

```bash
curl http://localhost:3000/api/v1/socios/99999
```

El panel de status code mostró la aparición de status 404 como serie separada, y el panel de tasa de error registró el incremento correspondiente.

---

## 4.4. Documentación de decisiones

### Arquitectura final

```
API Fastify (puerto 3000)
  └── OpenTelemetry SDK
        └── PrometheusExporter (puerto 9464)
                    ↓
              Prometheus (scrape cada 15s)
                    ↓
                 Grafana
                    └── Dashboard RED - Alentapp API
```

Todos los servicios corren en la misma red Docker interna `alentapp-prod`. Prometheus accede a la API por nombre de servicio (`api:9464`), sin exponer puertos innecesarios al exterior.

## 4.4. Documentacion de decisiones

### Arquitectura final

La arquitectura productiva quedo compuesta por:

text
Usuario
  |
  v
Frontend nginx (alentapp-web-prod)
  |
  v
API Fastify compilada (alentapp-api-prod)
  |
  v
PostgreSQL (alentapp-db-prod)


Antes de iniciar la API se ejecuta un job temporal:#### Multi-stage build para API

Se eligio multi-stage build para separar:

- instalacion de dependencias,
- compilacion TypeScript,
- generacion de Prisma Client,
- runtime final.

Esto permitio reducir la imagen de API de 1.54GB a 394MB.

#### Runtime API sin Prisma CLI

La API productiva no incluye Prisma CLI. Prisma CLI se usa solamente en el servicio migrate.

Esta decision evita agrandar la imagen runtime de la API.

#### Servicio migrate

Se agrego un servicio temporal para ejecutar:

bash
prisma migrate deploy


Esto evita que la API arranque contra una base sin tablas.

#### nginx para frontend

Se reemplazo Vite en produccion por nginx.

Motivos:

- menor tamano de imagen,
- mejor servidor para archivos estaticos,
- soporte para gzip,
- cache de assets,
- security headers,
- puerto productivo 80.

#### Seguridad en Compose

Se aplicaron:

- read_only: true,
- cap_drop: ALL,
- no-new-privileges=true,
- tmpfs para directorios temporales,
- variables desde entorno externo.

### Problemas encontrados

#### Imagen API demasiado grande

La imagen inicial de API seguia pesando mas de lo esperado porque se copiaba un node_modules de workspace con dependencias innecesarias.

Solucion:

- crear una etapa runtime-deps,
- instalar solo dependencias productivas,
- podar paquetes no necesarios,
- conservar las partes de Prisma necesarias para runtime.

#### Prisma fallaba al consultar

En una primera poda se elimino demasiado de Prisma. La API arrancaba, pero los endpoints que consultaban la base devolvian error.

Solucion:

- restaurar paquetes necesarios para el cliente Prisma generado,
- validar /api/v1/sports y el resto de endpoints.

#### Base productiva sin tablas

La API devolvia error porque la tabla sports no existia en la DB productiva.

Solucion:

- agregar servicio migrate,
- hacer que la API espere a migrate con condition: service_completed_successfully.

#### npm y ping presentes en runtime

La imagen final de Node todavia traia npm, npx y binarios de ping.

Solucion:

- eliminarlos explicitamente en la etapa final del Dockerfile de API.

text
migrate -> prisma migrate deploy -> db


El orden de arranque queda:

1. db inicia.
2. db queda healthy.
3. migrate aplica migraciones.
4. migrate termina con Exited (0).
5. api inicia.
6. api queda healthy.
7. web inicia.
8. web queda healthy.

### Decisiones técnicas — infraestructura Docker
#### Multi-stage build para API

Se eligio multi-stage build para separar:

- instalacion de dependencias,
- compilacion TypeScript,
- generacion de Prisma Client,
- runtime final.

Esto permitio reducir la imagen de API de 1.54GB a 394MB.

#### Runtime API sin Prisma CLI

La API productiva no incluye Prisma CLI. Prisma CLI se usa solamente en el servicio migrate.

Esta decision evita agrandar la imagen runtime de la API.

#### Servicio migrate

Se agrego un servicio temporal para ejecutar:

bash
prisma migrate deploy


Esto evita que la API arranque contra una base sin tablas.

#### nginx para frontend

Se reemplazo Vite en produccion por nginx.

Motivos:

- menor tamano de imagen,
- mejor servidor para archivos estaticos,
- soporte para gzip,
- cache de assets,
- security headers,
- puerto productivo 80.

#### Seguridad en Compose

Se aplicaron:

- read_only: true,
- cap_drop: ALL,
- no-new-privileges=true,
- tmpfs para directorios temporales,
- variables desde entorno externo.

### Problemas encontrados

#### Imagen API demasiado grande

La imagen inicial de API seguia pesando mas de lo esperado porque se copiaba un node_modules de workspace con dependencias innecesarias.

Solucion:

- crear una etapa runtime-deps,
- instalar solo dependencias productivas,
- podar paquetes no necesarios,
- conservar las partes de Prisma necesarias para runtime.

#### Prisma fallaba al consultar

En una primera poda se elimino demasiado de Prisma. La API arrancaba, pero los endpoints que consultaban la base devolvian error.

Solucion:

- restaurar paquetes necesarios para el cliente Prisma generado,
- validar /api/v1/sports y el resto de endpoints.

#### Base productiva sin tablas

La API devolvia error porque la tabla sports no existia en la DB productiva.

Solucion:

- agregar servicio migrate,
- hacer que la API espere a migrate con condition: service_completed_successfully.

#### npm y ping presentes en runtime

La imagen final de Node todavia traia npm, npx y binarios de ping.

Solucion:

- eliminarlos explicitamente en la etapa final del Dockerfile de API.

**Multi-stage build para las imágenes**

Se eligió un Dockerfile de 3 etapas (deps → build → runtime) para que la imagen final no contenga herramientas de compilación ni código fuente. El resultado son imágenes más pequeñas y sin superficie de ataque innecesaria.

**nginx para el frontend**

En desarrollo Vite sirve los archivos con hot reload. En producción eso no tiene sentido: se compila el frontend una sola vez y nginx sirve los archivos estáticos. Es más rápido, más liviano y más seguro.

### Decisiones técnicas — OpenTelemetry

**OpenTelemetry con hooks globales de Fastify**

En lugar de instrumentar cada endpoint manualmente, se usaron los hooks `onRequest` y `onResponse` de Fastify para registrar métricas en un solo lugar. Esto mantiene la observabilidad separada de la lógica de negocio. Las rutas nuevas se instrumentan automáticamente sin modificar nada.

**Nombres de métricas con guiones bajos, no puntos**

Se usaron nombres de métricas con guiones bajos (`http_requests_total`) en lugar de puntos (`http.requests.total`). Es la convención nativa de Prometheus. Si se usan puntos, OpenTelemetry los traduce automáticamente al exportar, pero definirlos directamente con guiones bajos es más claro y evita inconsistencias entre cómo se ven en el código y cómo se consultan en PromQL.

**`process.hrtime.bigint()` en lugar de `Date.now()` para medir duración**

`Date.now()` tiene precisión de milisegundos. `process.hrtime.bigint()` tiene precisión de nanosegundos. Para requests rápidos (menos de 5ms), `Date.now()` puede devolver 0 y arruinar las métricas de latencia. Con `hrtime.bigint()` la medición es siempre exacta.

**Ruta normalizada en los labels**

Se usó `request.routeOptions?.url ?? request.url` para el label `route`. La primera devuelve la ruta normalizada (`/api/v1/socios/:id`), la segunda devuelve la URL real (`/api/v1/socios/abc-uuid-123`).

Si se hubiera usado solo `request.url`, Prometheus generaría una serie diferente por cada UUID, explotando la cardinalidad de las métricas y rompiendo Prometheus en escenarios reales.

**Dependencias en `dependencies`, no `devDependencies`**

Los seis paquetes de OpenTelemetry se instalaron sin `--save-dev`. El stage `runtime` del `Dockerfile.prod` solo instala dependencias de producción con `npm ci --omit=dev`. Si se hubieran puesto como devDependencies, la API no encontraría los módulos al levantar el contenedor productivo.

### Decisiones técnicas — Prometheus y Grafana

**Resolución por nombre de servicio (`api:9464`), no `host.docker.internal`**

Prometheus accede al endpoint de métricas usando `api:9464`. La consigna del profesor menciona la forma con `host.docker.internal`, pero esa sintaxis solo aplica cuando Prometheus corre fuera de Docker.

En este caso Prometheus está dentro del mismo `docker-compose.prod.yml` que la API, en la misma red `alentapp-prod`. Docker resuelve el nombre del servicio (`api`) automáticamente. Esto es más robusto, más portable, y funciona igual en cualquier host (sin depender de `host.docker.internal`, que es específico de Docker Desktop).

**Versiones pineadas, no `latest`**

Se usaron tags específicos para las imágenes: `prom/prometheus:v2.55.0` y `grafana/grafana:11.2.0`. Usar `latest` es peligroso en producción: una actualización breaking de la imagen puede romper el ambiente sin que nadie haya tocado nada, y no es reproducible entre quienes clonan el repo en distintos momentos. Pinear obliga a actualizar conscientemente.

**Provisioning automático de Grafana (Infrastructure as Code)**

El datasource y el dashboard se cargan automáticamente al levantar el contenedor desde archivos de configuración versionados en `observability/grafana/provisioning/`. No hay configuración manual desde la UI, lo que hace el setup completamente reproducible. El datasource tiene `editable: false` para evitar que alguien lo modifique desde la UI por accidente.

**Grafana sin `read_only: true`**

A diferencia de los otros servicios del compose, Grafana corre sin `read_only: true`. Grafana necesita escribir en `/var/lib/grafana` (su SQLite interna con usuarios, dashboards, settings). Si se pone `read_only: true`, no arranca.

Se compensó con las otras restricciones de seguridad: `cap_drop: ALL` y `no-new-privileges=true`, más el volumen named `grafana_data` que aísla la escritura a un único directorio gestionado por Docker.

### Problemas encontrados

**Orden de imports en `app.ts`**

OpenTelemetry instrumenta automáticamente HTTP y Fastify "parcheando" esos módulos. Para que las auto-instrumentaciones funcionen, el import de telemetría tiene que estar antes que el import de Fastify. Si se importa Fastify primero, las auto-instrumentaciones llegan tarde y no se activan.

**Solución**: poner `import './infrastructure/telemetry.js';` como la primera línea de `app.ts`, antes de cualquier otro import.

**Cast `as any` en el `NodeSDK`**

Al instanciar `new NodeSDK({ metricReader: prometheusExporter, ... })` TypeScript marcaba un error de tipos. Las versiones publicadas de `@opentelemetry/sdk-node` y `@opentelemetry/exporter-prometheus` no siempre comparten exactamente el mismo type signature para `metricReader`.

**Solución**: se agregó `as any` al final del objeto de configuración. Es un cast aceptado en el ecosistema de OpenTelemetry hasta que se alineen las versiones de los tipos. El SDK funciona correctamente en runtime.

**Conflicto de puertos entre la API y Grafana**

La API corre en el puerto 3000 del host. Grafana, por defecto, también escucha en el puerto 3000 dentro de su contenedor. Si se hacía un mapeo directo `3000:3000`, los dos puertos del host chocaban.

**Solución**: mapear `3001:3000`. Internamente Grafana sigue en 3000, pero desde el host se accede por 3001. Así la API queda en `localhost:3000` y Grafana en `localhost:3001`, cada uno en su puerto.

**Conflicto de volúmenes en Grafana**

El mayor problema fue lograr que Grafana levantara correctamente. El compose original montaba toda la carpeta `provisioning` como un volumen read-only, y después intentaba montar `dashboards` como una subcarpeta de ese mismo path. Docker no puede crear un mountpoint dentro de un filesystem ya montado como read-only, así que el contenedor fallaba al arrancar.

**Solución**: separar los volúmenes por subdirectorio: `datasources` y `dashboards` cada uno apuntando a su propia ruta dentro del contenedor.

**UID del datasource hardcodeado**

El dashboard JSON referenciaba el datasource de Prometheus con `"uid": "prometheus"`, pero Grafana genera su propio UID al crear el datasource desde el provisioning. Los paneles mostraban "Datasource not found" hasta que se actualizó el JSON con el UID real (`PBFA97CFB590B2093`).

**Solución**: actualizar el JSON del dashboard con el UID que generó Grafana. Para futuros deployments esto se puede resolver configurando el UID explícitamente en el archivo de provisioning del datasource.

**Puerto 3001 ocupado**

Durante el desarrollo había un contenedor de testing corriendo en el mismo puerto que Grafana. Fue necesario detenerlo antes de levantar el compose productivo. No es un problema del sistema sino de convivencia entre entornos en la misma máquina.

### Captura del dashboard RED

![Dashboard RED - Tráfico y Errores](./evidencias/Dashboard%20RED%20de%20Alentapp%20API%20(Parte%20Superior).jpeg)

![Dashboard RED - Latencia y Memoria](./evidencias/Dashboard%20RED%20de%20Alentapp%20API%20(Parte%20Inferior).jpeg)