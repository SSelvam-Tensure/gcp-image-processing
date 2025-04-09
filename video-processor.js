const { Storage } = require("@google-cloud/storage");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const fs = require("fs");
const path = require("path");
const os = require("os");

ffmpeg.setFfmpegPath(ffmpegPath);

const storage = new Storage();
const TARGET_BUCKET = "dev-managebee-cdn";

async function compressAndMoveVideo(sourceBucket, fileName) {
  const tempDir = os.tmpdir();
  const localOriginalPath = path.join(tempDir, `original-${fileName}`);
  const localCompressedPath = path.join(tempDir, `compressed-${fileName}`);

  const downloadResponse = await storage
    .bucket(sourceBucket)
    .file(fileName)
    .download({ destination: localOriginalPath });

  console.log("downloaded Response is :");
  console.log(downloadResponse);

  await new Promise((resolve, reject) => {
    ffmpeg(localOriginalPath)
      .outputOptions(["-vcodec libx264", "-crf 28"])
      .on("end", resolve)
      .on("error", reject)
      .save(localCompressedPath);
  });

  await storage.bucket(TARGET_BUCKET).upload(localCompressedPath, {
    destination: `temp/${fileName}`,
    metadata: {
      contentType: "video/mp4",
      cacheControl: "public, max-age=31536000",
    },
  });

  await storage.bucket(TARGET_BUCKET).file(`temp/${fileName}`).makePublic();

  fs.unlinkSync(localOriginalPath);
  fs.unlinkSync(localCompressedPath);

  return `https://storage.googleapis.com/${TARGET_BUCKET}/temp/${fileName}`;
}

module.exports = { compressAndMoveVideo };
