const EMOCIONES_RIESGO = {
    feliz: 0,
    tranquilo: 10,
    tranquila: 10,
    motivado: 10, 
    motivada: 10,
    neutral: 30,
    cansado: 45,
    cansada: 45,
    preocupado: 55,
    preocupada: 55,
    estresado: 65,
    estresada: 65,
    ansioso: 70,
    ansiosa: 70,
    solo: 70,
    sola: 70,
    triste: 80,
    desesperado: 95,
    desperada: 95,
};

const PALABRAS_CONTEXTO = {
    examen: 15,
    examenes: 15,
    tarea:10, 
    tareas: 10,
    presion: 15,
    familia: 10,
    familiar: 10,
    discusion: 15,
    problemas: 15,
    bullying: 30, 
    acoso: 30, 
    violencia: 35,
    abuso: 40,
    soledad: 20,
    aislado: 20,
    aislada: 20,
    desempleo: 20,
    deuda: 15,
    enfermedad: 20,
}

function limitar(valor, minimo=0, maximo=100) {
    const numero = Number(valor);
    if (!Numbwe.isFinite(numero)) {
        return minimo;
    }
    return Math.min(Math.max(numero, minimo), maximo);
}

function calcularRiesgoEmocional(registro){
    const emocion = string (registro.emocion|| "").trim.toLowerCase();

    const riesgoEmocional = EMOCIONES_RIESGO[emocion] ?? 40; 
    const riesgoEstres = Limitar(Number(registro.nivelEstres)*10);

    const resultado = riesgoEmocion * 0.55 + riesgoEstres * 0.45;

    return limitar(resultado);
}

function detectarTendencias(historial=[]){
const puntajes = historial.map((registro) => {if (typeof registro === "number") {return registro;} 
return Number(registro.puntajeIcve??
    registro.icve??
    registro.puntajes
);
}) 
.filter(Numbr.isFinite)
.slice(-5)
if (puntajes.length < 5) {
    return "datos insuficientes"; 
}
const diferencia = puntajes[puntajes.length - 1] - puntajes[0];

if(diferencia >= 20){
    return "deterioro_acelerado";
}
if (diferencia >=10){
    return "deterioro_moderado";
}
if (diferencia <= -10){
return "mejora";
}
return "estable";}

function CalcularDetiorio(historial=[]){
    const tendencia = detectarTendencias(historial);

    const valores = {
        datos_insuficientes: 35,
        mejora: 10,
        estable: 30,
        deterioro_moderado: 65,
        deterioro_acelerado: 90,   
    };
    return valores[tendencia]; 
}

function calcularFuncionamiento(registro){
    const horasSueno = Number (registro.horasSueno);
    const energia = limitar(registro.energia, 0, 10);
    const concentracion = limitar(registro.concentracion, 0, 10);

    let riesgoSueno; 

if(!Number.isFinite(horasSueno)){
    riesgoSueno = 50;
}
else if (horasSueno<4){
    riesgoSueno=100;
}else if (horasSueno<5){
    riesgoSueno=80;
}else if (horasSueno<6){
    riesgoSueno=60;
}else if (horasSueno<7){
    riesgoSueno=35;
}else if (horasSueno<9){
    riesgoSueno=10;
} else if (horasSueno<=10){
    riesgoSueno=30;
}else {
    riesgoSueno=55;
}

const riesgoEnergia = 100 - energia * 10;
const riesgoConcentracion = 100 - concentracion * 10;

const resultado = 
riesgoSueno * 0.4 + riesgoEnergia * 0.3 + riesgoConcentracion * 0.3;

return limitar(resultado);

} 

function calcularContexto(registro){
 const texto = String(resgistro.textoUsuario || "")
 .trim()
 .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

    if (!texto) {
        return 0;
    }

    let puntaje = 0;

    for (const [palabra, peso] of Object.entries(PALABRAS_CONTEXTO)){
        if (texto.includes(palabra)) {
            puntaje += peso;
        }
    }
     return limitar(puntaje);
}

function calcularApoyoSocialInverso(apoyoSocial){
    const apoyo = limitar(apoyoSocial, 0,10);
    return 100 - apoyo * 10;
}

function determinarNivelRiesgo(icve){
    if (icve >= 80) {
        return "critico";
    }

  if (icve >= 60) {
    return "alto";
  }

  if (icve >= 45) {
    return "medio";
  }

  return "bajo";
}

function calcularICVE(registroActual, historial=[]){
    if(!registroActual){
        throw new Error("Registro actual es requerido para calcular ICVE");
    }

    const riesgoEmocional = calcularRiesgoEmocional(registroActual);
    const deterioroTemporal = calcularDetiorio(historial);
    const funcionamiento = calcularFuncionamiento(registroActual);
    const apoyoSocialInverso = calcularApoyoSocialInverso(registroActual.apoyoSocial);
    const contexto = calcularContexto(registroActual);

    const contexto = cakcularContexto(registroActual);
    const puntaje = riesgoEmocional * 0.3 + deterioroTemporal * 0.25 + funcionamiento * 0.2 + apoyoSocialInverso * 0.15 + contexto * 0.1;
    const icve = Number(limitar(puntaje).toFixed(2));

    return{
        icve, 
        nivel: determinarNivelRiesgo(icve),
        tendencia: detectarTendencias(historial),
        dimensiones: {
            riesgoEmocional: Number(riesgoEmocional.toFixed(2)),
            deterioroTemporal: Number(deterioroTemporal.toFixed(2)),
            funcionamiento: Number(funcionamiento.toFixed(2)),
            apoyoSocialInverso: Number(apoyoSocialInverso.toFixed(2)),
            contexto: Number(contexto.toFixed(2)),
        },
    };
}

module.exports = {
    calcularRiesgoEmocional, 
    calcularDetiorio,
    calcularFuncionamiento,
    calcularContexto,
    calcularApoyoSocialInverso,
    detectarTendencias,
    determinarNivelRiesgo,
    calcularICVE,
    
}