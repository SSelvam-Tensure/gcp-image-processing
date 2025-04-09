const { Storage } = require("@google-cloud/storage");

const storage = new Storage();
const TARGET_BUCKET = "dev-managebee-cdn";

async function compressAndMoveVideo(sourceBucket, fileName){
    const tempBuffer = await storage.bucket(sourceBucket).file(fileName).download();
    const targetFile = storage.bucket(TARGET_BUCKET).file(`temp/${fileName}`);
    await targetFile.save(tempBuffer, {
        contentType: "video",
        metadata: {
          cacheControl: "public, max-age=31536000",
        },
    });

    await targetFile.makePublic();

    return `https://storage.googleapis.com/${TARGET_BUCKET}/temp/${fileName}`;
}

module.exports = { compressAndMoveVideo }
