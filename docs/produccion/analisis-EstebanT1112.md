# Actividad 4 - Analisis individual - Esteban

## Fase 1.1: Analisis de infraestructura Docker actual

Este documento analiza la infraestructura Docker actual del proyecto Alentapp desde el punto de vista de la API y la seguridad del entorno productivo.

El proyecto actualmente cuenta con:

- `docker-compose.yml`: levanta base de datos, API y frontend para desarrollo.
- `packages/api/Dockerfile`: construye la imagen actual de la API.
- `.dockerignore`: define archivos excluidos del contexto Docker.

La conclusion general es que la configuracion actual sirve para desarrollo local, pero no esta preparada para produccion. Usa herramientas de desarrollo, monta el codigo fuente como volumen, ejecuta la API en modo watch, mantiene credenciales hardcodeadas y no aplica restricciones fuertes de seguridad sobre los contenedores.

## Problemas detectados

| Problema | Donde ocurre | Impacto | Solucion propuesta |
|---|---|---|---|
| La imagen de la API no usa multi-stage build. El Dockerfile instala dependencias y copia el proyecto completo en una sola etapa, por lo que la imagen final queda mas grande y con mas contenido del necesario. | `packages/api/Dockerfile:1`, `packages/api/Dockerfile:12`, `packages/api/Dockerfile:17` | Alto | Crear `packages/api/Dockerfile.prod` con tres etapas: `deps`, `build` y `runtime`. La etapa final debe copiar solamente el JavaScript compilado, el cliente Prisma generado, los archivos necesarios de Prisma y las dependencias productivas. |
| La API se ejecuta en modo desarrollo usando `npm run dev` y `tsx watch`. Esto no es adecuado para produccion porque mantiene herramientas de desarrollo y hot reload dentro del contenedor. | `packages/api/Dockerfile:22`, `docker-compose.yml:35-38`, `packages/api/package.json:7` | Alto | Agregar scripts productivos en `packages/api/package.json`, por ejemplo `build` y `start`, compilar TypeScript durante el build de la imagen y ejecutar la API final con `node` en lugar de `tsx watch`. |
| Las credenciales de la base de datos estan hardcodeadas dentro del compose. El `DATABASE_URL`, usuario, password y nombre de base quedan escritos directamente en el archivo versionado. | `docker-compose.yml:5-8`, `docker-compose.yml:29-30` | Alto | Mover valores sensibles a un archivo `.env` y referenciarlos desde `docker-compose.prod.yml`. En produccion no deberian quedar passwords ni connection strings completas hardcodeadas en el compose. |
| El contenedor de la API monta todo el repositorio como volumen. Esto es util para desarrollo, pero en produccion expone el codigo fuente completo dentro del contenedor y permite que cambios del host afecten al runtime. | `docker-compose.yml:24-28` | Medio | En `docker-compose.prod.yml` no montar el repositorio como volumen. La imagen productiva debe contener solo los artefactos necesarios para correr la aplicacion. Los volumenes deben reservarse para datos persistentes especificos, como PostgreSQL. |
| No hay restricciones de seguridad productivas para la API. El compose actual no define usuario no-root, filesystem read-only, limites de recursos, capabilities minimas ni politica `no-new-privileges`. | `docker-compose.yml:19-41` | Alto | En `Dockerfile.prod`, ejecutar la API con usuario no-root. En `docker-compose.prod.yml`, agregar `read_only: true` cuando sea compatible, `cap_drop: ALL`, `security_opt: no-new-privileges:true`, limites de CPU/memoria y logging con rotacion. |
| La API no tiene healthcheck propio. La base de datos si tiene healthcheck, pero el servicio API no. Esto dificulta saber si la aplicacion esta realmente lista o si solo el contenedor esta encendido. | `docker-compose.yml:13-17`, `docker-compose.yml:19-41` | Medio | Agregar un endpoint `GET /health` en la API que responda `200 OK` con un body simple, por ejemplo `{ "status": "ok" }`. Luego usar ese endpoint como healthcheck en `docker-compose.prod.yml` y en `packages/api/Dockerfile.prod`. |
| El `.dockerignore` es demasiado basico. Excluye `node_modules`, `dist`, `.git` y logs, pero no excluye otros archivos que no deberian viajar al contexto productivo, como reportes de tests, archivos temporales, outputs de Playwright o variables locales. | `.dockerignore:1-4` | Medio | Ampliar `.dockerignore` para excluir artefactos de testing, caches, reportes, archivos `.env` locales, carpetas temporales y cualquier archivo que no sea necesario para construir la imagen productiva. |

