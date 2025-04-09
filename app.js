const fastify = require('fastify');
const { Storage } = require('@google-cloud/storage');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

function buildFastify() {
  const app = fastify();
  const storage = new Storage();

  app.post('/', async (request, reply) => {
    const ceSubject = request.headers['ce-subject'];

    if (!ceSubject) {
      return reply.code(400).send('Bad Request: missing required header: ce-subject');
    }

    const { name, bucket } = request.body;
    const ceId = request.headers['ce-id'];
    const CLEAN_BUCKET = 'scanned-bucket-west1';
    const tmpFilePath = path.join('/tmp', name);

    console.log(`Received event: ${ceId}`);
    console.log(`Downloading ${name} from ${bucket}...`);

    reply.code(202).send({
      message: 'Event received. File processing started.',
      file: name,
      ceId,
    });

    (async () => {
      try {
        await storage.bucket(bucket).file(name).download({ destination: tmpFilePath });
        console.log('Download complete. Starting scan...');

        const scanResult = await new Promise((resolve, reject) => {
          exec(`clamscan ${tmpFilePath}`, (err, stdout, stderr) => {
            if (err && err.code !== 1) {
              console.error(`Scan error: ${stderr}`);
              reject(`Scan failed: ${stderr}`);
              return;
            }
            resolve(stdout);
          });
        });

        console.log(`Scan result: ${scanResult}`);

        if (scanResult.includes('OK')) {
          console.log(`Clean file. Uploading to ${CLEAN_BUCKET}`);
          await storage.bucket(CLEAN_BUCKET).upload(tmpFilePath, { destination: name });
        }

        await fs.unlink(tmpFilePath);
        console.log(`Processing complete for: ${name}`);

      } catch (err) {
        console.error(`Background error processing file ${name}:`, err);
      }
    })();
  });

  return app;
}

module.exports = buildFastify;