# Actividad 4 - Analisis individual - Brenda


## Fase 1.1: Analisis de infraestructura Docker actual (Frontend)


Este documento analiza la infraestructura Docker actual del proyecto Alentapp desde el punto de vista del Frontend (`web`) y el rendimiento/seguridad del entorno de distribución en producción.


El proyecto actualmente cuenta con:


- `docker-compose.yml`: levanta base de datos, API y frontend para desarrollo.
- `packages/web/Dockerfile`: construye la imagen actual del frontend.
- `.dockerignore`: define archivos excluidos del contexto Docker.


La conclusion general es que la configuracion actual sirve exclusivamente para desarrollo local, pero representa un riesgo crítico para un entorno de producción. Mantiene el servidor de desarrollo de Vite activo, expone puertos no estándar, carece de un servidor HTTP dedicado (como Nginx) para servir archivos estáticos, no implementa mecanismos de optimización de red (compresión y caché) y arrastra dependencias de desarrollo innecesarias en el contenedor.


## Problemas detectados


Al analizar la imagen actual del frontend, se detectaron los siguientes problemas críticos que deben resolverse para el entorno productivo:


| Problema | Donde ocurre | Impacto | Solucion propuesta |
|---|---|---|---|
| **Uso de Vite en modo desarrollo dentro del contenedor:** El contenedor ejecuta la aplicación web utilizando `npm run dev -- --host 0.0.0.0`. Esto mantiene un servidor Node.js activo vigilando cambios en caliente (hot reload). | `docker-compose.yml:58`, `packages/web/Dockerfile:14` | Alto | Modificar el pipeline de construcción para ejecutar `npm run build -w packages/web`, generando los archivos estáticos optimizados (`dist/`) en lugar de levantar el entorno de desarrollo. |
| **Exposicion del puerto `5173`, que corresponde a desarrollo:** Se expone públicamente el puerto estándar del servidor de desarrollo de Vite. | `docker-compose.yml:57`, `packages/web/Dockerfile:11` | Alto | Configurar el entorno de producción para exponer el puerto estándar HTTP `80` (o `443` para HTTPS) a través del servidor web definitivo. |
| **Ausencia de nginx para servir archivos estáticos:** No hay un software especializado; Node.js se encarga de transferir el código del lado del cliente. | `packages/web/Dockerfile:1-14` | Alto | Implementar un esquema Multi-stage Build en el Dockerfile. La etapa de runtime debe basarse en `nginx:stable-alpine` para garantizar una entrega eficiente y de alto rendimiento. |
| **Falta de gzip, cache y headers de seguridad:** No existen políticas de optimización de red ni cabeceras HTTP de protección esenciales. | `packages/web/Dockerfile:1-14` | Alto | Proveer un archivo `nginx.conf` personalizado que habilite la compresión Gzip, aplique una política de caché agresiva (`expires 1y`) a los assets de Vite e inyecte cabeceras como `X-Frame-Options` o `X-Content-Type-Options`. |
| **Dependencias de desarrollo presentes in runtime:** El contenedor arrastra la carpeta `node_modules` de desarrollo y el código fuente completo mediante volúmenes, aumentando masivamente el tamaño de la imagen. | `docker-compose.yml:43-56` | Medio | Eliminar los volúmenes de desarrollo en el entorno productivo. Al utilizar Multi-stage Build, la imagen final solo contendrá los artefactos estáticos compilados y los binarios mínimos de Nginx. |
| **Falta de healthcheck propio:** El servicio web en el compose carece de un mecanismo de validación de salud, dependiendo ciegamente de que el proceso principal no falle. | `docker-compose.yml:43-59` | Medio | Incorporar un `HEALTHCHECK` nativo en el Dockerfile de producción utilizando `wget` o `curl` apuntando al puerto `80` para asegurar que el servidor Nginx responda correctamente. |


## Resumen de riesgos principales


Los riesgos más importantes del frontend actual están relacionados con el rendimiento de red, el consumo de recursos del servidor y la exposición de la infraestructura.


Primero, la ejecución de Vite en modo de desarrollo consume memoria RAM y ciclos de CPU de forma innecesaria para compilar código "al vuelo", una tarea que en producción debe venir precalculada y minimizada.


Segundo, la falta de compresión Gzip y de directivas de caché de red incrementa drásticamente el consumo de ancho de banda del servidor y degrada la experiencia del usuario final, especialmente en redes móviles o conexiones lentas.


Tercero, utilizar Node.js como servidor de archivos estáticos rompe los principios de alta disponibilidad; ante ráfagas de tráfico concurrentes, el event-loop puede saturarse fácilmente ralentizando las respuestas de la interfaz de usuario.


Cuarto, la ausencia de cabeceras de seguridad deja la aplicación web expuesta a vulnerabilidades del lado del cliente como Clickjacking, inyecciones de scripts maliciosos (XSS) o suplantación de tipos MIME.


## Propuesta general para produccion


Para resolver estos problemas del lado del frontend, se propone aislar por completo la configuración de desarrollo y estructurar el entorno productivo bajo el siguiente esquema técnico:


1. Servidor de Archivos Estáticos (packages/web/nginx.conf)
El archivo nginx.conf asociado debería:


Configurar un bloque de servidor estándar escuchando en el puerto 80.
Incluir una directiva try_files $uri $uri/ /index.html para dar soporte correcto al enrutamiento de la Single Page Application (SPA).
Habilitar el módulo gzip definiendo tamaños mínimos y tipos de contenido (text/css, application/javascript, etc.).
Configurar una sección location /assets/ con la directiva expires 1y y Cache-Control "public, no-transform".
Inyectar las cabeceras de seguridad mediante directivas add_header (X-Frame-Options "DENY", entre otras).


