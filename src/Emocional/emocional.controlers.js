const { PrismaClient } = require("../generated/prisma");
const { calcularICVE } = require("../services/icve.service");

const prisma = new PrismaClient();

const EMOCIONES_PERMITIDAS = [
  "feliz",
  "tranquilo",
  "tranquila",
  "motivado",
  "motivada",
  "neutral",
  "cansado",
  "cansada",
  "preocupado",
  "preocupada",
  "estresado",
  "estresada",
  "ansioso",
  "ansiosa",
  "solo",
  "sola",
  "triste",
  "desesperado",
  "desesperada",
];

/**
 * Convierte un valor a número.
 * Devuelve null cuando el valor no es numérico.
 */
function convertirNumero(valor) {
    const numero = Number(valor);

  return Number.isFinite(numero) ? numero : null;
}


 //Validacion de campos enviados por el usuario
 
function validarRegistro(datos) {
  const errores = [];

  const emocion = String(datos.emocion || "").trim().toLowerCase();

  const nivelEstres = convertirNumero(datos.nivelEstres);
  const horasSueno = convertirNumero(datos.horasSueno);
  const energia = convertirNumero(datos.energia);
  const concentracion = convertirNumero(datos.concentracion);
  const apoyoSocial = convertirNumero(datos.apoyoSocial);

  if (!emocion) {

    errores.push("La emoción es obligatoria.");

  } else if (!EMOCIONES_PERMITIDAS.includes(emocion)) {

    errores.push("La emoción ingresada no está permitida.");

  }

  if (nivelEstres === null || !Number.isInteger(nivelEstres) || nivelEstres < 0 ||
    nivelEstres > 10) {

    errores.push( "El nivel de estrés debe ser un número entero entre 0 y 10.");
  }

  if (horasSueno === null || horasSueno < 0 || horasSueno > 24) {

    errores.push("Las horas de sueño deben estar entre 0 y 24.");
  }

  if (energia === null ||!Number.isInteger(energia) ||energia < 0 || energia > 10) {

    errores.push("La energía debe ser un número entero entre 0 y 10.");
  }

  if (concentracion === null || !Number.isInteger(concentracion) ||concentracion < 0 ||concentracion > 10) {
    errores.push("La concentración debe ser un número entero entre 0 y 10.");
  }

  if ( apoyoSocial === null || !Number.isInteger(apoyoSocial) || apoyoSocial < 0 || apoyoSocial > 10) {

    errores.push("El apoyo social debe ser un número entero entre 0 y 10.");
  }

  if (datos.textoUsuario !== undefined && datos.textoUsuario !== null && typeof datos.textoUsuario !== "string") {

    errores.push("El texto del usuario debe ser una cadena de texto.");
  }

  if (datos.audioUrl !== undefined && datos.audioUrl !== null && typeof datos.audioUrl !== "string") {
    
    errores.push("La URL del audio debe ser una cadena de texto.");
  }

  return errores;
}


 //POST de registro emocionales
// Crea un registro emocional, calcula el ICVE y guarda la predicción de riesgo
 
