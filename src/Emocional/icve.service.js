const prisma = require('../db');
const { COMPONENTES } = require('../IA/ia.prompt');
const seguridad = require('../IA/ia.seguridad');

// ---------------------------------------------------------------------------
// Motor del ICVE — Índice Compuesto de Vulnerabilidad Emocional
//
// Todo lo que hay acá es aritmética. La conversación la conduce un modelo, pero
// el número que termina en el historial y dispara alertas se calcula con reglas
// fijas, auditables y reproducibles. Dos razones:
//
// - Comparabilidad. El ICVE de hoy solo significa algo frente al ICVE del mismo
//   estudiante hace dos semanas. Si el puntaje lo pusiera un modelo, la serie
//   dejaría de ser una serie.
// - Defendibilidad. Cuando un orientador pregunte "¿por qué se abrió este
//   caso?", la respuesta tiene que ser una fórmula, no "el modelo lo estimó".
//
// Escala: 0 a 100, donde MÁS ALTO es MÁS VULNERABILIDAD.
// ---------------------------------------------------------------------------

// Pesos por componente. El vínculo y el ánimo pesan más porque son los que
// mejor anticipan un cambio sostenido; concentración y energía acompañan.
const PESOS = {
    animo: 0.25,
    vinculo: 0.25,
    sueno: 0.20,
    energia: 0.15,
    concentracion: 0.15,
};

// Suavizado del promedio móvil. 0.3 hace que un día malo mueva la línea base
// pero no la reescriba: hace falta una tendencia, no un mal martes.
const ALFA = 0.3;

// Cuánto tiene que separarse un registro de la propia línea base para que
// cuente como desviación. Por debajo de 10 puntos es ruido normal.
const UMBRAL_DESVIACION = 10;

// Registros consecutivos por encima del umbral antes de abrir una señal por
// tendencia. El sistema busca cambios sostenidos, no días sueltos.
const REGISTROS_SOSTENIDOS = 3;

/**
 * Convierte los turnos del check-in en un puntaje 0-100.
 *
 * Cada turno trae `valor` de 1 a 5, donde 5 es la mejor situación para ese
 * componente. Se invierte a vulnerabilidad y se pondera. Si un componente no se
 * cubrió (la conversación fue corta, el estudiante saltó una parte), los pesos
 * se renormalizan sobre los presentes en vez de asumir un valor neutro: inventar
 * un 3 donde no hubo respuesta ensucia la serie histórica.
 */
function calcularIcve(turnos) {
    const valores = {};

    for (const turno of turnos) {
        if (!COMPONENTES.includes(turno.componente)) continue;
        const valor = Number(turno.valor);
        if (!Number.isFinite(valor) || valor < 1 || valor > 5) continue;
        valores[turno.componente] = valor;
    }

    const presentes = Object.keys(valores);
    if (!presentes.length) return { icve: null, componentes: {}, cobertura: 0 };

    const pesoTotal = presentes.reduce((suma, c) => suma + PESOS[c], 0);

    const vulnerabilidad = presentes.reduce((suma, c) => {
        // valor 5 → 0 de vulnerabilidad; valor 1 → 1 de vulnerabilidad.
        const normalizado = (5 - valores[c]) / 4;
        return suma + normalizado * PESOS[c];
    }, 0);

    return {
        icve: Math.round((vulnerabilidad / pesoTotal) * 100),
        componentes: valores,
        cobertura: presentes.length / COMPONENTES.length,
    };
}

/**
 * Actualiza la línea base del estudiante con media móvil exponencial, tanto del
 * ICVE global como de cada componente. `patronNormal` es lo que después permite
 * decir "duerme igual que siempre pero está hablando con menos gente", que es
 * mucho más útil para un orientador que un solo número que subió.
 */
function siguienteLineaBase(lineaBase, icve, componentes) {
    if (!lineaBase || lineaBase.promedioIcveMovil === null) {
        return { promedioIcveMovil: icve, patronNormal: { ...componentes } };
    }

    const patron = { ...(lineaBase.patronNormal || {}) };
    for (const [clave, valor] of Object.entries(componentes)) {
        patron[clave] = typeof patron[clave] === 'number'
            ? Number((patron[clave] * (1 - ALFA) + valor * ALFA).toFixed(2))
            : valor;
    }

    return {
        promedioIcveMovil: Number((lineaBase.promedioIcveMovil * (1 - ALFA) + icve * ALFA).toFixed(2)),
        patronNormal: patron,
    };
}

/**
 * Qué componentes se movieron respecto al patrón habitual. Alimenta la parte
 * "explicable" de la señal: el orientador ve qué cambió, no solo cuánto.
 */
function componentesDesviados(componentes, patronNormal) {
    if (!patronNormal) return [];

    return Object.entries(componentes)
        .map(([clave, valor]) => {
            const habitual = patronNormal[clave];
            if (typeof habitual !== 'number') return null;

            const delta = Number((valor - habitual).toFixed(2));
            // Un punto entero de diferencia en una escala de 5 ya es visible.
            if (Math.abs(delta) < 1) return null;

            return { componente: clave, habitual, hoy: valor, delta };
        })
        .filter(Boolean);
}

