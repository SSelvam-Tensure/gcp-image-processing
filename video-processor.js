const { Storage } = require("@google-cloud/storage");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffprobePath = require("@ffprobe-installer/ffprobe").path;

const fs = require("fs");
const tmp = require("tmp");

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const storage = new Storage();
const TARGET_BUCKET = "dev-managebee-cdn";

async function compressAndMoveVideo(sourceBucket, fileName) {
  const [videoBuffer] = await storage
    .bucket(sourceBucket)
    .file(fileName)
    .download();

  const inputTmpFile = tmp.fileSync({ postfix: ".mp4" });
  const outputTmpFile = tmp.fileSync({ postfix: ".mp4" });

  fs.writeFileSync(inputTmpFile.name, videoBuffer);

  const videoBitrate = "500k";
  const audioBitrate = "64k";
  const maxResolution = 1280;

  await new Promise((resolve, reject) => {
    ffmpeg(inputTmpFile.name)
      .videoCodec("libx264")
      .audioCodec("aac")
      .audioBitrate(audioBitrate)
      .videoBitrate(videoBitrate)
      .outputOptions(["-preset veryslow", "-crf 23", "-pix_fmt yuv420p"])
      .size(`${maxResolution}x?`)
      .on("end", resolve)
      .on("error", (err, _stdout, stderr) => {
        console.error("FFmpeg Error:", err.message);
        console.error("FFmpeg stderr:", stderr);
        reject(err);
      })
      .save(outputTmpFile.name);
  });

  await storage.bucket(TARGET_BUCKET).upload(outputTmpFile.name, {
    destination: `temp/${fileName}`,
    metadata: {
      contentType: "video/mp4",
      cacheControl: "public, max-age=31536000",
    },
  });

  await storage.bucket(TARGET_BUCKET).file(`temp/${fileName}`).makePublic();

  // Cleanup
  inputTmpFile.removeCallback();
  outputTmpFile.removeCallback();

  return `https://storage.googleapis.com/${TARGET_BUCKET}/temp/${fileName}`;
}

module.exports = { compressAndMoveVideo };