async function crearRegistro(req, res) {
  try {
    const {
      usuarioId,
      emocion,
      nivelEstres,
      horasSueno,
      energia,
      concentracion,
      apoyoSocial,
      textoUsuario,
      audioUrl,
    } = req.body;

    /*
     * Por ahora el usuarioId se recibe en el body.
     *
     * Cuando el JWT esté listo se reemplaza por:
     *
     * const usuarioId = req.user.id;
     */
    if (!usuarioId ||typeof usuarioId !== "string" ||!usuarioId.trim()) {
      return res.status(400).json({
        error: "El usuarioId es obligatorio.",
      });
    }

    const datosRecibidos = {
      emocion,
      nivelEstres,
      horasSueno,
      energia,
      concentracion,
      apoyoSocial,
      textoUsuario,
      audioUrl,
    };

    const errores = validarRegistro(datosRecibidos);

    if (errores.length > 0) {
      return res.status(400).json({
        error: "Los datos enviados no son válidos.",
        detalles: errores,
      });
    }

    /*
     * Confirmamos que el usuario realmente exista.
     * Esto evita intentar guardar registros para un UUID inexistente.
     */
    const usuarioExiste = await prisma.usuario.findUnique({
      where: {
        id: usuarioId.trim(),
      },
      select: {
        id: true,
      },
    });

    if (!usuarioExiste) {
      return res.status(404).json({
        error: "No se encontró un usuario con ese ID.",
      });
    }

    /*
     * El historial del ICVE se encuentra en PrediccionRiesgo,
     * no en RegistroEmocional.
     *
     * Obtenemos las últimas cinco predicciones.
     */
    const ultimasPredicciones =
      await prisma.prediccionRiesgo.findMany({
        where: {
          usuarioId: usuarioId.trim(),
        },
        orderBy: {
          fecha: "desc",
        },
        take: 5,
        select: {
          puntajeIcve: true,
          fecha: true,
        },
      });

    /*
     * Prisma devuelve Decimal en puntajeIcve.
     * Number() lo transforma para que tu service pueda calcular.
     *
     * También invertimos el arreglo para dejarlo:
     * más antiguo → más reciente.
     */
    const historialOrdenado = ultimasPredicciones
      .reverse()
      .map((prediccion) => ({
        puntajeIcve: Number(prediccion.puntajeIcve),
      }));

    const registroParaCalculo = {
      emocion: String(emocion).trim().toLowerCase(),
      nivelEstres: Number(nivelEstres),
      horasSueno: Number(horasSueno),
      energia: Number(energia),
      concentracion: Number(concentracion),
      apoyoSocial: Number(apoyoSocial),
      textoUsuario: String(textoUsuario || "").trim(),
    };

    const resultadoICVE = calcularICVE(
      registroParaCalculo,
      historialOrdenado
    );

    /*
     * Usamos una transacción.
     *
     * Esto significa que:
     * - se guarda el registro emocional;
     * - se guarda la predicción;
     *
     * Si una operación falla, ninguna queda guardada a medias.
     */
    const resultadoGuardado = await prisma.$transaction(
      async (tx) => {
        const nuevoRegistro =
          await tx.registroEmocional.create({
            data: {
              usuarioId: usuarioId.trim(),
              emocion: registroParaCalculo.emocion,
              nivelEstres:
                registroParaCalculo.nivelEstres,
              horasSueno:
                registroParaCalculo.horasSueno,
              energia: registroParaCalculo.energia,
              concentracion:
                registroParaCalculo.concentracion,
              apoyoSocial:
                registroParaCalculo.apoyoSocial,
              textoUsuario:
                registroParaCalculo.textoUsuario || null,
              audioUrl:
                typeof audioUrl === "string" &&
                audioUrl.trim()
                  ? audioUrl.trim()
                  : null,
            },
          });

        const nuevaPrediccion =
          await tx.prediccionRiesgo.create({
            data: {
              usuarioId: usuarioId.trim(),

              puntajeIcve: resultadoICVE.icve,
              nivelRiesgo: resultadoICVE.nivel,

              /*
               * Por ahora el ICVE es una fórmula determinista.
               * Puedes usar 1 como confianza provisional.
               *
               * Más adelante este valor puede venir de un
               * modelo de IA.
               */
              confianzaModelo: 1,

              factoresExplicativos: {
                tendencia: resultadoICVE.tendencia,
                dimensiones: resultadoICVE.dimensiones,
              },

              coachIa: null,
            },
          });

        return {
          registro: nuevoRegistro,
          prediccion: nuevaPrediccion,
        };
      }
    );

    return res.status(201).json({
      mensaje:
        "Registro emocional e ICVE guardados correctamente.",
      registro: resultadoGuardado.registro,
      prediccion: resultadoGuardado.prediccion,
      resultadoICVE,
    });
  } catch (error) {
    console.error(
      "Error al crear el registro emocional:",
      error
    );

    return res.status(500).json({
      error:
        "Ocurrió un error al crear el registro emocional.",
      detalle:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
}

/**
 * GET /emocional/registros
 *
 * Devuelve los registros y predicciones del usuario.
 */
async function obtenerHistorial(req, res) {
  try {
    /*
     * Por ahora:
     * GET /emocional/registros?usuarioId=UUID
     *
     * Con JWT se reemplaza por:
     * const usuarioId = req.user.id;
     */
    const usuarioId = req.query.usuarioId;

    if (
      !usuarioId ||
      typeof usuarioId !== "string" ||
      !usuarioId.trim()
    ) {
      return res.status(400).json({
        error:
          "Debes enviar el usuarioId como parámetro de consulta.",
        ejemplo:
          "/emocional/registros?usuarioId=UUID_DEL_USUARIO",
      });
    }

    const usuarioExiste = await prisma.usuario.findUnique({
      where: {
        id: usuarioId.trim(),
      },
      select: {
        id: true,
      },
    });

    if (!usuarioExiste) {
      return res.status(404).json({
        error: "No se encontró un usuario con ese ID.",
      });
    }

    /*
     * Consultamos registros y predicciones en paralelo.
     * Esto evita esperar primero una consulta y después la otra.
     */
    const [registros, predicciones] = await Promise.all([
      prisma.registroEmocional.findMany({
        where: {
          usuarioId: usuarioId.trim(),
        },
        orderBy: {
          fecha: "desc",
        },
      }),

      prisma.prediccionRiesgo.findMany({
        where: {
          usuarioId: usuarioId.trim(),
        },
        orderBy: {
          fecha: "desc",
        },
      }),
    ]);

    return res.status(200).json({
      usuarioId: usuarioId.trim(),
      cantidadRegistros: registros.length,
      cantidadPredicciones: predicciones.length,
      registros,
      predicciones,
    });
  } catch (error) {
    console.error(
      "Error al obtener el historial emocional:",
      error
    );

    return res.status(500).json({
      error:
        "Ocurrió un error al obtener el historial emocional.",
      detalle:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
}

module.exports = {
  crearRegistro,
  obtenerHistorial,
};