# Análisis para producción — Alentapp

**Autor**: Lautaro Flores
**Actividad**: TP Integrador - Actividad 4 - Fase 1

---

## 1. Análisis de la infraestructura Docker actual

Revisando la configuración actual en `docker-compose.yml`, `packages/api/Dockerfile` y `packages/web/Dockerfile`, encontré varios puntos que necesitamos ajustar antes de pasar a producción. A continuación detallo los cinco problemas principales:

### Problemas identificados

| # | Problema | ¿Dónde ocurre? | Impacto | Solución propuesta |
|---|---|---|---|---|
| 1 | **Single-stage build con dependencias de desarrollo en la imagen final**. Los Dockerfiles ejecutan `npm install` que instala todas las dependencias, incluyendo las de desarrollo (TypeScript, tsx, prisma CLI, vitest). La imagen final pesa más de 1GB cuando debería estar entre 200 y 300MB. | `packages/api/Dockerfile:12` y `packages/web/Dockerfile:7` (línea `RUN npm install`) | Alto | Usar **multi-stage build** con tres etapas: una para instalar dependencias de producción, otra para compilar el TypeScript, y la última que solo copia el código JavaScript ya compilado más las dependencias de producción. |
| 2 | **Los contenedores corren como usuario `root`**. Ninguno de los Dockerfiles define un usuario sin privilegios. Por defecto, todo se ejecuta como root dentro del contenedor. Si alguien explota una vulnerabilidad de la aplicación, tiene permisos de administrador del contenedor. | `packages/api/Dockerfile` y `packages/web/Dockerfile` (no existe la directiva `USER`) | Alto | Crear un usuario sin privilegios (por ejemplo `appuser`) y agregar la directiva `USER appuser` antes del `CMD`. Es una práctica recomendada por la documentación oficial de Docker. |
| 3 | **Se usan comandos de desarrollo en lugar de producción**. El `CMD` ejecuta `npm run dev` que usa `tsx watch` para autorrecarga e interpreta TypeScript en tiempo de ejecución. El docker-compose ejecuta `prisma migrate dev`, que es la versión interactiva para desarrollo. Nada de esto es apto para producción. | `packages/api/Dockerfile:14`, `packages/web/Dockerfile:11` y `docker-compose.yml:32-35` | Alto | Compilar TypeScript a JavaScript en la etapa de build. En runtime, ejecutar `node dist/app.js`. Reemplazar `prisma migrate dev` por `prisma migrate deploy` que es la versión no interactiva. |
| 4 | **Credenciales hardcodeadas en el repositorio**. Tenemos que sacar las contraseñas de ahí y pasarlas a un archivo `.env` que ignoremos en git. | `docker-compose.yml:5-7` (variables de PostgreSQL) y `docker-compose.yml:26` (DATABASE_URL) | Alto | Mover las credenciales a un archivo `.env` no versionado y referenciarlas en docker-compose con la sintaxis `${POSTGRES_USER}`, `${POSTGRES_PASSWORD}`, etc. Crear un `.env.example` versionado con los nombres de las variables sin valores, para documentación. |
| 5 | **Falta de límites de recursos, healthchecks y rotación de logs**. Los servicios `api` y `web` no tienen límites de CPU ni memoria, no definen healthchecks (solo la base de datos tiene uno), y no configuran rotación de logs. Un consumo descontrolado de recursos puede afectar al host completo. | `docker-compose.yml:18-58` (definiciones de `api` y `web`) | Medio | Agregar `deploy.resources.limits` con valores de CPU y memoria por servicio. Definir `healthcheck` para `api` y `web` con curl al endpoint principal. Configurar `logging` con driver `json-file` y opciones `max-size: 10m` y `max-file: 3`. |

### Observaciones adicionales

* El archivo `.dockerignore` es muy básico. Solo excluye `node_modules`, `dist`, `.git` y `*.log`. Faltaría excluir también `.env` (para no copiar secretos al contenedor), `coverage/`, `e2e-fullstack/`, `docs/` y `test-results/`.
* El `docker-compose.yml` monta el código del host con `volumes: .:/app`. Es útil para desarrollo (hot reload), pero no debe existir en producción porque la imagen ya contiene todo el código.

### Análisis específico de `docker-compose.yml`, Prometheus y Grafana

Además de los problemas generales arriba, profundizo en aspectos que afectan específicamente al ambiente de orquestación y observabilidad.

#### Problemas adicionales detectados

**Ausencia de un `docker-compose.prod.yml` separado**
El proyecto tiene un único `docker-compose.yml` que mezcla configuración de desarrollo (volúmenes montados, hot reload, modo dev) con la estructura general. No existe un archivo separado para producción. Esto obliga a usar el mismo archivo para los dos ambientes, con el riesgo de que configuraciones de desarrollo (como los volúmenes que montan código del host) terminen aplicadas en producción.
* **Propuesta**: crear un `docker-compose.prod.yml` separado, con servicios optimizados para producción: sin volúmenes de código, con imágenes construidas a partir de `Dockerfile.prod`, con límites de recursos definidos, y con healthchecks completos.

**Ausencia de Prometheus y Grafana**
El proyecto actualmente no tiene infraestructura de observabilidad. No hay forma de saber en tiempo real cuántos requests recibe la API, cuántos errores ocurren ni cuánto tarda cada operación. En producción esto significa estar "ciego": cuando algo falla, no hay visibilidad para diagnosticar.
* **Propuesta**: agregar dos servicios al `docker-compose.prod.yml`:
    * **Prometheus**: scrapea métricas desde el endpoint `/metrics` que va a exponer la API instrumentada con OpenTelemetry.
    * **Grafana**: se conecta a Prometheus como datasource y muestra un dashboard RED con seis paneles (Rate, Errors, Duration en distintas vistas, status codes, memoria, endpoints más lentos).