## Resumen de riesgos principales

Los riesgos mas importantes estan relacionados con seguridad, peso de imagen y separacion entre desarrollo y produccion.

Primero, la imagen actual de API no esta optimizada porque no separa instalacion de dependencias, compilacion y runtime. Esto genera una imagen mas pesada y con mas herramientas disponibles de las necesarias.

Segundo, el contenedor ejecuta la API como entorno de desarrollo, usando `tsx watch`. En produccion la aplicacion deberia ejecutarse ya compilada y con un comando estable de runtime.

Tercero, el compose actual contiene credenciales hardcodeadas y monta el repositorio completo dentro del contenedor. Eso es practico para desarrollar, pero no es seguro ni recomendable para produccion.

Cuarto, faltan controles de seguridad propios de un entorno productivo: usuario no-root, filesystem read-only, capabilities minimas, limites de recursos, logging con rotacion y healthcheck de API.

## Propuesta general para produccion

Para resolver estos problemas, se propone crear una configuracion productiva separada de la configuracion actual de desarrollo:

```text
packages/api/Dockerfile.prod
docker-compose.prod.yml
```

El `Dockerfile.prod` de la API deberia:

1. Usar `node:22-alpine`.
2. Separar etapas `deps`, `build` y `runtime`.
3. Instalar dependencias productivas con `npm ci --omit=dev` cuando corresponda.
4. Compilar TypeScript antes del runtime.
5. Generar el cliente Prisma.
6. Copiar solo archivos necesarios a la imagen final.
7. Ejecutar con usuario no-root.
8. Exponer el puerto `3000`.
9. Usar un healthcheck contra `/health`.

El `docker-compose.prod.yml` deberia:

1. No montar el repositorio completo como volumen.
2. Usar variables desde `.env`.
3. Definir healthchecks para API y DB.
4. Agregar limites de CPU y memoria.
5. Agregar `read_only: true` cuando sea compatible.
6. Agregar `cap_drop: ALL`.
7. Agregar `security_opt: no-new-privileges:true`.
8. Configurar logging `json-file` con rotacion.
9. Usar una red interna personalizada.

Con estos cambios, la API quedaria mas segura, mas liviana y mas cercana a un entorno real de produccion.

## Actividad 4 - Fase 1.2: Investigar OpenTelemetry

### Que es OpenTelemetry y como se diferencia de Prometheus

OpenTelemetry es un framework y conjunto de herramientas de observabilidad pensado para generar, recolectar y exportar datos de telemetria, como trazas, metricas y logs. No es una herramienta de visualizacion ni una base de datos de metricas: su funcion principal es instrumentar aplicaciones y enviar esos datos hacia otros sistemas.

Su objetivo principal es aumentar la interoperabilidad entre distintas integraciones y backends de observabilidad. Esto permite que una aplicacion genere datos de observabilidad en un formato estandar, sin quedar atada a una herramienta especifica.

```text
API Node.js/Fastify
   ↓ genera metricas, logs y trazas
OpenTelemetry
   ↓ exporta datos
Prometheus / Grafana / otro backend
```

OpenTelemetry instrumenta la aplicacion, genera, recolecta y exporta telemetria, mientras que Prometheus consume, almacena y consulta metricas. OpenTelemetry no es un backend de observabilidad: puede integrarse con backends open source como Prometheus o Jaeger, pero no reemplaza a esos sistemas. El almacenamiento y la visualizacion quedan a cargo de otras herramientas.

| Herramienta | Rol |
|---|---|
| OpenTelemetry | Genera y expone metricas |
| Prometheus | Recolecta/scrapea y almacena metricas |
| Grafana | Visualiza las metricas en dashboards |

### Los 3 pilares de la observabilidad

Dentro de la observabilidad existen 3 pilares, denominados señales de telemetria:

- Trazas: el recorrido de una request por la aplicacion.
- Metricas: mediciones numericas capturadas en runtime.
- Logs: registros de eventos ocurridos en el sistema.

OpenTelemetry soporta trazas, metricas, logs y baggage; ademas, tiene eventos y profiles en desarrollo o propuesta. En el TP no centramos principalmente  en metricas RED para la API.

### Metricas RED

Las metricas RED forman parte del RED Method, creado por Tom Wilkie como una filosofia de monitoreo orientada a microservicios y servicios web. La idea es tener una forma simple y consistente de observar cada servicio de una arquitectura.

