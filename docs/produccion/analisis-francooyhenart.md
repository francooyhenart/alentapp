# Actividad 4 - Análisis individual - Franco

## Fase 1.1: Análisis de infraestructura Docker y API actual (Enfoque Observabilidad)

Este documento analiza el estado actual del proyecto Alentapp desde la perspectiva de la observabilidad, la telemetría de software y la salud del runtime de la API en entornos productivos.

El proyecto actualmente cuenta con una API desarrollada sobre Fastify que expone servicios de negocio en el puerto 3000. Sin embargo, la revisión del código fuente, sus dependencias y su entorno Docker de desarrollo demuestra que la aplicación está operando en un completo punto ciego tecnológico. No existen mecanismos automatizados ni estandarizados para medir el rendimiento, diagnosticar fallas en tiempo real o auditar el comportamiento del servidor ante ráfagas de tráfico.

## Problemas detectados

| Problema | ¿Dónde ocurre? | Impacto | Solución propuesta |
| :--- | :--- | :--- | :--- |
| **Condicional de arranque acoplado exclusivamente a desarrollo** | `packages/api/src/app.ts:250` | **Crítico** | El bloque de inicialización del servidor valida si el archivo ejecutado termina estrictamente en `app.ts` (`process.argv[1].endsWith('app.ts')`). Al migrar al entorno productivo con un *multi-stage build*, el compilador `tsc` generará código JavaScript nativo en `dist/app.js`. Al ejecutarse, esta condición dará `false`, el servidor saltará el método `listen()` y el contenedor Docker se apagará de inmediato sin levantar el puerto. Se debe reemplazar esta validación por una comprobación basada en variables de entorno como `process.env.NODE_ENV`. |
| **Dependencias estructurales de producción mal ubicadas** | `packages/api/package.json:18-25` | **Alto** | Librerías núcleo indispensables para el ciclo de vida de la aplicación, como `fastify` y `dotenv`, se encuentran listadas bajo el bloque de `devDependencies` en lugar de `dependencies`. Si se realiza una instalación limpia optimizada para producción omitiendo los paquetes de desarrollo (`npm install --omit=dev`), la API fallará catastróficamente al arrancar debido a la ausencia física de los módulos de ejecución del servidor web. Se deben mover de inmediato a `dependencies`. |
| **Ausencia de un endpoint de Healthcheck y diagnóstico real** | `packages/api/src/app.ts:243-244` | **Alto** | El endpoint raíz actual (`/`) devuelve un objeto estático simulado de prueba (`{ msg: 'asd' }`). Esto no constituye un mecanismo de comprobación legítimo. Si la conexión interna hacia PostgreSQL o Prisma se cae, el endpoint seguirá respondiendo `200 OK` de forma falsa. Se debe implementar un endpoint dedicado `GET /health` que verifique la conectividad real con la base de datos y usarlo para la directiva `healthcheck` de Docker Compose. |
| **Ejecución ineficiente mediante comandos de desarrollo en caliente** | `packages/api/Dockerfile:22` y `packages/api/package.json:7` | **Alto** | El contenedor Docker por defecto inicializa la API mediante `npm run dev`, delegando el runtime a la herramienta `tsx watch`. Esto implica que en producción el servidor mantendría un subproceso pesado observando cambios en el sistema de archivos en tiempo real y recompilando TypeScript al vuelo. Esto degrada drásticamente la CPU y el consumo de memoria RAM. La solución es compilar estáticamente mediante `tsc` y arrancar el contenedor con `node dist/app.js`. |
| **Falta de separación de etapas en la instalación de dependencias** | `packages/api/Dockerfile:12` | **Alto** | La instrucción `RUN npm install` se ejecuta de forma global sobre todo el monorepo sin discriminar entre entornos. En producción, esto arrastra herramientas pesadas de testing y desarrollo como Vitest y Playwright a la imagen final. Se debe segmentar la instalación en un esquema multi-stage build, utilizando `npm ci --omit=dev` para la etapa de ejecución en producción. |

## Resumen de riesgos principales

Los riesgos más importantes en el área de observabilidad se centran en la ceguera operativa, la inestabilidad del runtime ante fallas de infraestructura y el acoplamiento a scripts volátiles de desarrollo.

Primero, la API de Alentapp se comporta actualmente como una caja negra. Si un endpoint crítico experimenta una degradación de performance o empieza a arrojar excepciones de servidor, el equipo de ingeniería no tendrá forma de enterarse de inmediato, dependiendo exclusivamente del reporte tardío o queja del usuario final.

