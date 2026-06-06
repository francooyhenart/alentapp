# Fase 2: Diseño — Actividad 4

## 2.1. Diseño de la infraestructura Docker

### a) `packages/api/Dockerfile.prod`

#### Propósito

El archivo `packages/api/Dockerfile.prod` construye una imagen productiva de la API de Alentapp.

El Dockerfile de desarrollo actual instala dependencias con `npm install`, copia el repositorio completo y ejecuta el servidor con `tsx watch`. Ese comportamiento no es adecuado para producción porque mantiene herramientas de desarrollo, hot reload y más archivos de los necesarios.

El Dockerfile productivo resuelve esos problemas mediante un multi-stage build. La imagen final debe contener solamente lo necesario para ejecutar la API ya compilada: JavaScript generado, dependencias productivas, archivos de Prisma y el cliente Prisma generado.

#### Estructura: multi-stage build (3 etapas)

| Etapa | Nombre | Base | Propósito |
|---|---|---|---|
| Stage 1 | `deps` | `node:22-alpine` | Instalar solo dependencias de producción (`npm ci --omit=dev`) filtrado por workspaces |
| Stage 2 | `build` | `node:22-alpine` | Compilar TypeScript, generar cliente Prisma y JS final |
| Stage 3 | `runtime` | `node:22-alpine` | Solo runtime: JS compilado + `node_modules` prod + usuario no-root |

**Stage 1 — `deps`:** instala dependencias productivas del monorepo filtrando solo los workspaces necesarios para no arrastrar dependencias del frontend:

```bash
npm ci --omit=dev --workspace=@alentapp/api --workspace=@alentapp/shared
```

Solo se copian los manifests en esta etapa (`package.json`, `package-lock.json`, `packages/api/package.json`, `packages/shared/package.json`, `packages/web/package.json`) para aprovechar la cache de Docker ante cambios de código. Aunque la imagen productiva sea de la API, el monorepo declara workspaces con `packages/*`, por lo que npm puede necesitar ver todos los `package.json` de los workspaces para validar correctamente el grafo de dependencias.

**Stage 2 — `build`:** instala dependencias de compilación, copia el código fuente, ejecuta `prisma generate` y compila TypeScript. Para ello se necesitan los scripts productivos en `packages/api/package.json`:

```json
{
  "build": "tsc",
  "start": "node dist/app.js"
}
```

El cliente Prisma se genera en `packages/api/src/generated/client` y debe copiarse a una ruta resoluble desde `dist` (por ejemplo `packages/api/dist/generated/client`), o ajustar el `output` del `generator client` en `schema.prisma` para que apunte directamente a una ruta compatible con el compilado.

**Stage 3 — `runtime`:** imagen final limpia. No debe contener código fuente, dependencias de desarrollo, herramientas de testing, hot reload ni archivos temporales. El comando de inicio es:

```Dockerfile
CMD ["node", "dist/app.js"]
```

#### Requisitos no funcionales

| Punto | Decisión de diseño |
|---|---|
| Base | `node:22-alpine` |
| Etapas | `deps`, `build`, `runtime` |
| Dependencias runtime | Solo producción con `npm ci --omit=dev --workspace=@alentapp/api --workspace=@alentapp/shared` |
| Compilación | En stage `build`, no en runtime |
| Prisma | Ejecutar `prisma generate` y copiar cliente a ruta resoluble desde `dist` |
| Usuario | No-root: `node` o `appuser` |
| Puerto | `3000` |
| Healthcheck | `http://127.0.0.1:3000/health` |
| Comando final | `node dist/app.js` |
| Tamaño objetivo | 300 MB o menos (reducción ≥70% respecto a la imagen de desarrollo ~1 GB) |
| Startup objetivo | Menos de 10 segundos hasta responder `/health` |

**Healthcheck recomendado** (usando `fetch` nativo de Node 22, para evitar depender de `curl` o `wget` en Alpine):

```Dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"
```

**`.dockerignore`** debe excluir al menos:

```text
node_modules
dist
.git
*.log
.env
.env.*
coverage
test-results
playwright-report
e2e-fullstack
docs
*.md
```

**Ajuste necesario en el entrypoint:** el archivo `app.ts` actual solo inicia el servidor si el archivo termina en `app.ts`. En producción el archivo ejecutado es `dist/app.js`, por lo que esa condición debe actualizarse para que la API también arranque desde JavaScript compilado.

**Consideración importante:** `packages/api/package.json` tiene algunas librerías necesarias en runtime (como `fastify`, `dotenv`, `pg`) dentro de `devDependencies`. Deben moverse a `dependencies` antes de implementar el Dockerfile productivo, o la API fallará al iniciar.

