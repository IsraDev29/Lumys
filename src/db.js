const {PrismaClient} = require('@prisma/client')
const {PrismaPg} = require('@prisma/adapter-pg')

// Un único cliente para toda la aplicación. Cada `new PrismaClient()` abre su
// propio pool de conexiones y Neon las limita, así que instanciarlo por módulo
// agota las conexiones en cuanto crecen las rutas.
//
// Prisma 7 ya no acepta `url` en el datasource: la conexión se pasa aquí.
const adapter = new PrismaPg({connectionString: process.env.DATABASE_URL})
const prisma = new PrismaClient({adapter})

module.exports = prisma;