Segundo, la falta de un diagnóstico de salud automatizado imposibilita que el orquestador de Docker Compose reinicie de forma transparente un contenedor cuyo proceso de Node se haya congelado o haya perdido la conexión con Prisma Client, cronificando las caídas de servicio.

Tercero, el riesgo de falso positivo provocado por la validación del nombre de archivo y la mala disposición de las dependencias estructurales asegura un fallo rotundo en el despliegue productivo, bloqueando por completo la pipeline de despliegue continuo si no se corrige de raíz.

## Propuesta general para producción

Para mitigar estas vulnerabilidades e integrar observabilidad nativa de primer nivel sin romper los principios de la Arquitectura Hexagonal del proyecto, se propone la siguiente estrategia de implementación:

1. **Aislamiento de la Infraestructura de Monitoreo:** Crear el archivo `packages/api/src/infrastructure/telemetry.ts` para contener toda la lógica de configuración y ciclo de vida del SDK de OpenTelemetry, manteniendo el dominio y los casos de uso limpios de dependencias externas de monitoreo.
2. **Ciclo de Carga Prioritario:** Modificar `packages/api/src/app.ts` para asegurar que el módulo de telemetría sea importado e inicializado en la primera línea absoluta del archivo, garantizando que las auto-instrumentaciones web intercepten el tráfico de Fastify de manera correcta antes de que se registren las rutas.
3. **Exposición Independiente de Métricas:** Configurar un `PrometheusExporter` corriendo en un puerto aislado de telemetría en el puerto 9464 con el endpoint `/metrics`. Este puerto será accesible de forma interna y exclusiva para el contenedor de Prometheus dentro de la red del compose, impidiendo su exposición a la red pública de internet.
4. **Captura Manual y Automática RED:** Combinar la auto-instrumentación de Fastify y HTTP con contadores e histogramas personalizados para recolectar con precisión la tasa de peticiones, porcentaje de errores y latencia en percentiles p95 y p99.

---

## Actividad 4 - Fase 1.2: Investigar OpenTelemetry

### Qué es OpenTelemetry y cómo se diferencia de Prometheus

OpenTelemetry es un framework de observabilidad de código abierto auspiciado por la Cloud Native Computing Foundation que proporciona un estándar unificado, APIs, SDKs y herramientas para generar, recolectar y exportar datos de telemetría como trazas, métricas y logs de manera uniforme. OpenTelemetry es agnóstico respecto a los proveedores; su rol termina al despachar los datos generados fuera de la aplicación. No almacena datos ni ofrece motores de consulta.

Prometheus, por el contrario, es un sistema completo de monitoreo y una base de datos de series temporales. Prometheus funciona bajo un modelo de scrapeo, lo que significa que pasa periódicamente a conectarse a los endpoints de las aplicaciones para recolectar, almacenar cronológicamente y consultar las métricas numéricas mediante el lenguaje PromQL.

La diferencia fundamental es que OpenTelemetry es el encargado de la producción y transporte de la telemetría dentro del código de la API, mientras que Prometheus es el encargado del almacenamiento y procesamiento histórico de dichos datos.

| Característica | OpenTelemetry | Prometheus |
| :--- | :--- | :--- |
| **Rol Principal** | Generación, captura y exportación de datos. | Recolección, almacenamiento y consulta. |
| **Modelo de Datos** | Soporta Trazas, Métricas y Logs de forma unificada. | Especializado casi exclusivamente en Métricas cuantitativas. |
| **Flujo de Datos** | Generalmente envío automático hacia un colector o puerto. | Modelo de extracción activa sobre endpoints de métricas. |
| **Almacenamiento** | Ninguno (Es volátil, solo procesa y envía). | Base de datos embebida de series temporales en disco. |

### Los 3 pilares de la observabilidad

La observabilidad de sistemas complejos se sustenta sobre tres señales de telemetría fundamentales, conocidas tradicionalmente como los 3 pilares:

