-- Migración escrita a mano: la que genera Prisma automáticamente resuelve los
-- renombres como DROP + ADD, lo que borraría los correos, roles y check-ins ya
-- cargados. Aquí se usa RENAME COLUMN y USING para conservar los datos.

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------
CREATE TYPE "Rol" AS ENUM ('ADMIN', 'AUDITOR', 'USUARIO');
CREATE TYPE "Perfil" AS ENUM ('ESTUDIANTE', 'DOCENTE', 'ORIENTADOR', 'PSICOLOGO', 'FAMILIA', 'COMPANERO');
CREATE TYPE "EstadoCaso" AS ENUM ('ABIERTO', 'SEGUIMIENTO', 'DERIVADO', 'CERRADO');
CREATE TYPE "EstadoDerivacion" AS ENUM ('PENDIENTE', 'ACEPTADA', 'ATENDIDA', 'RECHAZADA');
CREATE TYPE "TipoServicio" AS ENUM ('SALUD_MENTAL', 'SALUD_PUBLICA', 'PROTECCION_INFANCIA', 'LINEA_CRISIS');

-- ---------------------------------------------------------------------------
-- 2. División territorial
-- ---------------------------------------------------------------------------
CREATE TABLE "Departamento" (
    "id"     SERIAL NOT NULL,
    "nombre" TEXT   NOT NULL,
    CONSTRAINT "Departamento_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Departamento_nombre_key" ON "Departamento"("nombre");

CREATE TABLE "Municipio" (
    "id"             SERIAL  NOT NULL,
    "nombre"         TEXT    NOT NULL,
    "departamentoId" INTEGER NOT NULL,
    CONSTRAINT "Municipio_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Municipio_nombre_departamentoId_key" ON "Municipio"("nombre", "departamentoId");
ALTER TABLE "Municipio" ADD CONSTRAINT "Municipio_departamentoId_fkey"
    FOREIGN KEY ("departamentoId") REFERENCES "Departamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Catálogo base: los 15 departamentos y las 2 regiones autónomas de Nicaragua,
-- con su cabecera municipal. Basta para que Institucion deje de guardar texto
-- libre; el resto de municipios se puede cargar después sin migración.
INSERT INTO "Departamento" ("nombre") VALUES
    ('Boaco'), ('Carazo'), ('Chinandega'), ('Chontales'), ('Estelí'),
    ('Granada'), ('Jinotega'), ('León'), ('Madriz'), ('Managua'),
    ('Masaya'), ('Matagalpa'), ('Nueva Segovia'), ('Río San Juan'), ('Rivas'),
    ('Costa Caribe Norte'), ('Costa Caribe Sur');

INSERT INTO "Municipio" ("nombre", "departamentoId")
SELECT c.municipio, d."id"
FROM (VALUES
    ('Boaco', 'Boaco'), ('Jinotepe', 'Carazo'), ('Chinandega', 'Chinandega'),
    ('Juigalpa', 'Chontales'), ('Estelí', 'Estelí'), ('Granada', 'Granada'),
    ('Jinotega', 'Jinotega'), ('León', 'León'), ('Somoto', 'Madriz'),
    ('Managua', 'Managua'), ('Masaya', 'Masaya'), ('Matagalpa', 'Matagalpa'),
    ('Ocotal', 'Nueva Segovia'), ('San Carlos', 'Río San Juan'), ('Rivas', 'Rivas'),
    ('Bilwi', 'Costa Caribe Norte'), ('Bluefields', 'Costa Caribe Sur')
) AS c(municipio, departamento)
JOIN "Departamento" d ON d."nombre" = c.departamento;

-- ---------------------------------------------------------------------------
-- 3. Institucion: municipio de texto libre -> FK al catálogo
-- ---------------------------------------------------------------------------
ALTER TABLE "Institucion" ADD COLUMN "municipioId" INTEGER;

UPDATE "Institucion" i
SET "municipioId" = m."id"
FROM "Municipio" m
WHERE lower(trim(i."municipio")) = lower(m."nombre");

ALTER TABLE "Institucion" DROP COLUMN "municipio";
ALTER TABLE "Institucion" ADD CONSTRAINT "Institucion_municipioId_fkey"
    FOREIGN KEY ("municipioId") REFERENCES "Municipio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 4. Usuario: contacto -> email, y rol/perfil de texto libre a enum
-- ---------------------------------------------------------------------------
ALTER TABLE "Usuario" RENAME COLUMN "contacto" TO "email";
ALTER INDEX "Usuario_contacto_key" RENAME TO "Usuario_email_key";

ALTER TABLE "Usuario" ALTER COLUMN "rol" DROP DEFAULT;
ALTER TABLE "Usuario" ALTER COLUMN "rol" TYPE "Rol" USING upper(trim("rol"))::"Rol";
ALTER TABLE "Usuario" ALTER COLUMN "rol" SET DEFAULT 'USUARIO';

ALTER TABLE "Usuario" ALTER COLUMN "perfil" TYPE "Perfil"
    USING (CASE WHEN "perfil" IS NULL OR trim("perfil") = '' THEN NULL
                ELSE upper(trim("perfil"))::"Perfil" END);

-- ---------------------------------------------------------------------------
-- 5. RedDeApoyo: contactoId se confundía con Usuario.contacto
-- ---------------------------------------------------------------------------
ALTER TABLE "RedDeApoyo" RENAME COLUMN "contactoId" TO "personaApoyoId";
ALTER TABLE "RedDeApoyo" RENAME CONSTRAINT "RedDeApoyo_contactoId_fkey" TO "RedDeApoyo_personaApoyoId_fkey";
CREATE UNIQUE INDEX "RedDeApoyo_estudianteId_personaApoyoId_key"
    ON "RedDeApoyo"("estudianteId", "personaApoyoId");

-- ---------------------------------------------------------------------------
-- 6. Campos *Json: eran TEXT con JSON adentro, ahora son JSONB consultables
-- ---------------------------------------------------------------------------
ALTER TABLE "CheckIn" RENAME COLUMN "respuestasJson" TO "respuestas";
ALTER TABLE "CheckIn" ALTER COLUMN "respuestas" TYPE JSONB USING "respuestas"::jsonb;
ALTER TABLE "CheckIn" RENAME COLUMN "icvePuntaje" TO "puntajeIcve";
CREATE INDEX "CheckIn_estudianteId_fecha_idx" ON "CheckIn"("estudianteId", "fecha");

ALTER TABLE "LineaBase" RENAME COLUMN "patronNormalJson" TO "patronNormal";
ALTER TABLE "LineaBase" ALTER COLUMN "patronNormal" TYPE JSONB USING "patronNormal"::jsonb;

ALTER TABLE "SenalDetectada" RENAME COLUMN "componentePatronJson" TO "componentePatron";
ALTER TABLE "SenalDetectada" ALTER COLUMN "componentePatron" TYPE JSONB USING "componentePatron"::jsonb;
CREATE INDEX "SenalDetectada_estudianteId_creadoEn_idx" ON "SenalDetectada"("estudianteId", "creadoEn");

-- ---------------------------------------------------------------------------
-- 7. CasoOrientador.estado -> enum (el dato existente viene en minúsculas)
-- ---------------------------------------------------------------------------
ALTER TABLE "CasoOrientador" ALTER COLUMN "estado" DROP DEFAULT;
ALTER TABLE "CasoOrientador" ALTER COLUMN "estado" TYPE "EstadoCaso" USING upper(trim("estado"))::"EstadoCaso";
ALTER TABLE "CasoOrientador" ALTER COLUMN "estado" SET DEFAULT 'ABIERTO';

-- ---------------------------------------------------------------------------
-- 8. Derivacion: catálogo de servicios + hitos como filas
--
-- Antes: servicioExterno era texto libre (no se podía saber cuántas
-- derivaciones fueron al mismo lugar) y las confirmaciones eran dos columnas
-- booleanas fijas, sin fecha y sin poder añadir un hito nuevo sin migrar.
-- ---------------------------------------------------------------------------
CREATE TABLE "ServicioExterno" (
    "id"          SERIAL         NOT NULL,
    "nombre"      TEXT           NOT NULL,
    "tipo"        "TipoServicio" NOT NULL,
    "telefono"    TEXT,
    "municipioId" INTEGER,
    "activo"      BOOLEAN        NOT NULL DEFAULT true,
    CONSTRAINT "ServicioExterno_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "ServicioExterno" ADD CONSTRAINT "ServicioExterno_municipioId_fkey"
    FOREIGN KEY ("municipioId") REFERENCES "Municipio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Cada servicio que ya aparecía como texto pasa a ser una fila del catálogo.
INSERT INTO "ServicioExterno" ("nombre", "tipo")
SELECT DISTINCT trim("servicioExterno"), 'SALUD_MENTAL'::"TipoServicio"
FROM "Derivacion"
WHERE "servicioExterno" IS NOT NULL AND trim("servicioExterno") <> '';

ALTER TABLE "Derivacion" ADD COLUMN "servicioExternoId" INTEGER;
ALTER TABLE "Derivacion" ADD COLUMN "estado" "EstadoDerivacion" NOT NULL DEFAULT 'PENDIENTE';
ALTER TABLE "Derivacion" ADD COLUMN "motivo" TEXT;

UPDATE "Derivacion" d
SET "servicioExternoId" = s."id"
FROM "ServicioExterno" s
WHERE s."nombre" = trim(d."servicioExterno");

CREATE TABLE "SeguimientoDerivacion" (
    "id"                SERIAL  NOT NULL,
    "derivacionId"      INTEGER NOT NULL,
    "diasHito"          INTEGER NOT NULL,
    "confirmado"        BOOLEAN NOT NULL DEFAULT false,
    "fechaConfirmacion" TIMESTAMP(3),
    "observacion"       TEXT,
    CONSTRAINT "SeguimientoDerivacion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SeguimientoDerivacion_derivacionId_diasHito_key"
    ON "SeguimientoDerivacion"("derivacionId", "diasHito");
ALTER TABLE "SeguimientoDerivacion" ADD CONSTRAINT "SeguimientoDerivacion_derivacionId_fkey"
    FOREIGN KEY ("derivacionId") REFERENCES "Derivacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Las dos columnas booleanas se convierten en dos filas de hito por derivación.
INSERT INTO "SeguimientoDerivacion" ("derivacionId", "diasHito", "confirmado")
SELECT "id", 7, "confirmacion7dias" FROM "Derivacion"
UNION ALL
SELECT "id", 30, "confirmacion30dias" FROM "Derivacion";

ALTER TABLE "Derivacion" DROP COLUMN "servicioExterno";
ALTER TABLE "Derivacion" DROP COLUMN "confirmacion7dias";
ALTER TABLE "Derivacion" DROP COLUMN "confirmacion30dias";
ALTER TABLE "Derivacion" ALTER COLUMN "servicioExternoId" SET NOT NULL;
ALTER TABLE "Derivacion" ADD CONSTRAINT "Derivacion_servicioExternoId_fkey"
    FOREIGN KEY ("servicioExternoId") REFERENCES "ServicioExterno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
