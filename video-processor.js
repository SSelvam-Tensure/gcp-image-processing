const { Storage } = require("@google-cloud/storage");
const tmp = require('tmp');
const fs = require("fs");
const path = require("path");

const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
ffmpeg.setFfmpegPath(ffmpegPath);

const ffprobePath = require('@ffprobe-installer/ffprobe').path;
ffmpeg.setFfprobePath(ffprobePath);

const storage = new Storage();
const TARGET_BUCKET = "dev-managebee-cdn";

async function compressAndMoveVideo(sourceBucket, fileName) {
  console.log({ sourceBucket, fileName });

  const fileExtension = fileName.split('.').pop();
  const inputTmpFile = tmp.fileSync({ postfix: `.${fileExtension}` });
  const outputTmpFile = tmp.fileSync({ postfix: `.mp4` });
  const videoBitrate = '500k';
  const audioBitrate = '64k';
  const maxResolution = 1280;

  const [fileBuffer] = await storage.bucket(sourceBucket).file(fileName).download();
  fs.writeFileSync(inputTmpFile.name, fileBuffer);

  console.log("File downloaded and written to temp");


  // --- Get metadata ---
  const metadata = await new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputTmpFile.name, (err, data) => {
      if (err) return reject(err);
      resolve(data);
    });
  });

  const videoStream = metadata.streams.find(s => s.codec_type === 'video');
  const { width, height, bit_rate, codec_name } = videoStream || {};
  console.log({ width, height, bit_rate, codec_name });

  const isOptimized =
      (bit_rate && parseInt(bit_rate) < 1_000_000) &&
      width <= 1280 &&
      codec_name === 'h264';

  let finalFilePath = inputTmpFile.name;

  if (!isOptimized) {
    console.log("Video not optimized. Starting compression...");
    await new Promise((resolve, reject) => {
      ffmpeg(inputTmpFile.name)
      .videoCodec('libx264')
      .audioCodec('aac')
      .audioBitrate(audioBitrate)
      .videoBitrate(videoBitrate)
      .outputOptions([
        '-preset veryfast',
        '-crf 23',
        '-pix_fmt yuv420p',
      ])
      .size(`${maxResolution}x?`)
      .on('start', commandLine => {
        console.log('FFmpeg command:', commandLine);
      })
      .on('progress', progress => {
        console.log(`Compressing: ${progress.percent?.toFixed(2)}%`);
      })
      .on("end", resolve)
      .on("error", reject)
      .save(outputTmpFile.name);
    });

    console.log("Compression done");
    finalFilePath = outputTmpFile.name;
  } else {
    console.log("Skipping compression: video is already optimized.");
  }

  const outputFileName =  path.basename(fileName, path.extname(fileName)) + '.mp4';


  await storage.bucket(TARGET_BUCKET).upload(finalFilePath, {
    destination: `temp/${outputFileName}`,
    metadata: {
      contentType: "video/mp4",
      cacheControl: "public, max-age=31536000",
    },
  });

  console.log("Video uploaded");

  await storage.bucket(TARGET_BUCKET).file(`temp/${outputFileName}`).makePublic();
  console.log("Made public");

  // Cleanup
  fs.unlinkSync(inputTmpFile.name);
  if (!isOptimized) fs.unlinkSync(outputTmpFile.name);
  console.log("Temp files cleaned");

  return `https://storage.googleapis.com/${TARGET_BUCKET}/temp/${outputFileName}`;
}

module.exports = { compressAndMoveVideo };