* **Métricas:** Son representaciones numéricas de datos medidos a lo largo de intervalos de tiempo específicos. Son ideales para generar alertas tempranas, dashboards interactivos y análisis análisis estadísticos de tendencia debido a su bajo costo de almacenamiento y alta velocidad de procesamiento.
* **Logs (Registros):** Son líneas de texto estructurado o plano que documentan un evento discreto ocurrido en un instante exacto de tiempo. Aportan el máximo nivel de detalle contextual para entender el motivo exacto por el cual falló un proceso específico.
* **Trazas (Traces):** Representan el viaje completo y el ciclo de vida de una petición a medida que atraviesa los distintos componentes del sistema desde que entra la ruta en el controlador, pasa por el caso de uso, ejecuta la query en el repositorio de persistencia y retorna la respuesta HTTP. Permiten mapear dependencias y cuellos de botella.

OpenTelemetry aborda los tres pilares de la observabilidad por igual, definiendo una especificación única para métricas, logs y trazas, lo que permite correlacionar un registro de error directamente con la métrica alterada y el identificador de la traza que lo causó.

### Métricas RED

El Método RED es una filosofía de monitoreo optimizada para arquitecturas de software orientadas a servicios, APIs web y microservicios. A diferencia de los enfoques tradicionales de infraestructura, RED se centra en medir la experiencia real del usuario y el comportamiento del servicio.

Una métrica en runtime es un valor numérico acumulativo o instantáneo expuesto por el proceso del servidor. En nuestro diseño para Alentapp, las tres métricas fundamentales se estructurarán de la siguiente manera:

#### 1. Rate (Tasa de solicitudes)
* **Definición:** Mide el volumen de tráfico que está experimentando el sistema, representado como la cantidad de solicitudes HTTP que ingresan por segundo a la API.
* **Tipo OpenTelemetry:** `Counter` (Un valor acumulativo que solo puede incrementar).
* **Etiquetas críticas:** método, ruta y estado de la respuesta.
* **Propósito:** Permite dimensionar la carga del backend, prever escalados de infraestructura y entender los patrones de uso de los endpoints deportivos y de gestión de casilleros.

#### 2. Errors (Tasa de errores)
* **Definición:** Mide la cantidad o el porcentaje de solicitudes HTTP entrantes que no se completan de forma exitosa, clasificadas principalmente por códigos de estado de error.
* **Tipo OpenTelemetry:** `Counter`.
* **Etiquetas críticas:** método, ruta y estado de la respuesta (enfocado en detectar respuestas 4xx de cliente y 5xx de fallas internas del servidor).
* **Propósito:** Actúa como el principal indicador de estabilidad del sistema. Una subida abrupta en los errores alerta de inmediato sobre fallas críticas en la aplicación.

#### 3. Duration (Duración / Latencia)
* **Definición:** Mide el tiempo exacto en milisegundos que toma el servidor Fastify desde que recibe la petición hasta que despacha la respuesta HTTP final al cliente.
* **Tipo OpenTelemetry:** `Histogram` (Agrupa los eventos de tiempo en rangos estadísticos).
* **Etiquetas críticas:** método y ruta.
* **Propósito:** Permite evaluar la degradación del rendimiento percibido por el usuario. El uso de histogramas es vital para calcular percentiles como p95 y p99 (latencia sufrida por el 5% y 1% de los usuarios con peor experiencia), identificando cuellos de botella en consultas complejas o iteraciones pesadas en los casos de uso.

### Qué es OTLP y qué ventaja tiene frente a exportar directamente a Prometheus

OTLP es el protocolo de transporte nativo y estandarizado por la especificación de OpenTelemetry para codificar y transmitir de forma eficiente datos telemétricos a través de la red utilizando payloads binarios basados en Protocol Buffers sobre conexiones HTTP o gRPC.

La ventaja de adoptar OTLP frente a implementar un exportador directo embebido de Prometheus dentro de la API radica en el desacoplamiento arquitectónico:

* **Exportador Directo:** La API debe cargar librerías específicas que transformen las métricas internas al formato textual compatible con Prometheus y sostener activamente el servidor HTTP en el puerto de extracción. El código fuente de la app queda acoplado a las decisiones de monitoreo.
* **Uso de OTLP:** La aplicación emite sus trazas, logs y métricas de forma nativa hacia un componente externo llamado OpenTelemetry Collector. El colector es el que se encarga de recibir, procesar, filtrar datos sensibles, aplicar políticas de reintento y balancear la carga, enviando los datos hacia Prometheus, Grafana o cualquier backend de almacenamiento sin que se deba modificar una sola línea de código en la API Fastify. Permite descargar por completo al proceso de Node.js de tareas pesadas de red y procesamiento de métricas.

### Cómo se relaciona OpenTelemetry con Grafana