Una metrica se define como una medicion capturada en tiempo de ejecucion. Las metricas sirven para observar disponibilidad, performance, errores, uso de CPU/memoria, requests activas, duracion de operaciones, etc.

#### Rate

Rate mide la cantidad de requests por segundo.

- Tipo OpenTelemetry: Counter.
- Labels utiles: method, route, status.
- Metrica sugerida: `http.requests.total`.

Permite saber si la API esta recibiendo trafico normal, poco trafico o una carga alta. Ejemplo de endpoints a monitorear:

```text
GET /api/v1/socios
GET /api/v1/sports
POST /api/v1/lockers
```

#### Errors

Errors mide la cantidad o tasa de requests que estan fallando. Conviene separar errores por status:

- `4xx` = errores del cliente.
- `5xx` = errores del servidor.

Muchos 500 indican errores internos; muchos 404 o 400 pueden indicar mal uso de endpoints, validaciones o rutas incorrectas.

- Tipo OpenTelemetry: Counter.
- Labels utiles: method, route, status.
- Metrica sugerida: `http.requests.errors`.

#### Duration

Duration mide la latencia de las requests. Sirve para medir la performance percibida por el usuario. No alcanza con saber el promedio; lo ideal es mirar percentiles como p95 y p99, porque muestran que pasa con las requests mas lentas.

- Tipo OpenTelemetry: Histogram.
- Labels utiles: method, route.
- Metrica sugerida: `http.request.duration`.

Counter sirve para valores acumulativos, Gauge para valores actuales e Histogram para estadisticas de valores como latencias de requests.

### Que es OTLP y que ventaja tiene frente a exportar directamente a Prometheus

OTLP es el protocolo estandar que define como se codifican, transportan y entregan los datos de telemetria entre aplicaciones, collectors y backends de observabilidad. Puede funcionar sobre gRPC o HTTP, usando payloads basados en Protocol Buffers.

La ventaja frente a exportar directamente a Prometheus es que con OTLP no quedas atado a un unico backend. La app puede enviar datos a un Collector, y el Collector despues decide si exporta a Prometheus, Grafana, Jaeger, Tempo, Loki u otra herramienta.

El OpenTelemetry Collector recibe, procesa y exporta telemetria de forma vendor-agnostic. Evita tener que mantener multiples agentes distintos para distintos backends. Permite descargar trabajo de la aplicacion y manejar cosas como reintentos, batching, cifrado y filtrado de datos sensibles.

En produccion es importante ya que la API no deberia acoplarse directamente a una herramienta especifica de monitoreo.

### Como se relaciona OpenTelemetry con Grafana

OpenTelemetry y Grafana cumplen roles complementarios dentro de una arquitectura de observabilidad. OpenTelemetry se encarga de instrumentar la aplicacion y generar datos de telemetria en un formato estandar y neutral respecto del proveedor. Grafana, en cambio, se utiliza principalmente para visualizar y analizar esos datos mediante dashboards. Grafana no reemplaza a OpenTelemetry: lo complementa.

Grafana ofrece soporte de primer nivel para OpenTelemetry dentro del stack LGTM, lo que permite juntar telemetria de infraestructura, plataforma y aplicacion en un mismo ecosistema de observabilidad.

Flujo completo aplicado al TP:

```text
API Node.js/Fastify
   ↓ OpenTelemetry genera metricas RED
Endpoint /metrics o Collector
   ↓
Prometheus scrapea metricas
   ↓
Grafana muestra dashboards
```

### USE vs RED

La diferencia importante es que USE esta mas orientado a recursos de infraestructura, como CPU, memoria, disco o red. En cambio, RED esta mas orientado a servicios, APIs y microservicios.

El dashboard de el TP es un dashboard RED de la API, no un dashboard de infraestructura. Por eso los paneles principales deben mirar requests, errores y latencia, y no solo CPU o memoria. Aun asi, RED ayuda a entender la experiencia del usuario y USE ayuda a entender el estado de las maquinas o contenedores.

### Paneles del Dashboard RED en Grafana

Los primeros tres paneles corresponden directamente a las metricas RED:

- Requests por segundo: Rate.
- Tasa de error: Errors.
- Latencia p95/p99: Duration.
- Respuestas por status code: Errors / estado general del servicio.

Los dos paneles restantes complementan RED:

- Memoria del proceso: control basico de recursos.
- Endpoints mas lentos: detectar cuellos de botella
