const buildFastify = require('./app.js');
const PORT = parseInt(process.env.PORT) || 8080;

const fastify = buildFastify();

fastify.listen({ port: PORT, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`nodejs-events-storage listening on ${address}`);
});