OpenTelemetry y Grafana operan en extremos opuestos pero complementarios de la cadena de valor de la observabilidad, formando una sinergia perfecta de instrumentación y análisis:

1. **Generación (OpenTelemetry):** Se introduce dentro del código fuente de la API para medir variables en caliente de Fastify y recolectar las métricas RED e infraestructura del proceso como el consumo de memoria y requests concurrentes activas.
2. **Almacenamiento (Prometheus):** Actúa como el intermediario que periódicamente extrae y compacta esas métricas en una base de datos cronológica indexada.
3. **Visualización (Grafana):** Se posiciona en la capa superior de la arquitectura como la interfaz gráfica de usuario. Se conecta a Prometheus configurándolo como origen de datos y ejecuta consultas en lenguaje PromQL para traducir esas series de tiempo numéricas en dashboards dinámicos compuestos por gráficos interactivos.

Grafana no compite con OpenTelemetry; depende enteramente de OTel para obtener datos fidedignos estandarizados de la aplicación y presentárselos de forma intuitiva a los administradores del sistema.

### Diferencias Metodológicas: USE vs RED

Es vital comprender la frontera entre estos dos modelos para las decisiones de diseño del entorno productivo:

* **Método USE (Utilization, Saturation, Errors):** Está estrictamente orientado al monitoreo de recursos de infraestructura y hardware como máquinas virtuales, discos duros, CPU, redes y memoria de los contenedores Docker. Responde a cómo está sufriendo el hardware.
* **Método RED (Rate, Errors, Duration):** Está estrictamente orientado al monitoreo de servicios de software, aplicaciones y APIs web. Responde a cómo está experimentacionando el sistema el usuario final.

El dashboard requerido por la cátedra para la Actividad 4 es un Dashboard RED centrado en la API de Alentapp. Por ende, prioriza el análisis del software y las solicitudes HTTP, relegando las métricas de hardware a paneles complementarios como el uso de memoria para evaluar filtraciones en el proceso de Node.

### Paneles de Visualización RED Diseñados para Grafana

Para cumplir con los objetivos técnicos de las siguientes fases, el dashboard de Grafana "RED Alentapp API" se compondrá de 6 paneles estratégicos para diagnosticar la salud de la aplicación:

1. **Requests por Segundo (Rate):** Gráfico de series temporales alimentado por el conteo de duración del servidor. Monitorea el volumen exacto de tráfico concurrente.
2. **Tasa de Error (% de Fallas):** Gráfico de series temporales que divide las peticiones fallidas con códigos de error sobre el total de solicitudes. Permite ver el porcentaje exacto de fallas internas de la app.
3. **Latencia Percentiles p95 y p99 (Duration):** Gráfico de series temporales basado en los rangos estadísticos del histograma que calcula la velocidad del sistema sufrida por los usuarios más lentos, aislando degradaciones de performance.
4. **Distribución por Status Code:** Gráfico de áreas apiladas agrupado por la etiqueta de estado. Permite ver la proporción de respuestas exitosas (2xx), redirecciones (3xx) y errores (4xx/5xx) procesadas por la API.
5. **Consumo de Memoria del Proceso:** Gráfico de series temporales basado en el uso de memoria del proceso transformado a Megabytes. Vital para controlar la saturación del recurso físico del proceso de Node de acuerdo a la metodología USE complementaria.
6. **Endpoints Más Lentos (Top 5):** Gráfico de barras horizontales que utiliza funciones de ordenamiento jerárquico para listar cuáles son las 5 rutas de controladores Fastify que promedian las latencias más altas de ejecución, sirviendo como guía directa para tareas de refactorización de código.

### Tabla de Resumen de Componentes de Observabilidad

| Componente Técnico | Rol Específico en el Trabajo Práctico de Alentapp |
| :--- | :--- |
| **OpenTelemetry SDK** | Instrumentación del punto de entrada `app.ts` y captura manual en controladores para producir datos de telemetría unificados. |
| **Prometheus Exporter** | Servidor HTTP interno bindeado al puerto `9464` encargado de formatear y exponer de manera pasiva el canal `/metrics`. |
| **Prometheus Server** | Orquestador encargado de conectarse periódicamente al puerto de telemetría de la API para extraer y persistir los históricos en series temporales. |
| **Grafana UI** | Motor gráfico de analítica que consume la base de datos de Prometheus para dibujar los paneles del Dashboard RED interactivo. |
