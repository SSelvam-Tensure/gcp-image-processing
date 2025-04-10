const { Storage } = require("@google-cloud/storage");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;

const fs = require("fs");
const tmp = require("tmp");

ffmpeg.setFfmpegPath(ffmpegPath);

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

  console.log("Input file :", inputTmpFile.name)
  console.log("Running FFmpeg with input:", inputTmpFile.name);
  console.log("Output file will be:", outputTmpFile.name);

  await new Promise((resolve, reject) => {
    ffmpeg(inputTmpFile.name)
    .outputOptions([
      "-y",
      "-vcodec libx264",
      "-crf 28",
      "-preset veryfast",
      "-movflags +faststart"
    ])
    .on("start", cmd => {
      console.log("FFmpeg started:", cmd);
    })
    .on("progress", p => {
      console.log("FFmpeg progress:", p);
    })
    .on("stderr", line => {
      console.log("FFmpeg stderr:", line);
    })
    .on("end", () => {
      console.log("FFmpeg finished");
      resolve();
    })
    .on("error", (err, _stdout, stderr) => {
      console.error("FFmpeg Error:", err.message);
      console.error("FFmpeg stderr:", stderr);
      reject(err);
    })
    .save(outputTmpFile.name);
  });
  console.log("Output file :", outputTmpFile.name)

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
