**Lumys**

Sistema Inteligente Multimodal de Alerta Temprana, Gemelo Digital Emocional y Acompañamiento Psicoeducativo para Comunidades Nicaragüenses.

Calcula un Índice Compuesto de Vulnerabilidad Emocional (ICVE) a partir de registros emocionales diarios (texto y voz), genera alertas explicables por niveles, envía notificaciones automáticas a orientadores, y ofrece un Gemelo Digital Emocional Comunitario que representa de forma anónima y agregada el estado emocional de una comunidad educativa o territorial.

**📋 Tabla de contenidos**
- [Descripción general](#descripción-general)
- [Tecnologías usadas](#tecnologías-usadas)
- [Instalación](#instalación)
- [Ejecución](#ejecución)
- [Arquitectura del sistema](#arquitectura-del-sistema)
- [Dependencias](#dependencias)
- [Variables de entorno](#variables-de-entorno)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Módulos del backend](#módulos-del-backend)
- [Modelo de base de datos](#modelo-de-base-de-datos)
- [Endpoints de la API](#endpoints-de-la-api)
- [Contribuciones](#contribuciones)
- [Licencia](#licencia)

---

## Descripción general

En Nicaragua, las señales de estrés, ansiedad, aislamiento o bajo rendimiento en comunidades educativas y rurales a menudo no se detectan a tiempo, sobre todo donde la conectividad es limitada. **Lumys** resuelve esto registrando diariamente emociones, sueño, energía, estrés, concentración y apoyo social del usuario (con texto libre y análisis de voz opcional), calculando un puntaje de vulnerabilidad emocional (ICVE), activando alertas tempranas explicables y agregando tendencias comunitarias mediante un Gemelo Digital Emocional, sin exponer nunca la identidad de una persona individual.

Usuarios objetivo: estudiantes, docentes, orientadores educativos e instituciones que necesitan datos agregados y anónimos para priorizar recursos de acompañamiento psicoeducativo.

**Principios de diseño:**
- La IA nunca toma la decisión final — siempre hay una persona humana (orientador) en el ciclo.
- Cada resultado de IA va acompañado de los factores que lo explican (explicabilidad / XAI).
- Los datos sensibles permanecen agregados y anonimizados a nivel comunitario; el aprendizaje federado evita centralizar información individual.

---

## Tecnologías usadas

| Tecnología | Versión | Uso |
|---|---|---|
| Node.js | 20.x | Runtime del backend |
| Express | 4.x | Framework de la API REST |
| Prisma | 5.x | ORM para PostgreSQL |
| PostgreSQL (NeonDB) | 15 | Base de datos relacional serverless |
| JWT (jsonwebtoken) | 9.x | Autenticación basada en tokens |
| bcrypt | 5.x | Hash de contraseñas |
| HTML5 / CSS / JavaScript vainilla | — | Frontend (consumo de la API vía fetch) |
| Bootstrap | 5.3.x | Estilos y componentes UI |
| Claude API (@anthropic-ai/sdk) | — | Análisis de texto, Coach IA y explicabilidad |
| Brevo | — | Envío de notificaciones por correo al orientador |
| DiceBear (o SVG propio) | — | Estados visuales del avatar del Gemelo Digital Comunitario |

---

## Instalación

**Requisitos previos:**
- Node.js >= 20
- Git
- Una base de datos PostgreSQL (recomendado: cuenta gratuita en [NeonDB](https://neon.tech))
- Cuenta en [Brevo](https://www.brevo.com) para notificaciones por correo
- API key de Claude (Anthropic) para el módulo de IA

**Pasos:**

```bash
# 1. Clona el repositorio
git clone https://github.com/IsraDev29/lumys.git
cd lumys

# 2. Instala las dependencias
npm install

# 3. Configura las variables de entorno
cp .env.example .env
# Edita el archivo .env con tus valores reales

# 4. Ejecuta las migraciones de Prisma
npx prisma migrate dev
```

## Ejecución

```bash
# Modo desarrollo
npm run dev

# Modo producción
npm start
```

La aplicación estará disponible en: `http://localhost:3000`

---

## Arquitectura del sistema

Lumys usa un **monolito modular** (no microservicios desplegados por separado), una decisión deliberada para mantener velocidad de desarrollo y un único punto de despliegue, mientras conserva separación de responsabilidades por dominio dentro del propio backend. Cada módulo ya está desacoplado internamente, por lo que el sistema podría escalar a microservicios reales en el futuro sin reescribir lógica de negocio.

```
Frontend: HTML + JS vainilla + Bootstrap (fetch)
                |
                v
          API REST (Express)
                |
   _____________|_______________________________________________
   |         |          |            |            |             |
[Auth]  [Emocional] [IA/NLP]   [Alertas]   [Notificaciones] [Comunitario]
   |         |     (texto+voz)     |             |          (Gemelo Digital
   |         |          |          |             |           + Radar + Avatar
   |         |          |          |             |            + Federado)
   |_________|__________|__________|_____________|_______________|
                          |                              |
                          v                              v
                    Prisma ORM                     API de Brevo
                          |                    (correo al orientador)
                          v
                PostgreSQL (NeonDB)
```

**Patrón:** arquitectura en capas (routes → controller → service → Prisma) dentro de cada módulo, organizada por dominio.

### Módulo IA/NLP

El módulo `ia` hace dos cosas distintas, y conviene no confundirlas.

**1. Conduce el check-in.** Las preguntas no están precargadas: cada intercambio
lo genera Claude en `POST /ia/checkin/turno`, con lo que se dijo en esa misma
sesión y una paráfrasis de los días anteriores como contexto. Un guion fijo se
aprende de memoria en tres días y el registro pasa a sentirse un trámite — que
es la forma más rápida de que un estudiante deje de aparecer. El modelo elige
qué dimensión explorar, con qué ángulo y en qué formato (botones, escala o
texto libre), y decide cuándo cerrar.

**2. Explica el resultado.** Al cerrar, analiza el conjunto y devuelve
sentimiento, factores explicativos, el mensaje del **Coach IA** para el propio
estudiante y una nota parafraseada para el orientador. Opcionalmente, con
consentimiento explícito, analiza características prosódicas de una nota de voz
(pausas, tono, velocidad) — nunca el audio ni una transcripción.

Tres límites deliberados sobre lo que la IA **no** hace:

- **No calcula el puntaje.** Cada opción viene etiquetada con un valor de 1 a 5
  y el ICVE se computa en `icve.service.js` con una fórmula fija. Si el número
  lo pusiera el modelo, dos respuestas iguales podrían puntuar distinto y la
  serie histórica dejaría de ser comparable consigo misma.
- **No decide sola el nivel de riesgo.** `ia.seguridad.js` mantiene un léxico
  determinista que pone el piso; el modelo puede subir ese nivel pero nunca
  bajarlo. Si la API está caída o devuelve algo raro, la detección sigue
  funcionando.
- **No escribe el mensaje de contención.** Ante riesgo explícito el texto es
  fijo y los contactos salen del catálogo `ServicioExterno`. En el único momento
  en que de verdad importa lo que el estudiante lee, nada depende de que el
  modelo esté teniendo un buen día.

Sin `ANTHROPIC_API_KEY` el módulo no se cae: degrada a un banco local de
preguntas por componente, elegidas al azar, y lo dice en pantalla.

### Módulo Comunitario (Gemelo Digital + Aprendizaje Federado + Avatar)
El módulo `comunitario` agrupa tres piezas conceptualmente ligadas:
- **`gemelo.service.js`**: calcula el ICVE agregado y anonimizado por aula, centro o comunidad — el Gemelo Digital Emocional Comunitario. Nunca expone datos de una persona individual; aplica un umbral mínimo de registros por grupo antes de mostrar resultados.
- **`federado.service.js`**: en vez de centralizar los registros emocionales crudos de cada centro educativo, cada institución agrega localmente sus propios parámetros (ej. ICVE promedio, total de registros) y solo esos parámetros agregados se sincronizan — una aproximación práctica al aprendizaje federado para el alcance de un hackathon.
- **`avatar.service.js`**: traduce el ICVE agregado de un grupo a un estado visual (ej. bajo / medio / alto / crítico) que se muestra como un avatar único representando al grupo completo, nunca a una persona — construido con SVG propio o DiceBear, sin depender de APIs de terceros con licencia (como Bitmoji o Duolingo, que no están disponibles para integraciones externas).

---

## Dependencias

**Producción:**

| Paquete | Versión | Motivo de uso |
|---|---|---|
| express | ^4.19.0 | Servidor HTTP y enrutamiento de la API |
| @prisma/client | ^5.18.0 | Cliente generado para consultas a PostgreSQL |
| jsonwebtoken | ^9.0.2 | Generación y verificación de tokens JWT |
| bcrypt | ^5.1.1 | Hash seguro de contraseñas de usuarios |
| dotenv | ^16.4.5 | Carga de variables de entorno desde .env |
| cors | ^2.8.5 | Habilita peticiones del frontend al backend |
| zod | ^3.23.8 | Validación de payloads de entrada en cada endpoint |
| @anthropic-ai/sdk | ^0.27.0 | Cliente para llamar a la API de Claude desde el módulo ia |
| sib-api-v3-sdk (Brevo) | latest | Envío de correos de notificación al orientador |

**Desarrollo:**

| Paquete | Versión | Motivo de uso |
|---|---|---|
| prisma | ^5.18.0 | CLI de migraciones y generación del cliente |
| nodemon | ^3.1.4 | Recarga automática del servidor en desarrollo |

Para ver todas las dependencias, consulta `package.json`.

---

## Variables de entorno

Copia `.env.example` como `.env` y completa los valores reales. Nunca subas tu `.env` al repositorio.

| Variable | Requerida | Descripción | Ejemplo |
|---|---|---|---|
| PORT | Sí | Puerto del servidor | 3000 |
| DATABASE_URL | Sí | URL de conexión a NeonDB (PostgreSQL) | postgresql://user:pass@host/lumys |
| JWT_SECRET | Sí | Clave secreta para firmar tokens JWT | (cadena larga y aleatoria) |
| JWT_EXPIRES_IN | No | Tiempo de expiración del token | 7d |
| ANTHROPIC_API_KEY | No | Clave de la API de Claude. Sin ella el módulo `ia` degrada a su banco local de preguntas en vez de caerse. | sk-ant-... |
| IA_MODELO | No | Modelo a usar. Por defecto `claude-opus-4-8`. | claude-opus-4-8 |
| BREVO_API_KEY | Sí | Clave de la API de Brevo para notificaciones | xkeysib-... |
| BREVO_SENDER_EMAIL | Sí | Correo remitente configurado en Brevo | notificaciones@lumys.app |
| NODE_ENV | No | Entorno de ejecución | development |

---

## Estructura del proyecto

```
lumys/
├── src/
│   ├── auth/
│   │   ├── auth.routes.js
│   │   ├── auth.controller.js
│   │   └── auth.service.js
│   │
│   ├── emocional/
│   │   ├── emocional.routes.js
│   │   ├── emocional.controller.js
│   │   └── icve.service.js
│   │
│   ├── ia/
│   │   ├── ia.routes.js
│   │   ├── ia.controller.js
│   │   ├── ia.service.js          # análisis de texto (Claude API) + coach_ia
│   │   ├── ia.voz.service.js       # análisis de voz (pausas, tono, velocidad)
│   │   └── ia.prompts.js
│   │
│   ├── alertas/
│   │   ├── alertas.routes.js
│   │   └── alertas.controller.js
│   │
│   ├── notificaciones/
│   │   ├── notificaciones.routes.js
│   │   ├── notificaciones.controller.js
│   │   └── brevo.service.js
│   │
│   ├── comunitario/
│   │   ├── comunitario.routes.js
│   │   ├── comunitario.controller.js
│   │   ├── gemelo.service.js        # Gemelo Digital Emocional Comunitario
│   │   ├── federado.service.js      # agregación tipo aprendizaje federado
│   │   └── avatar.service.js        # estado visual del avatar según ICVE agregado
│   │
│   ├── middlewares/
│   │   ├── auth.middleware.js
│   │   ├── error.middleware.js
│   │   └── validate.middleware.js
│   │
│   └── server.js
│
├── prisma/
│   └── schema.prisma
│
├── public/
│   ├── index.html                  # check-in diario
│   ├── dashboard.html               # panel del orientador
│   ├── historial.html               # Huella Emocional del estudiante
│   ├── comunitario.html              # vista del Gemelo Digital / Radar
│   │
│   ├── css/
│   │   ├── variables.css
│   │   ├── base.css
│   │   ├── components.css
│   │   ├── checkin.css
│   │   ├── dashboard.css
│   │   ├── historial.css
│   │   └── comunitario.css
│   │
│   └── js/
│       ├── api.js
│       ├── checkin.js
│       ├── dashboard.js
│       ├── historial.js
│       ├── comunitario.js
│       └── utils.js
│
├── test/
├── docs/
├── .env
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
└── README.md
```

- **auth/**: maneja el ciclo de vida del usuario (registro, login, emisión y verificación de JWT).
- **emocional/**: contiene la lógica central del producto — registro diario y el motor de cálculo del ICVE.
- **ia/**: encapsula la llamada a la API de Claude (texto y voz); recibe `texto_usuario`/audio, devuelve sentimiento, factores explicativos y `coach_ia`; nunca expone la clave de API al frontend.
- **alertas/**: convierte un ICVE alto en una alerta accionable para un responsable humano.
- **notificaciones/**: envía el correo automático al orientador vía Brevo cuando se genera una alerta.
- **comunitario/**: expone el Gemelo Digital Emocional Comunitario, la agregación federada por centro, y el estado visual del avatar comunitario.

---

## Modelo de base de datos

La fuente de verdad es [`prisma/schema.prisma`](prisma/schema.prisma); los cambios
se versionan en `prisma/migrations/`. Resumen de las entidades:

| Entidad | Rol en el sistema |
|---|---|
| `Departamento` / `Municipio` | División territorial de Nicaragua. Catálogo, no texto libre. |
| `Institucion` | Centro educativo, ubicado en un municipio. |
| `Usuario` | Persona con `rol` (acceso técnico) y `perfil` (función en el acompañamiento). |
| `RedDeApoyo` | Vincula a un estudiante con las personas en las que confía. |
| `CheckIn` | Registro emocional diario del estudiante. |
| `LineaBase` | Patrón normal del estudiante, para comparar contra sí mismo. |
| `SenalDetectada` | Desviación sostenida respecto de esa línea base. |
| `CasoOrientador` | Seguimiento que abre un orientador a partir de una señal. |
| `ServicioExterno` | Catálogo de servicios a los que se puede derivar. |
| `Derivacion` | Envío de un caso a un servicio externo. |
| `SeguimientoDerivacion` | Confirmación de atención en cada hito (7, 30 días…). |

### Decisiones de modelado

**Roles como enums.** `rol` y `perfil` eran `String` libre: un typo dejaba a un
usuario sin permisos de forma silenciosa. Hoy son enums que Postgres valida.

```prisma
enum Rol    { ADMIN  AUDITOR  USUARIO }
enum Perfil { ESTUDIANTE  DOCENTE  ORIENTADOR  PSICOLOGO  FAMILIA  COMPANERO }
```

Se separan a propósito: `rol` es el nivel de acceso técnico y `perfil` es la
función dentro del acompañamiento. Un orientador es `USUARIO` + `ORIENTADOR`;
un administrador no necesita perfil.

**Municipio normalizado.** Antes era un `String?` dentro de `Institucion`, que
admitía "Managua", "managua" y "Mangua" como lugares distintos e impedía
agrupar métricas por territorio. Ahora es un catálogo con su departamento.

**Hitos de derivación como filas.** `Derivacion` tenía dos columnas booleanas
fijas, `confirmacion7dias` y `confirmacion30dias`. Eso obligaba a migrar la
tabla para añadir cualquier hito nuevo y no permitía saber *cuándo* se
confirmó. Ahora cada hito es una fila de `SeguimientoDerivacion`, con su fecha.
El servicio externo pasó de texto libre a `ServicioExterno`, para poder contar
cuántas derivaciones fueron al mismo lugar.

**Consentimiento persistido.** El formulario lo exigía pero el dato se
descartaba. En una plataforma de salud mental con menores debe quedar
registrado, con la fecha en que se otorgó.

---

## Endpoints de la API

Base URL: `http://localhost:5000/api/v1`

Las rutas protegidas esperan el encabezado `Authorization: Bearer <token>`.

### Auth

**POST /auth/register** — Crea un nuevo usuario.
```json
// Body
{
  "email": "estudiante@centro.edu.ni",
  "nombre": "Kevin Ortega",
  "password": "********",
  "perfil": "ESTUDIANTE",
  "institucionId": 1,
  "consentimiento": true
}
```
`rol` no se acepta desde el cliente: siempre se crea como `USUARIO`. Solo un
administrador puede cambiarlo, vía `PATCH /usuarios/:id/rol`.

**POST /auth/login** — Autentica y devuelve un JWT. Una cuenta con
`activo: false` recibe 401 aunque la contraseña sea correcta.
```json
// Respuesta 200 OK
{
  "token": "<jwt>",
  "usuario": { "id": 8, "email": "...", "rol": "USUARIO", "perfil": "ESTUDIANTE" }
}
```

**GET /auth/me** — Devuelve la sesión del token. El frontend debe armar la
sesión con esto, no deduciendo el perfil a partir del correo.

### Usuarios y permisos

| Endpoint | Quién puede |
|---|---|
| `GET /usuarios` | Solo `ADMIN` y `AUDITOR` |
| `GET /usuarios/estudiantes` | Cualquier sesión, pero **cada quien recibe una lista distinta** |
| `GET /usuarios/:id/checkins` | Solo si el solicitante tiene acceso a ese estudiante |
| `PATCH /usuarios/:id/rol` | Solo `ADMIN` (no sobre sí mismo) |
| `PATCH /usuarios/:id/estado` | Solo `ADMIN` (no sobre sí mismo) |

La visibilidad se resuelve en `alcanceDeEstudiantes()`
([src/middlewares/permisos.middlewares.js](src/middlewares/permisos.middlewares.js)),
que devuelve un filtro Prisma para que la consulta nazca ya acotada en vez de
traer todo y filtrar después:

- `ADMIN` / `AUDITOR` → toda la plataforma.
- `ORIENTADOR` / `PSICOLOGO` → los estudiantes de su propia institución.
- `FAMILIA` / `COMPANERO` → solo quien los incluyó en su red de apoyo.
- `ESTUDIANTE` → únicamente sus propios datos.

### Registros emocionales

**GET /registros** — Historial de registros del usuario autenticado (alimenta la Huella Emocional).

**POST /registros** — Cierra el check-in: guarda, calcula el ICVE, analiza y
evalúa si abre una señal. Los `turnos` son los intercambios que devolvió
`/ia/checkin/turno` con la respuesta que dio el estudiante.
```json
// Body
{
  "turnos": [
    { "pregunta": "¿Anoche te dormiste de una o le diste vueltas?",
      "respuesta": "👀 Casi nada", "componente": "sueno", "valor": 1 },
    { "pregunta": "¿Con quién hablaste ayer que no fuera por obligación?",
      "respuesta": "🎧 Con nadie", "componente": "vinculo", "valor": 2 }
  ],
  "texto_usuario": "Esta semana me ha costado dormir.",
  "voz": null
}
```
`componente` es uno de `animo`, `sueno`, `energia`, `vinculo`,
`concentracion` o `libre`. Un componente sin responder se excluye del ICVE y los
pesos se renormalizan sobre los presentes: inventar un valor neutro donde no
hubo respuesta ensucia la serie con la que se compara al estudiante.

```json
// Respuesta 201 Created
{
  "icve": 72, "delta": 18, "linea_base": 54,
  "coach": "Dos noches cortas seguidas. Probá acostarte media hora antes hoy.",
  "factores": [
    { "factor": "Sueño más corto", "evidencia": "Reporta haber dormido poco dos días seguidos.", "direccion": "tensiona" }
  ],
  "explicacion": "El sueño corto viene junto con menos contacto con otros.",
  "sentimiento": "negativo", "confianza": 0.74,
  "acompanamiento": true,
  "contencion": null
}
```

### Análisis de IA

**POST /ia/checkin/turno** — Devuelve el siguiente intercambio del check-in.
Se manda la sesión completa en cada llamada: el backend no guarda estado
conversacional, así que el endpoint es idempotente por turno y recargar la
página no deja un check-in a medias en la base.
```json
// Body
{ "sesion": [ { "pregunta": "…", "respuesta": "…", "componente": "animo", "valor": 4 } ] }

// Respuesta 200 OK
{
  "reaccion": "Anotado, dos noches cortas seguidas se sienten.",
  "pregunta": "¿Con quién hablaste ayer que no fuera por obligación?",
  "componente": "vinculo",
  "formato": "opciones",
  "opciones": [
    { "etiqueta": "Con varios", "emoji": "👥", "valor": 5 },
    { "etiqueta": "Con nadie",  "emoji": "🎧", "valor": 2 }
  ],
  "cierre": false, "turno": 3, "racha": 12, "generado": true
}
```
`generado: false` significa que la IA no estaba disponible y la pregunta vino
del banco local. El frontend lo muestra: que el estudiante sepa cuándo hay un
modelo detrás y cuándo no es parte de lo que la plataforma le promete.

**GET /ia/estado** — Si el módulo tiene clave configurada y con qué modelo.

**POST /ia/analizar-texto** — Analiza un texto suelto, fuera del check-in.

**POST /ia/analizar-voz** — Analiza características prosódicas ya extraídas en
el cliente (`{ "caracteristicas": {...}, "consentimiento": true }`). No recibe
audio ni transcripción, y `consentimiento` no tiene valor por defecto.

### Alertas

**GET /alertas** — Lista alertas activas (requiere rol de orientador/institución).

**DELETE /alertas/:id** — Cierra una alerta una vez atendida.

### Notificaciones

Disparadas automáticamente al crearse una alerta; no requieren llamada manual desde el frontend.

### Comunitario

**GET /comunitario/gemelo** — Estado agregado y anonimizado del Gemelo Digital Emocional por centro/comunidad.

**GET /comunitario/radar** — Tendencias agregadas por aula o centro.

**GET /comunitario/avatar** — Estado visual actual del avatar comunitario, derivado del ICVE agregado.

Para documentación completa de la API, consulta la referencia en Postman / Swagger.

---

## Contribuciones

1. Haz un fork del repositorio
2. Crea una rama: `git checkout -b feature/mi-feature`
3. Haz commit de tus cambios: `git commit -m 'feat: agrego mi feature'`
4. Haz push: `git push origin feature/mi-feature`
5. Abre un Pull Request

**Convención del proyecto:** carpetas y archivos siempre en minúscula, patrón `modulo.routes.js` / `modulo.controller.js` / `modulo.service.js` (singular).

---

## Licencia

© 2026 Legacy4Nic
