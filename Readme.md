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
El módulo `ia` llama a la API de Claude para analizar el `texto_usuario` de cada registro y devolver un sentimiento, factores de riesgo explicativos y una sugerencia del **Coach IA** (recomendación personalizada para el propio estudiante). De forma opcional y con consentimiento explícito, también analiza características de voz (pausas, tono, velocidad del habla) como una segunda fuente de datos. Ambos resultados alimentan el cálculo del `riesgo_emocional` dentro del ICVE y se guardan en `factores_explicativos` (JSON) para mantener trazabilidad y explicabilidad.

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
| IA_API_KEY | Sí | Clave de la API de Claude para el módulo ia | sk-ant-... |
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

```prisma
model Usuario {
  id              String   @id @default(uuid())
  edad            Int?
  tipoUsuario     String   @map("tipo_usuario")
  centroId        String?  @map("centro_id")
  comunidadId     String?  @map("comunidad_id")
  consentimiento  Boolean
  fechaRegistro   DateTime @default(now()) @map("fecha_registro")

  registros       RegistroEmocional[]
  predicciones    PrediccionRiesgo[]
  alertas         Alerta[]
  intervenciones  Intervencion[]

  @@map("usuarios")
}

model RegistroEmocional {
  id             String   @id @default(uuid())
  usuarioId      String   @map("usuario_id")
  usuario        Usuario  @relation(fields: [usuarioId], references: [id])
  emocion        String
  nivelEstres    Int      @map("nivel_estres")
  horasSueno     Decimal  @map("horas_sueno")
  energia        Int
  concentracion  Int
  apoyoSocial    Int      @map("apoyo_social")
  textoUsuario   String?  @map("texto_usuario")
  audioUrl       String?  @map("audio_url")
  fecha          DateTime @default(now())

  @@map("registros_emocionales")
}

model PrediccionRiesgo {
  id                    String   @id @default(uuid())
  usuarioId             String   @map("usuario_id")
  usuario               Usuario  @relation(fields: [usuarioId], references: [id])
  puntajeIcve           Decimal  @map("puntaje_icve")
  nivelRiesgo           String   @map("nivel_riesgo")
  confianzaModelo       Decimal  @map("confianza_modelo")
  factoresExplicativos  Json     @map("factores_explicativos")
  coachIa               String?  @map("coach_ia")
  fecha                 DateTime @default(now())

  @@map("predicciones_riesgo")
}

model Alerta {
  id             String    @id @default(uuid())
  usuarioId      String    @map("usuario_id")
  usuario        Usuario   @relation(fields: [usuarioId], references: [id])
  nivelAlerta    String    @map("nivel_alerta")
  estado         String
  responsableId  String?   @map("responsable_id")
  fechaCreacion  DateTime  @default(now()) @map("fecha_creacion")
  fechaCierre    DateTime? @map("fecha_cierre")

  @@map("alertas")
}

model Intervencion {
  id                String   @id @default(uuid())
  usuarioId         String   @map("usuario_id")
  usuario           Usuario  @relation(fields: [usuarioId], references: [id])
  tipoIntervencion  String   @map("tipo_intervencion")
  descripcion       String?
  completada        Boolean  @default(false)
  efectividad       Decimal?
  fecha             DateTime @default(now())

  @@map("intervenciones")
}

model ParametroFederado {
  id                  String   @id @default(uuid())
  centroId            String   @map("centro_id")
  icvePromedio        Decimal  @map("icve_promedio")
  totalRegistros      Int      @map("total_registros")
  fechaActualizacion  DateTime @default(now()) @map("fecha_actualizacion")

  @@map("parametros_federados")
}
```

---

## Endpoints de la API

Base URL: `http://localhost:3000/api/v1`

### Auth

**POST /auth/register** — Crea un nuevo usuario.
```json
// Body
{
  "edad": 19,
  "tipo_usuario": "estudiante",
  "centro_id": "uuid",
  "consentimiento": true,
  "password": "********"
}
```

**POST /auth/login** — Autentica y devuelve un JWT.
```json
// Respuesta 200 OK
{
  "token": "<jwt>",
  "usuario": { "id": "uuid", "tipo_usuario": "estudiante" }
}
```

### Registros emocionales

**GET /registros** — Historial de registros del usuario autenticado (alimenta la Huella Emocional).

**POST /registros** — Crea un registro y dispara el recálculo del ICVE.
```json
// Body
{
  "emocion": "ansiedad",
  "nivel_estres": 7,
  "horas_sueno": 5.5,
  "energia": 4,
  "concentracion": 5,
  "apoyo_social": 6,
  "texto_usuario": "Esta semana me ha costado dormir.",
  "audio_url": null
}
```

### Análisis de IA

**POST /ia/analizar-texto** — Analiza texto y devuelve sentimiento, factores explicativos y Coach IA.
```json
// Respuesta 200 OK
{
  "sentimiento": "negativo",
  "confianza_modelo": 0.84,
  "factores_principales": ["Disminución del sueño", "Percepción de aislamiento social"],
  "explicacion": "El texto muestra señales de fatiga y desconexión del entorno social.",
  "coach_ia": "Notamos que has dormido menos esta semana. Intenta acostarte 30 minutos antes hoy."
}
```

**POST /ia/analizar-voz** — Analiza un audio opcional (requiere consentimiento explícito).

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
