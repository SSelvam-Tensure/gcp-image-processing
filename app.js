const fastify = require("fastify");

const { Storage } = require("@google-cloud/storage");

const { compressAndMoveImage } = require("./image-processor");
const { compressAndMoveVideo } = require("./video-processor");

const storage = new Storage();

async function getFileMetadata(bucketName, fileName) {
  const file = storage.bucket(bucketName).file(fileName);
  const [metadata] = await file.getMetadata();
  return metadata;
}

function buildFastify() {
  const app = fastify();

  app.post("/", async (request, reply) => {
    try {
      const ceSubject = request.headers["ce-subject"];
      const ceId = request.headers['ce-id'];

      if (!ceSubject) {
          console.error("Bad Request: missing required header: ce-subject");
          return reply.status(400).send({ error: "Missing ce-subject header" });
      }
      const { name, bucket, contentType } = request.body;
      
      console.log("Started processing data for subject: ", ceSubject)
      reply.code(202).send({
        message: 'Event received. File processing started.',
        file: name,
        ceId,
      });

      await (async () => {
        try {
          const metadata = await getFileMetadata(bucket, name);

          const uploadedTempFile = storage.bucket(bucket).file(name);
          await uploadedTempFile.makePublic();

          const messageData = {
            bucket: bucket,
            name: name,
            contentType: metadata.contentType,
            size: metadata.size,
            timeCreated: metadata.timeCreated,
            updated: metadata.updated,
            status: "completed",
            metadata: metadata.metadata || {},
          };

          if (/^image\//.test(contentType)) {
            const publicUrl = await compressAndMoveImage(bucket, name);
            messageData.publicUrl = publicUrl;
          } else if (/^video\//.test(contentType)) {
            const publicUrl = await compressAndMoveVideo(bucket, name);
            messageData.publicUrl = publicUrl;
          }
        } catch (err) {
          console.error(`Background error processing file ${name}:`, err);
        }
      })();

    } catch (error) {
      console.error(error);
      reply.status(500).send({ error: "Internal Server Error" });
    }
  });

  return app;
}

module.exports = buildFastify;