---

### b) `packages/web/Dockerfile.prod`

#### Propósito

El archivo `packages/web/Dockerfile.prod` construye una imagen productiva del frontend de Alentapp.

El Dockerfile de desarrollo actual expone el puerto `5173` y ejecuta Vite con `npm run dev`. En producción no debe correr Node.js para servir el frontend: el navegador solo necesita recibir HTML, CSS, JavaScript y assets estáticos ya compilados. Por eso la imagen final usa nginx.

#### Estructura: multi-stage build (3 etapas)

| Etapa | Nombre | Base | Propósito |
|---|---|---|---|
| Stage 1 | `deps` | `node:22-alpine` | Instalar dependencias necesarias para construir el frontend |
| Stage 2 | `build` | `node:22-alpine` | Ejecutar el build de Vite y generar `packages/web/dist` |
| Stage 3 | `runtime` | `nginx:stable-alpine` | Servir los archivos estáticos con nginx |

**Stage 1 — `deps`:** se instalan las dependencias del workspace `web` y `@alentapp/shared`. No se usa `--omit=dev` porque el build de Vite necesita herramientas de desarrollo (TypeScript, Vite, plugin de React). También se debe copiar `packages/api/package.json` porque la raíz del proyecto declara workspaces con `packages/*` y `npm ci` puede fallar si no los encuentra todos.

**Stage 2 — `build`:** ejecuta el build productivo que ya existe en `packages/web/package.json`:

```json
{
  "build": "tsc -b && vite build"
}
```

La salida esperada es `packages/web/dist`. Si el frontend necesita conocer la URL de la API, debe recibirla como variable de build (`VITE_API_URL`).

**Stage 3 — `runtime`:** copia los archivos estáticos y la configuración de nginx. No debe contener `node_modules`, código fuente, Vite ni Node.js.

```Dockerfile
COPY --from=build /app/packages/web/dist /usr/share/nginx/html
COPY packages/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

#### Configuración de `nginx.conf`

El archivo `packages/web/nginx.conf` debe configurar nginx para servir una SPA:

**Soporte SPA** (evita que rutas como `/members` o `/sports` fallen al refrescar):
```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

**Compresión gzip:**
```nginx
gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;
```

**Cache de assets** (Vite agrega hash al nombre, permiten cache larga):
```nginx
location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

**Security headers:**
```nginx
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header X-XSS-Protection "1; mode=block" always;
```

#### Requisitos no funcionales

| Punto | Decisión de diseño |
|---|---|
| Stage 1 | `deps` con `node:22-alpine` |
| Stage 2 | `build` con `node:22-alpine` |
| Stage 3 | `runtime` con `nginx:stable-alpine` |
| Build | `npm run build -w packages/web` |
| Salida esperada | `packages/web/dist` |
| Servidor productivo | nginx |
| Soporte SPA | `try_files $uri $uri/ /index.html` |
| Optimización | gzip y cache de assets |
| Security headers | `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `X-XSS-Protection` |
| Puerto | `80` (no `5173`) |
| Healthcheck | `http://127.0.0.1:80/` |
| Tamaño objetivo | 170 MB o menos (reducción ≥70% respecto a la imagen de desarrollo ~570 MB) |
| Startup objetivo | Menos de 5 segundos hasta responder en `/` |

---

### c) `docker-compose.prod.yml`

#### Propósito

El archivo `docker-compose.prod.yml` define cómo se levantan los servicios en producción. No debe montar código fuente como volumen, no debe usar `tsx watch` ni Vite, y no debe contener credenciales hardcodeadas.

#### Servicios

| Servicio | Imagen / Build | Puerto |
|---|---|---|
| `db` | `postgres:16-alpine` | interno |
| `api` | Build desde `packages/api/Dockerfile.prod` | `3000` |
| `web` | Build desde `packages/web/Dockerfile.prod` | `80` |

Prometheus y Grafana se agregan en la sección de observabilidad.

#### Variables sensibles y `.env`

Las variables no deben quedar hardcodeadas. Deben venir de un archivo `.env` local no versionado:

```env
POSTGRES_USER=admin
POSTGRES_PASSWORD=password123
POSTGRES_DB=alentapp_db
DATABASE_URL=postgres://admin:password123@db:5432/alentapp_db
NODE_ENV=production
```

Uso en el compose:
```yaml
environment:
  POSTGRES_USER: ${POSTGRES_USER}
  DATABASE_URL: ${DATABASE_URL}
  NODE_ENV: production
```

Se puede versionar un `.env.example` con nombres de variables y valores de ejemplo no sensibles.

#### Healthchecks

