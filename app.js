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

      if (!ceSubject) {
          console.error("Bad Request: missing required header: ce-subject");
          return reply.status(400).send({ error: "Missing ce-subject header" });
      }

      console.log("Started processing data for subject: ", ceSubject)

      const { name, bucket, contentType } = request.body;
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
      console.log("Completed Processing data for subject: ", ceSubject)
      return reply.status(200).send({message : "Processing completed"})
    } catch (error) {
      console.error(error);
      return reply.status(500).send({ error: "Internal Server Error" });
    }
  });

  return app;
}

module.exports = buildFastify;
