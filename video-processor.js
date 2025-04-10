const { Storage } = require("@google-cloud/storage");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;

const fs = require("fs");
const tmp = require("tmp");

ffmpeg.setFfmpegPath(ffmpegPath);

const storage = new Storage();
const TARGET_BUCKET = "dev-managebee-cdn";

async function compressAndMoveVideo(sourceBucket, fileName) {
  const outputTmpFile = tmp.fileSync({ postfix: ".mp4" });
  console.log("Output file will be:", outputTmpFile.name);

  const inputStream = storage.bucket(sourceBucket).file(fileName).createReadStream();
  console.log("Streaming started with FFMPEG")
  await new Promise((resolve, reject) => {
    ffmpeg(inputStream)
    .outputOptions(["-vcodec libx264", "-crf 28"])
    .on("end", () =>{
      console.log("FFMPEG Completed process")
      resolve();
    })
    .on("error", (err, _stdout, stderr) => {
      console.error("FFmpeg Error:", err.message);
      console.error("FFmpeg stderr:", stderr);
      reject(err);
    })
    .save(outputTmpFile.name);
  });
  console.log("Streaming Completed with FFMPEG")
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
