const { Storage } = require("@google-cloud/storage");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;


const fs = require("fs");
const tmp = require("tmp");

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const storage = new Storage();
const TARGET_BUCKET = "dev-managebee-cdn";

async function compressAndMoveVideo(sourceBucket, fileName) {

  console.log({sourceBucket, fileName})

  const [fileBuffer] = await storage.bucket(sourceBucket).file(fileName).download();


  const inputTmpFile = tmp.fileSync({ postfix: ".mp4"})
  const outputTmpFile = tmp.fileSync({ postfix: ".mp4" });
  console.log("Output file will be:", outputTmpFile.name);

  fs.writeFileSync(inputTmpFile.name, fileBuffer);
  const videoBitrate = '500k';
  const audioBitrate = '64k';
  const maxResolution = 1280;

  const promiseData = await new Promise((resolve, reject) => {
    ffmpeg(inputTmpFile.name)
    .videoCodec('libx264')
    .audioCodec('aac')
    .audioBitrate(audioBitrate)
    .videoBitrate(videoBitrate)
    .outputOptions([
      '-preset veryslow',
      '-crf 23',
      '-pix_fmt yuv420p',
    ])
    .size(`${maxResolution}x?`)
    .on('end', () => {
      try {
        const compressedBuffer = fs.readFileSync(outputTmpFile.name);
        inputTmpFile.removeCallback();
        outputTmpFile.removeCallback();
        resolve(compressedBuffer);
      } catch (error) {
        reject(new Error('Failed to read compressed video: ' + error.message));
      }
    })
    .on('error', (error) => {
      inputTmpFile.removeCallback();
      outputTmpFile.removeCallback();
      reject(new Error('Video compression failed: ' + error.message));
    })
    .save(outputTmpFile.name);
  });
  console.log("Compressed video data:", promiseData);
  console.log("Compressed video saved to:", outputTmpFile.name);

  await storage.bucket(TARGET_BUCKET).upload(outputTmpFile.name, {
    destination: `temp/${fileName}`,
    metadata: {
      contentType: "video/mp4",
      cacheControl: "public, max-age=31536000",
    },
  });

  await storage.bucket(TARGET_BUCKET).file(`temp/${fileName}`).makePublic();

  // Cleanup
  outputTmpFile.removeCallback();

  return `https://storage.googleapis.com/${TARGET_BUCKET}/temp/${fileName}`;
}

module.exports = { compressAndMoveVideo };
