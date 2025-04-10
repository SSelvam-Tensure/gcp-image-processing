const { Storage } = require("@google-cloud/storage");
const tmp = require('tmp');

const ffmpeg = require('fluent-ffmpeg');
const fs = require("fs");
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
ffmpeg.setFfmpegPath(ffmpegPath);
// const ffprobePath = require('@ffprobe-installer/ffprobe').path;
// ffmpeg.setFfprobePath(ffprobePath);

const storage = new Storage();

const TARGET_BUCKET = "dev-managebee-cdn";

async function compressAndMoveVideo(sourceBucket, fileName) {

  console.log({sourceBucket, fileName})

  const inputTmpFile = tmp.fileSync({ postfix: '.mp4' });
  const outputTmpFile = tmp.fileSync({ postfix: '.mp4' });
  const [fileBuffer] = await storage.bucket(sourceBucket).file(fileName).download();

  console.log("FIle download complete")

  fs.writeFileSync(inputTmpFile.name, fileBuffer);

  console.log("FIle Write complete")
  const promiseData = await new Promise((resolve, reject) => {
    ffmpeg(inputTmpFile.name)
      .outputOptions(["-vcodec libx264", "-crf 28"])
      .on("end", resolve)
      .on("error", reject)
      .save(outputTmpFile.name);
  });
  console.log("PromiseData: ",promiseData)
  console.log("video convereted")

  await storage.bucket(TARGET_BUCKET).upload(outputTmpFile.name, {
    destination: `temp/${fileName}`,
    metadata: {
      contentType: "video/mp4",
      cacheControl: "public, max-age=31536000",
    },
  });

  console.log("video uploaded")
  await storage.bucket(TARGET_BUCKET).file(`temp/${fileName}`).makePublic();

  console.log("pre-cleanup")
  // Cleanup
  fs.unlinkSync(inputTmpFile.name);
  fs.unlinkSync(outputTmpFile.name);

  console.log("post-cleanup")

  return `https://storage.googleapis.com/${TARGET_BUCKET}/temp/${fileName}`;
}

module.exports = { compressAndMoveVideo };
