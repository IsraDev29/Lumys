-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "CasoOrientador" (
    "id" SERIAL NOT NULL,
    "senalId" INTEGER NOT NULL,
    "orientadorId" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'abierto',
    "planSeguridad" TEXT,
    "accionRegistrada" TEXT,
    "fechaCierre" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CasoOrientador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckIn" (
    "id" SERIAL NOT NULL,
    "estudianteId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respuestasJson" TEXT NOT NULL,
    "textoLibre" TEXT,
    "resumenIa" TEXT,
    "icvePuntaje" INTEGER,

    CONSTRAINT "CheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Derivacion" (
    "id" SERIAL NOT NULL,
    "casoId" INTEGER NOT NULL,
    "servicioExterno" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmacion7dias" BOOLEAN NOT NULL DEFAULT false,
    "confirmacion30dias" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Derivacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Institucion" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "municipio" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Institucion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineaBase" (
    "id" SERIAL NOT NULL,
    "estudianteId" INTEGER NOT NULL,
    "promedioIcveMovil" DOUBLE PRECISION,
    "patronNormalJson" TEXT,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LineaBase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RedDeApoyo" (
    "id" SERIAL NOT NULL,
    "estudianteId" INTEGER NOT NULL,
    "contactoId" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 1,
    "excluidoDeAlerta" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RedDeApoyo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SenalDetectada" (
    "id" SERIAL NOT NULL,
    "estudianteId" INTEGER NOT NULL,
    "deltaIcve" DOUBLE PRECISION,
    "componentePatronJson" TEXT,
    "lenguajeRiesgoExplicito" BOOLEAN NOT NULL DEFAULT false,
    "semanasSostenidas" INTEGER NOT NULL DEFAULT 0,
    "nivelRespuesta" INTEGER NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SenalDetectada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "contacto" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" TEXT NOT NULL DEFAULT 'USUARIO',
    "perfil" TEXT,
    "institucionId" INTEGER,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CasoOrientador_senalId_key" ON "CasoOrientador"("senalId");

-- CreateIndex
CREATE UNIQUE INDEX "LineaBase_estudianteId_key" ON "LineaBase"("estudianteId");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_contacto_key" ON "Usuario"("contacto");

-- AddForeignKey
ALTER TABLE "CasoOrientador" ADD CONSTRAINT "CasoOrientador_orientadorId_fkey" FOREIGN KEY ("orientadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasoOrientador" ADD CONSTRAINT "CasoOrientador_senalId_fkey" FOREIGN KEY ("senalId") REFERENCES "SenalDetectada"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Derivacion" ADD CONSTRAINT "Derivacion_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "CasoOrientador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineaBase" ADD CONSTRAINT "LineaBase_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedDeApoyo" ADD CONSTRAINT "RedDeApoyo_contactoId_fkey" FOREIGN KEY ("contactoId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedDeApoyo" ADD CONSTRAINT "RedDeApoyo_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SenalDetectada" ADD CONSTRAINT "SenalDetectada_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_institucionId_fkey" FOREIGN KEY ("institucionId") REFERENCES "Institucion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