- **`db`:** `pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB` — intervalo 10s, retries 5.
- **`api`:** `node -e "fetch('http://127.0.0.1:3000/health')..."` — intervalo 30s, start_period 10s.
- **`web`:** `wget -qO- http://127.0.0.1:80/ || exit 1` — intervalo 30s, start_period 10s.

La API debe depender del healthcheck de `db`:
```yaml
depends_on:
  db:
    condition: service_healthy
```

#### Resource limits

| Servicio | CPU | Memoria |
|---|---|---|
| `db` | `1.00` | `1G` |
| `api` | `0.75` | `512M` |
| `web` | `0.25` | `128M` |

Los valores pueden ajustarse después de medir con `docker stats --no-stream`.

#### Seguridad de contenedores

Cada servicio debe incluir las siguientes restricciones:

```yaml
read_only: true
cap_drop:
  - ALL
security_opt:
  - no-new-privileges=true
```

Para `web`, dado que nginx necesita bindear el puerto `80` (puerto privilegiado):
```yaml
cap_add:
  - NET_BIND_SERVICE
```

Como `read_only: true` impide escritura en el filesystem, se agregan montajes temporales en memoria:

- **`api`:** `tmpfs: [/tmp]`
- **`web`:** `tmpfs: [/var/cache/nginx, /var/run, /var/log/nginx]`

En el servicio `db`, `read_only: true` debe validarse con especial cuidado porque PostgreSQL necesita escribir en su volumen de datos y puede requerir directorios temporales. El diseño debe combinar `read_only` con el volumen persistente `pgdata_prod` y los `tmpfs` necesarios para que el contenedor pueda iniciar sin romper la restricción de seguridad.

#### Logging con rotación

Todos los servicios deben usar logging con rotación para evitar que los logs crezcan sin límite:

```yaml
logging:
  driver: json-file
  options:
    max-size: "10m"
    max-file: "3"
```

#### Red interna

No debe usarse la red default de Docker Compose. Se define una red propia:

```yaml
networks:
  alentapp-prod:
    driver: bridge
```

Todos los servicios se conectan a `alentapp-prod`.

#### Resumen del diseño

| Aspecto | Decisión de diseño |
|---|---|
| Servicios base | `db`, `api`, `web` |
| Resource limits | CPU y memoria definidos por servicio |
| Healthchecks | DB con `pg_isready`, API con `/health`, Web contra `/` |
| Seguridad | `read_only` con `tmpfs`, `cap_drop: ALL`, `cap_add: NET_BIND_SERVICE` (web), `no-new-privileges=true` |
| Logging | `json-file`, `max-size: 10m`, `max-file: 3` |
| Red | `alentapp-prod` (no default bridge) |
| Secrets | Variables sensibles desde `.env` |
| Volumen persistente | `pgdata_prod` para PostgreSQL |

---

## 2.2. Diseño de la observabilidad

### a) Métricas RED a capturar

Las métricas RED se aplican sobre la API Fastify para medir cómo se comporta el servicio frente a requests reales.

**Las 3 métricas fundamentales:**

| Métrica | Tipo OpenTelemetry | Descripción | Labels |
|---|---|---|---|
| Rate | Counter | Requests por segundo | `method`, `route`, `status` |
| Errors | Counter | Tasa de error (4xx/5xx) | `method`, `route`, `status` |
| Duration | Histogram | Latencia de requests | `method`, `route` |

**Métricas adicionales:**

| Métrica | Tipo OpenTelemetry | Descripción | Labels |
|---|---|---|---|
| `process_memory_usage_bytes` | Gauge | Memoria del proceso Node.js | Sin labels |
| `http_requests_active` | Gauge | Requests concurrentes | `method`, `route` |

**Rate (`http_requests_total`):** Counter que se incrementa en cada request recibida. Permite saber cuántos requests por segundo recibe la API, qué endpoints son más usados y si hay subidas de tráfico.

**Errors (`http_requests_errors_total`):** Counter que se incrementa cuando el status de respuesta es `>= 400`. Conviene separar errores `4xx` (errores del cliente, validaciones) de `5xx` (errores internos del servidor).

**Duration (`http_request_duration_milliseconds`):** Histogram en milisegundos. Se usa Histogram porque la duración de requests necesita agruparse en rangos para calcular percentiles (p95, p99). No alcanza con el promedio para detectar degradaciones reales.

**Criterio de labels:** los labels deben usar rutas lógicas, no URLs con parámetros concretos.

- Correcto: `/api/v1/sports/:id`
- Incorrecto: `/api/v1/sports/4d6f3f8a-7c91-4f2d-a1ab-123456789000`

Esto evita generar demasiadas series de métricas diferentes en Prometheus.

---