**Ausencia de red interna**
Los servicios actualmente usan la red por defecto de Docker (`bridge`). Eso significa que cualquier contenedor en el host puede potencialmente acceder a los servicios si conoce su IP. No hay aislamiento entre servicios del proyecto y otros que puedan correr en la misma máquina.
* **Propuesta**: definir una `network` interna personalizada en el `docker-compose.prod.yml`, donde solo los servicios del proyecto se comuniquen entre sí. Los puertos solo se exponen al host donde sea necesario (por ejemplo, el frontend al 80, la API al 3000), pero la comunicación entre API y BD queda solo en la red interna.

**Falta de políticas de seguridad a nivel de contenedor**
Más allá de correr como no-root (mencionado en el Problema 2), faltan tres políticas críticas:
* **`read_only: true`**: hace que el filesystem del contenedor sea de solo lectura. Si un atacante logra ejecutar código, no puede escribir archivos. Las carpetas que sí necesitan escritura se montan como volúmenes específicos.
* **`cap_drop: ALL`**: quita todas las capabilities de Linux (permisos especiales como abrir puertos privilegiados, hacer ping raw, montar filesystems). Después se agregan solo las necesarias con `cap_add`.
* **`security_opt: no-new-privileges`**: impide que un proceso dentro del contenedor adquiera privilegios adicionales mediante setuid u otros mecanismos.
* **Propuesta**: agregar estas tres directivas en cada servicio del `docker-compose.prod.yml`.

---

## 2. Investigación sobre OpenTelemetry

### 2.1. ¿Qué es OpenTelemetry y cómo se diferencia de Prometheus?
**OpenTelemetry** (también llamado OTel) es un estándar abierto que define cómo las aplicaciones deben generar y exportar datos de observabilidad. Provee SDKs y librerías para distintos lenguajes que permiten capturar métricas, traces y logs. Es agnóstico al destino: una aplicación instrumentada con OpenTelemetry puede enviar sus datos a Prometheus, Jaeger, Datadog, Grafana, entre otros, sin cambiar el código.

**La diferencia clave con Prometheus**:
* **OpenTelemetry**: Es el estándar y SDK para **generar** datos (métricas, traces y logs). Actúa como el productor que instrumenta la aplicación.
* **Prometheus**: Es el sistema para **almacenar y consultar** únicamente métricas. Actúa como el consumidor que recolecta y guarda la información.

En resumen: OpenTelemetry es lo que la aplicación "habla", y Prometheus es el lugar donde se guardan esos datos.

### 2.2. ¿Cuáles son los "3 pilares" de la observabilidad?
Los tres pilares son los tipos de telemetría que nos permiten entender el comportamiento del sistema en producción:
1.  **Métricas**: Son los números a lo largo del tiempo (ej: uso de CPU, requests por segundo) que nos dan un pantallazo general de la salud del sistema.
2.  **Traces (rastreo distribuido)**: Es la información sobre el camino exacto que recorre un request individual a través de los distintos servicios. Nos responde "¿qué pasó con este request en particular?".
3.  **Logs (registros)**: Son los eventos discretos con marca de tiempo y contexto, para saber exactamente qué pasó en un momento y lugar específico.

**OpenTelemetry aborda los tres pilares** de forma unificada.

### 2.3. Métricas RED
El acrónimo RED engloba las tres métricas fundamentales para evaluar servicios HTTP:
* **R - Rate**: Cantidad de requests por unidad de tiempo. Mide el tráfico del sistema.
* **E - Errors**: Cantidad o porcentaje de requests que terminan en error (códigos 4xx o 5xx). Mide la salud del sistema y nos indica si algo está fallando.
* **D - Duration**: Tiempo que tarda cada request en procesarse. Mide el rendimiento percibido por el usuario final.

Estas tres métricas capturadas correctamente alcanzan para detectar y diagnosticar la mayoría de los problemas de un servicio web.

### 2.4. ¿Qué es OTLP y qué ventaja tiene?
**OTLP** (OpenTelemetry Protocol) es el protocolo nativo de OpenTelemetry para transportar datos de telemetría desde las aplicaciones hacia los backends.

**Ventajas frente a exportar directamente a Prometheus**:
* Soporta métricas, traces y logs en un solo protocolo, mientras que Prometheus solo maneja métricas.
* Funciona con cualquier backend compatible, sin estar atado exclusivamente a Prometheus.
* Cambiar de herramienta de observabilidad en el futuro solo requiere cambiar el exporter, no hace falta tocar el código de la aplicación.

### 2.5. ¿Cómo se relaciona OpenTelemetry con Grafana?
**Grafana** es una plataforma de visualización que toma datos de distintos backends y los dibuja en dashboards. Se relacionan así:
1.  La aplicación genera los datos usando el **OpenTelemetry SDK**.
2.  OpenTelemetry los exporta a un backend (en nuestro caso, **Prometheus** para las métricas).
3.  **Grafana** se conecta a Prometheus para visualizar esa información de forma gráfica.

En el caso de Alentapp vamos a usar OpenTelemetry SDK en la API, Prometheus para almacenar las métricas, y Grafana para visualizar los dashboards.