/**
 * Decide si este check-in abre una señal, y de qué nivel.
 *
 * El riesgo explícito no espera a que se sostenga nada: dispara nivel 3 en el
 * mismo registro. Todo lo demás sí exige tendencia — es la diferencia entre un
 * sistema que acompaña y uno que alarma cada vez que alguien tiene un mal día.
 */
function evaluarSenal({ icve, delta, nivelRiesgo, semanasSostenidas, desviados }) {
    if (nivelRiesgo >= 3) {
        return {
            abrir: true,
            nivelRespuesta: 3,
            motivo: 'Lenguaje de riesgo explícito. No espera a que se sostenga.',
        };
    }

    if (nivelRiesgo === 2) {
        return {
            abrir: true,
            nivelRespuesta: 2,
            motivo: 'Lenguaje que sugiere riesgo. Requiere revisión de una persona.',
        };
    }

    if (delta === null) return { abrir: false, nivelRespuesta: 0, motivo: 'Sin línea base todavía.' };

    const sostenido = semanasSostenidas >= REGISTROS_SOSTENIDOS;

    if (sostenido && delta >= UMBRAL_DESVIACION * 2) {
        return {
            abrir: true,
            nivelRespuesta: 2,
            motivo: `Cambio de ${delta} puntos sobre su promedio, sostenido en ${semanasSostenidas} registros.`,
        };
    }

    if (sostenido && delta >= UMBRAL_DESVIACION) {
        return {
            abrir: true,
            nivelRespuesta: 1,
            motivo: `Cambio sostenido de ${delta} puntos, con ${desviados.length} componentes movidos.`,
        };
    }

    return { abrir: false, nivelRespuesta: 0, motivo: 'Dentro de su variación habitual.' };
}

/**
 * Cuántos registros seguidos viene por encima de su línea base. Se cuenta hacia
 * atrás desde el más reciente y se corta en el primero que no cumple.
 */
function contarSostenidos(historial, referencia) {
    let cuenta = 0;
    for (const registro of historial) {
        if (registro.puntajeIcve === null) break;
        if (registro.puntajeIcve - referencia < UMBRAL_DESVIACION) break;
        cuenta += 1;
    }
    return cuenta;
}

/**
 * Punto de entrada: recibe el check-in ya guardado y actualiza línea base y
 * señales dentro de una sola transacción.
 *
 * Va en transacción porque los tres escritos son un mismo hecho: si la línea
 * base se actualiza pero la señal no se crea, el próximo registro se compara
 * contra un promedio que ya absorbió el día malo y la señal nunca aparece.
 */
async function procesarRegistro({ estudianteId, icve, componentes, nivelRiesgo, checkInId }) {
    if (icve === null) return { lineaBase: null, delta: null, senal: null };

    const [lineaBase, historial] = await Promise.all([
        prisma.lineaBase.findUnique({ where: { estudianteId } }),
        prisma.checkIn.findMany({
            where: { estudianteId, NOT: { id: checkInId } },
            orderBy: { fecha: 'desc' },
            take: REGISTROS_SOSTENIDOS,
            select: { puntajeIcve: true },
        }),
    ]);

    const referencia = lineaBase?.promedioIcveMovil ?? null;
    const delta = referencia === null ? null : Math.round(icve - referencia);

    const desviados = componentesDesviados(componentes, lineaBase?.patronNormal);

    // El registro de hoy cuenta como el primero de la racha si ya está desviado.
    const semanasSostenidas = referencia === null
        ? 0
        : (delta >= UMBRAL_DESVIACION ? 1 : 0) + contarSostenidos(historial, referencia);

    const veredicto = evaluarSenal({ icve, delta, nivelRiesgo, semanasSostenidas, desviados });
    const siguiente = siguienteLineaBase(lineaBase, icve, componentes);

    const senal = await prisma.$transaction(async (tx) => {
        await tx.lineaBase.upsert({
            where: { estudianteId },
            create: { estudianteId, ...siguiente, actualizadoEn: new Date() },
            update: { ...siguiente, actualizadoEn: new Date() },
        });

        if (!veredicto.abrir) return null;

        return tx.senalDetectada.create({
            data: {
                estudianteId,
                deltaIcve: delta,
                componentePatron: { desviados, motivo: veredicto.motivo, icve, referencia },
                lenguajeRiesgoExplicito: nivelRiesgo >= 3,
                semanasSostenidas,
                nivelRespuesta: veredicto.nivelRespuesta,
            },
        });
    });

    return {
        lineaBase: referencia,
        delta,
        desviados,
        semanasSostenidas,
        senal,
        motivo: veredicto.motivo,
    };
}

module.exports = {
    PESOS,
    ALFA,
    UMBRAL_DESVIACION,
    REGISTROS_SOSTENIDOS,
    calcularIcve,
    siguienteLineaBase,
    componentesDesviados,
    evaluarSenal,
    procesarRegistro,
    nivelDeRespuesta: seguridad.nivelDeRespuesta,
};
