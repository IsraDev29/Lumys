-- El formulario exigía aceptar los términos, pero el dato se descartaba.
-- Los usuarios que ya existían se dan por consentidos en su fecha de registro,
-- que es cuando aceptaron.
ALTER TABLE "Usuario" ADD COLUMN "consentimiento" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Usuario" ADD COLUMN "fechaConsentimiento" TIMESTAMP(3);

UPDATE "Usuario" SET "consentimiento" = true, "fechaConsentimiento" = "creadoEn";
