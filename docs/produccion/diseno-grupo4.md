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
