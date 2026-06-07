import { NodeSDK } from '@opentelemetry/sdk-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { metrics } from '@opentelemetry/api';

/**
 * Configuracion de OpenTelemetry para la API de Alentapp.
 *
 * Expone metricas en formato Prometheus en el endpoint http://localhost:9464/metrics.
 * Captura las metricas RED (Rate, Errors, Duration) ademas de uso de memoria
 * y requests concurrentes activos.
 *
 * Los nombres de las metricas usan guiones bajos para ser consistentes con
 * la convencion de Prometheus.
 */

const PROMETHEUS_PORT = 9464;
const PROMETHEUS_ENDPOINT = '/metrics';
const SERVICE_NAME = 'alentapp-api';

// Exporter Prometheus: levanta su propio servidor HTTP en el puerto 9464
const prometheusExporter = new PrometheusExporter({
    port: PROMETHEUS_PORT,
    endpoint: PROMETHEUS_ENDPOINT,
});

// SDK con auto-instrumentaciones de HTTP y Fastify
const sdk = new NodeSDK({
    metricReader: prometheusExporter,
    instrumentations: [
        getNodeAutoInstrumentations({
            '@opentelemetry/instrumentation-http': {},
            '@opentelemetry/instrumentation-fastify': {},
        } as any),
    ],
});

sdk.start();

// Meter para definir las metricas personalizadas RED
const meter = metrics.getMeter(SERVICE_NAME);

// Counter: cantidad total de requests HTTP recibidos
const requestsTotal = meter.createCounter('http_requests_total', {
    description: 'Cantidad total de requests HTTP recibidos por la API',
});

// Counter: cantidad total de respuestas con status de error (4xx y 5xx)
const requestsErrorsTotal = meter.createCounter('http_requests_errors_total', {
    description: 'Cantidad total de respuestas HTTP con codigos de error',
});

// Histogram: duracion de cada request en milisegundos
const requestDuration = meter.createHistogram('http_request_duration_milliseconds', {
    description: 'Duracion de los requests HTTP en milisegundos',
    unit: 'ms',
});

// UpDownCounter: cantidad de requests concurrentes que se estan procesando
const requestsActive = meter.createUpDownCounter('http_requests_active', {
    description: 'Cantidad de requests HTTP activos en este momento',
});

// ObservableGauge: uso de memoria RSS del proceso de Node.js
meter
    .createObservableGauge('process_memory_usage_bytes', {
        description: 'Memoria RSS del proceso en bytes',
        unit: 'bytes',
    })
    .addCallback((observableResult) => {
        observableResult.observe(process.memoryUsage().rss);
    });

// Cierre limpio del SDK ante señales de terminacion
['SIGTERM', 'SIGINT'].forEach((signal) => {
    process.on(signal, () => {
        sdk.shutdown()
            .then(() => process.exit(0))
            .catch(() => process.exit(1));
    });
});

/**
 * Funciones helper exportadas para que app.ts pueda registrar metricas
 * desde los hooks globales sin acoplarse a la implementacion del SDK.
 */

export type RequestMetricLabels = {
    method: string;
    route: string;
    status: string;
};

export function recordRequestStart(): void {
    requestsActive.add(1);
}

export function recordRequestEnd(labels: RequestMetricLabels, durationMs: number): void {
    requestsTotal.add(1, labels);
    requestDuration.record(durationMs, { method: labels.method, route: labels.route });

    const statusCode = Number(labels.status);
    if (statusCode >= 400) {
        requestsErrorsTotal.add(1, labels);
    }

    requestsActive.add(-1);
}