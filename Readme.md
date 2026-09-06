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
- [Identidad de marca](#identidad-de-marca)
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

**Backend**

| Tecnología | Versión | Uso |
|---|---|---|
| Node.js | 20.x o superior | Runtime del backend |
| Express | 4.x | Framework de la API REST |
| Prisma | 5.x | ORM para PostgreSQL |
| PostgreSQL (NeonDB) | 15 | Base de datos relacional serverless |
| JWT (jsonwebtoken) | 9.x | Autenticación basada en tokens |
| bcrypt | 5.x | Hash de contraseñas |
| zod | 3.x | Validación de payloads en cada endpoint |
| Claude API (@anthropic-ai/sdk) | 0.27.x | Conducción del check-in, Coach IA y explicabilidad |
| Brevo | — | Envío de notificaciones por correo al orientador/a |

**Frontend** (`client/`)

| Tecnología | Versión | Uso |
|---|---|---|
| React | 19.x | Interfaz completa, una sola aplicación |
| TypeScript | 7.x | Tipos del dominio compartidos entre vistas |
| Vite | 8.x | Servidor de desarrollo y empaquetado |
| react-router-dom | 7.x | Enrutado con rutas de diseño por rol |
| Tailwind CSS | **3.4.x** | Sistema visual de las pantallas portadas |
| Bootstrap | 5.3.x | Estilos heredados de las vistas aún sin portar |

> **Tailwind v3, no v4.** Los diseños de origen se hicieron con el Play CDN, que
> es v3. En v4 cambian la escala de sombras, el grosor de `ring`, el color de
> borde por defecto y los nombres de degradado: migrar reinterpretaría más de
> mil clases y perdería la fidelidad. Ver `client/tailwind.config.js`.

El avatar del gemelo y la mascota **no** usan DiceBear ni ningún servicio
externo: son SVG propios, con un rig de 33 estados en `client/src/lumy/`.

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
#    El `postinstall` instala también las de client/, así que no hace falta
#    entrar a esa carpeta a mano.
npm install

# 3. Configura las variables de entorno
cp .env.example .env
# Edita el archivo .env con tus valores reales

# 4. Ejecuta las migraciones de Prisma
npx prisma migrate dev
```

## Ejecución

```bash
# Desarrollo: levanta la API y el cliente a la vez
npm run dev

# Solo uno de los dos
npm run dev:api        # Express con nodemon, puerto 5000
npm run dev:client     # Vite, puerto 5173

# Producción: compila el cliente y sirve la API
npm run build
npm start
```

En desarrollo se abren dos puertos: **Vite en 5173**, que es donde se navega, y
**Express en 5000**. El proxy de Vite manda `/api/v1/...` al segundo, así que la
ruta de las peticiones es la misma en desarrollo y en producción y no existe una
rama "si estamos en dev, la URL es otra".

Los dos puertos se pueden mover con `PORT` (Vite) y `PUERTO_API` (Express).

**Pruebas:**

```bash
npm test                 # toda la suite
npm run test:privacidad   # alcance por rol y cabeceras de seguridad
npm run test:lumy         # fidelidad del rig de la mascota
npm run tipos             # comprobación de tipos del cliente
```

---

## Arquitectura del sistema

Lumys usa un **monolito modular** (no microservicios desplegados por separado), una decisión deliberada para mantener velocidad de desarrollo y un único punto de despliegue, mientras conserva separación de responsabilidades por dominio dentro del propio backend. Cada módulo ya está desacoplado internamente, por lo que el sistema podría escalar a microservicios reales en el futuro sin reescribir lógica de negocio.

```
Cliente: React 19 + TypeScript + Vite  (client/)
         vistas → lib/api.ts → lib/metricas.ts
                |
                |  fetch /api/v1/…  (proxy de Vite en desarrollo)
                v
          API REST (Express)
                |
   _____________|_____________________________________
   |         |          |            |                |
[Auth]  [Emocional] [IA/NLP]   [Alertas]      [Comunitario]
   |         |     (texto+voz)     |         (Gemelo + Radar
   |         |          |          |          + Avatar + Federado)
   |_________|__________|__________|________________|
                          |                    |
                          v                    v
                    Prisma ORM           API de Brevo
                          |         (correo al orientador/a)
                          v
                PostgreSQL (NeonDB)
```

**Patrón:** arquitectura en capas (router → controller → service → Prisma)
dentro de cada módulo, organizada por dominio.

### La capa de métricas del cliente

`client/src/lib/metricas.ts` traduce lo que devuelve la API a lo que dibuja cada
gráfico, y deriva las métricas que ningún endpoint calcula todavía.

Existe porque el cliente y el servidor **no comparten la forma de las
respuestas**, y eso pasaba inadvertido: los perfiles de demostración entran sin
autenticar, el servidor respondía 401, el respaldo de `lib/demo.ts` se activaba
y la pantalla se veía perfecta con los datos de otro. Con una sesión real el
gemelo manda `serie` donde el gráfico lee `lineaBase`, `clima` llega como objeto
donde se espera una cadena, y el radar del centro manda promedios en escala 1-5
que el SVG dibuja como porcentaje del radio.

Sus funciones son puras y están cubiertas por `test/metricas.test.js`.

**Regla que gobierna medio archivo:** el ICVE va de 0 a 100 y **más alto es más
vulnerabilidad**; en los componentes sueltos es al revés, 5 es la mejor
situación. Confundir los dos signos le diría a un estudiante que mejoró justo el
día que empeoró.

**Qué no se dibuja.** Varias pantallas mostraban cifras escritas a mano con la
misma tipografía que las reales — porcentajes de confianza, de derivaciones
confirmadas, horas protegidas. Ninguna estaba instrumentada. Se retiraron y en
su lugar hay una nota que dice qué falta medir: un número inventado en un panel
que se usa para decidir es peor que un hueco.

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
- **`avatar.service.js`**: traduce el ICVE a un clima —`despejado`, `parcial`, `nublado`, `tormenta`— que el cliente dibuja con la mascota. Es la única capa donde un número se convierte en algo que un adolescente lee sobre sí mismo, y por eso tiene reglas propias: el titular es el clima y nunca el número (un "78" invita a compararse con el "60" de un compañero), el lenguaje describe el día y no a la persona, y ningún estado es un fracaso. Un quinto valor, `sin_datos`, no es un clima sino su ausencia: decirlo así evita que alguien recién llegado vea "despejado" y crea que el sistema ya sabe algo de él. El dibujo es SVG propio, sin DiceBear ni APIs de terceros con licencia.

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
| PORT | No | Puerto de Vite en desarrollo. Por defecto 5173. | 5173 |
| PUERTO_API | No | Puerto de Express. Por defecto 5000. | 5000 |
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
├── src/                              # backend (CommonJS)
│   ├── auth/          auth.routes.js · auth.controller.js · auth.service.js · auth.schema.js
│   ├── usuarios/      usuarios.routes.js · usuarios.controller.js   # alcance por rol
│   ├── Emocional/     emocional.routers.js · emocional.controlers.js
│   │                  icve.service.js          # motor del ICVE, aritmética pura
│   ├── IA/            ia.routers.js · ia.controller.js · ia.schema.js
│   │                  ia.service.js            # conduce el check-in con Claude
│   │                  ia.voz.service.js        # prosodia, nunca audio
│   │                  ia.seguridad.js          # léxico determinista de riesgo
│   │                  ia.prompt.js
│   ├── alertas/       alerta.router.js · alerta.controller.js · alerta.service.js
│   ├── comunitario/   comunitario.routers.js · comunitario.controller.js
│   │                  gemelo.service.js        # gemelo del propio estudiante
│   │                  federado.service.js      # agregados con umbral mínimo
│   │                  avatar.service.js        # ICVE → clima
│   ├── middlewares/   auth · error · permisos · seguridad · validate
│   ├── db.js
│   └── server.js
│
├── client/                           # frontend (React 19 + TS, ESM)
│   ├── src/
│   │   ├── vistas/       una por pantalla: Bienvenida, Acceso, Inicio, Checkin,
│   │   │                 Historial, Red, Capsulas, Respirar, Logros, Perfil,
│   │   │                 Orientador, Psicologo, Institucional, Comunitario, …
│   │   ├── componentes/  Cascaron, BarraInferior, Identidad, graficos, comunes…
│   │   ├── lumy/         rig de la mascota: 33 estados sobre una sola geometría
│   │   ├── lib/          api.ts · metricas.ts · tipos.ts · demo.ts · voz.ts
│   │   │                 progreso.ts · ambiente.ts · almacen.ts · movimiento.ts
│   │   └── estilos/      CSS propio heredado + stitch.css (capa de Tailwind)
│   ├── public/img/       isotipo y mascota
│   ├── tailwind.config.js
│   └── vite.config.ts
│
├── prisma/schema.prisma
├── test/                             # node --test, sin framework externo
├── tools/                            # exportador de SVG del rig
├── docs/
└── package.json
```

**Backend**

- **auth/** — ciclo de vida del usuario: registro, login, emisión y verificación de JWT.
- **usuarios/** — administración y, sobre todo, `alcanceDeEstudiantes()`: quién puede ver a quién.
- **Emocional/** — el registro diario y el motor del ICVE. Toda la aritmética que dispara alertas vive acá, no en el modelo.
- **IA/** — conduce el check-in y explica el resultado; nunca expone la clave al cliente.
- **alertas/** — convierte una señal sostenida en algo accionable para una persona.
- **comunitario/** — el gemelo del estudiante, los agregados del centro y la traducción de ICVE a clima.

No hay módulo `notificaciones/`: el envío por Brevo se dispara desde el flujo de
alertas.

**Frontend**

- **vistas/** — una por pantalla. No comparten estado entre sí: cada una pide lo suyo con `useDatos`.
- **lib/api.ts** — único punto de contacto con la API. Si el servidor no responde, cae al respaldo de `demo.ts` para que el recorrido completo siga siendo navegable.
- **lib/metricas.ts** — traduce las respuestas del servidor y deriva las métricas sin endpoint.
- **lumy/** — el rig de la mascota. Las poses **deforman** la geometría original, nunca la redibujan; `test/lumy.test.js` lo comprueba.

---

## Identidad de marca

**Paleta 2026:** lavanda, celeste, sol y navy. Las variables `--lm-emerald` y
`--lm-teal` que aparecen en el CSS son alias heredados de la paleta anterior y
**no son verdes**: apuntan a los tonos actuales. No conviene fiarse del nombre.

**Isotipo** — `client/src/componentes/Identidad.tsx` (componente) y
`client/public/img/lumys-isotipo.svg` (copia estática para el favicon y los
iconos del PWA, que no pueden ser React). Son el mismo dibujo en dos formatos:
si el `d` de la silueta cambia en uno, tiene que cambiar en el otro.

La silueta es una blob armónica, `r(θ) = 296·(1 + 0.055·cos(5θ − 0.55) +
0.022·cos(2θ + 1.10))`, muestreada en 64 puntos y cerrada con Catmull-Rom. Se
llegó ahí después de descartar dos caminos: una curva de ocho nodos con valles
profundos daba un diamante con puntas en las diagonales, y construirla como
unión de círculos dejaba muescas en punta allí donde dos círculos se cortan. Una
suma de cosenos no tiene esquinas por construcción.

**Logotipo** — se renderiza en línea y no como `<img>`: un SVG cargado como
imagen no carga fuentes web, así que "Lumys" saldría con la tipografía por
defecto del navegador en vez de con Fredoka.

**Mascota (Lumy)** — `client/src/lumy/`. Un rig de 33 estados sobre una sola
geometría, repartidos en dos bandas:

- **apoyo** — las que Lumy adopta por su cuenta.
- **espejo** — solo cuando el estudiante nombra lo suyo primero.

La distinción está en los tipos, no en una convención: `<Lumy emocion="tristeza" />`
no compila sin `espejo`. Si alguien reporta que durmió mal y la mascota se pone
triste, se valida el afecto pero se amplifica.

> **Estado actual.** El SVG de referencia (`lumys-mascota.svg`) se reemplazó por
> un PNG, y con él dejó de funcionar la comparación automática de
> `test/lumy.test.js`: contra un mapa de bits no se puede verificar que ningún
> trazo se haya movido. Faltan emociones por reponer en el rig.

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

Son dos vistas con audiencias distintas, y por eso viven en rutas distintas con
permisos distintos. La segunda no es "la primera pero de todos": es una
agregación con umbral mínimo, porque el promedio de un grupo chico identifica a
sus miembros.

**GET /comunitario/gemelo** — El gemelo del **propio estudiante**: su clima de
hoy, su serie de los últimos catorce días y qué se movió respecto de su patrón.
Siempre sobre `req.usuario.id`, nunca sobre un id de la URL.

```json
// Respuesta 200 OK
{
  "nombre": "Kevin",
  "clima": { "id": "nublado", "titulo": "Día nublado", "mensaje": "…", "mascota": "atenta" },
  "titular": "Hoy venís parecido a tu propio promedio.",
  "racha": 12, "totalRegistros": 27, "checkinHoy": true,
  "serie": [ { "fecha": "2026-09-01T…", "valor": 64 } ],
  "promedioPropio": 72,
  "ipsativa": [
    { "componente": "sueno", "etiqueta": "Sueño", "hoy": 2,
      "habitual": 3.4, "delta": -1.4, "tendencia": "baja",
      "nota": "Por debajo de tu promedio" }
  ],
  "mensaje": "Gracias por aparecer hoy."
}
```

**GET /comunitario/radar** — El gemelo **del centro**, para orientador/a,
psicólogo o docente. Devuelve `suficiente: false` cuando el mes no llega al
mínimo de registros: por debajo de ese umbral no se promedia nada. Los valores
de `actual` y `promedio` vienen en la escala 1-5 de los componentes, no en
porcentaje.

Un usuario sin institución recibe **409**, no un 200 con todo en null: responder
que sí y devolver vacío mentiría sobre por qué la pantalla está en blanco.

No existe `GET /comunitario/avatar`. El clima viaja dentro de las dos respuestas
anteriores y la traducción a estado visual la hace el cliente.

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