2. Definición del Contenedor (packages/web/Dockerfile.prod)
El Dockerfile.prod del entorno web debería:


Usar una etapa inicial de construcción (builder) basada en node:20-alpine.
Instalar todas las dependencias del monorepo y ejecutar npm run build -w packages/web.
Iniciar una segunda etapa limpia (runtime) basada en nginx:stable-alpine.
Copiar la configuración personalizada nginx.conf al directorio /etc/nginx/conf.d/default.conf.
Copiar únicamente la carpeta con el build optimizado (/app/packages/web/dist) hacia la ruta pública de Nginx (/usr/share/nginx/html).
Exponer el puerto estándar 80.
Declarar un comando HEALTHCHECK que verifique la disponibilidad del puerto 80.


3. Orquestación del Entorno (docker-compose.prod.yml)
El archivo docker-compose.prod.yml para el servicio web debería:


Apuntar al contexto del monorepo y seleccionar el nuevo Dockerfile.prod.
Remover por completo los mapeos de volúmenes locales (node_modules y código fuente).
Cambiar el mapeo de puertos externos redirigiendo el tráfico del host al puerto 80 del contenedor.
Descartar la directiva command, permitiendo que el contenedor ejecute el proceso nativo de Nginx de fondo (daemon off).


## Actividad 4 - Fase 1.2: Investigar OpenTelemetry


### ● ¿Qué es OpenTelemetry y cómo se diferencia de Prometheus?


OpenTelemetry (OTel) es un marco de observabilidad de código abierto e independiente del proveedor (vendor-neutral) diseñado para instrumentar, generar, recopilar y exportar datos de telemetría. Al ser un estándar de la industria, cuenta con el soporte de más de 90 proveedores de observabilidad y se integra con múltiples bibliotecas y servicios.


Herramientas como OpenTelemetry funcionan como un marco de trabajo (framework) estandarizado para manejar toda esta telemetría de forma unificada, permitiendo a los desarrolladores extraer los datos de sus aplicaciones y enviarlos a sistemas de análisis sin depender de un proveedor específico.


---


### ● ¿Cuáles son los "3 pilares" de la observabilidad? ¿Cuál aborda OpenTelemetry?


En el contexto de tus fuentes sobre observabilidad, la telemetría (o datos de telemetría) se refiere a la información que se instrumenta, genera, recopila y exporta para poder monitorear y entender el comportamiento de un sistema.


Los tres pilares fundamentales de la observabilidad son las **trazas (traces)**, las **métricas (metrics)** y los **registros (logs)**.


**OpenTelemetry aborda los tres pilares simultáneamente**, ofreciendo herramientas para instrumentar, recopilar y enviar de forma unificada toda esta información.


---


### ● Expliquen el concepto de métricas RED (Rate, Errors, Duration). ¿Para qué sirve cada una?


El Método RED fue creado en 2015 por Tom Wilkie (actual VP de Producto en Grafana Labs) como una filosofía de monitoreo orientada a microservicios, a diferencia de otros modelos enfocados en el hardware. Funciona como un excelente indicador de qué tan satisfechos estarán los usuarios y ayuda a medir Acuerdos de Nivel de Servicio (SLA). Evalúa cada servicio a través de:


* **Rate (Tasa):** Es la cantidad de solicitudes por segundo que recibe un servicio. Sirve para entender la demanda y el tráfico actual.
* **Errors (Errores):** Es la cantidad de esas solicitudes que fallan. Sirve para identificar directamente problemas graves de los usuarios, como errores en la carga de una página web.
* **Duration (Duración):** Es la cantidad de tiempo que toman las solicitudes (latencia). Sirve para saber qué tan lento o rápido es el servicio para el usuario final.


---


### ● ¿Qué es el OTLP (OpenTelemetry Protocol)? ¿Qué ventaja tiene frente a exportar directamente a Prometheus?


El OTLP (OpenTelemetry Protocol) es el protocolo estándar de este ecosistema utilizado por los "exportadores OTLP" para el envío nativo de la telemetría.


La principal ventaja de OTLP frente a la exportación directa a Prometheus es el desacoplamiento de la infraestructura de monitoreo y la unificación de los datos. Mientras que exportar directo a Prometheus ata la aplicación a su formato específico de métricas (pull-based por defecto), OTLP permite enviar métricas, logs y trazas de forma agnóstica hacia un *OpenTelemetry Collector*. Desde allí, los datos se pueden procesar y redirigir simultáneamente a múltiples backends (como Prometheus, Jaeger, Datadog o Grafana) simplemente modificando la configuración del colector, sin necesidad de tocar una sola línea de código en la aplicación ni arrastrar dependencias pesadas de proveedores específicos.


---


### ● ¿Cómo se relaciona OpenTelemetry con Grafana?


OpenTelemetry y Grafana funcionan como tecnologías complementarias (instrumentación/colectores vs. análisis/visualización).


Grafana Cloud proporciona soluciones integrales de observabilidad que permiten analizar las trazas, registros y métricas recopiladas. Grafana incluye soporte comercial explícito para la adopción de este ecosistema, ofreciendo a sus clientes soluciones directas para "Migrar a OpenTelemetry". Además, expertos y líderes de Grafana Labs abordan las mejores metodologías sobre cómo instrumentar servicios de manera estandarizada.