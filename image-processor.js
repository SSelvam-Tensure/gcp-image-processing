const { Storage } = require("@google-cloud/storage");

const storage = new Storage();
const TARGET_BUCKET = "dev-managebee-cdn";

async function compressAndMoveImage(sourceBucket, fileName) {
  const tempBuffer = await storage
    .bucket(sourceBucket)
    .file(fileName)
    .download();
  
  const compressedImageBuffer = await sharp(tempBuffer[0])
    .jpeg({ quality: 70 })
    .toBuffer();

  const targetFile = storage.bucket(TARGET_BUCKET).file(`temp/${fileName}`);
  await targetFile.save(compressedImageBuffer, {
    contentType: "image/jpeg",
    metadata: {
      cacheControl: "public, max-age=31536000",
    },
  });

  await targetFile.makePublic();

  return `https://storage.googleapis.com/${TARGET_BUCKET}/${fileName}`;
}


module.exports = { compressAndMoveImage }
