const { Storage } = require("@google-cloud/storage");
const { promisify } = require("util")
const {exec} = require('child_process')

const fs = require('fs');
const path = require('path');

const storage = new Storage();

const TMP_DIR = '/tmp';
const TARGET_BUCKET = "dev-managebee-cdn";

async function compressAndMoveVideo(sourceBucket, fileName) {

  console.log({sourceBucket, fileName})

  const inputPath = path.join(TMP_DIR, fileName);
  const outputName = `compressed_${fileName}`;
  const outputPath = path.join(TMP_DIR, outputName);

  const execAsync = promisify(exec);
  await storage.bucket(sourceBucket).file(fileName).download({ destination: inputPath });

  const { stdout } = await execAsync('which ffmpeg');
  console.log('FFmpeg located at:', stdout);

  await execAsync(`ffmpeg -i ${inputPath} -vcodec libx264 -crf 28 ${outputPath}`);

  console.log("video convereted")

  await storage.bucket(TARGET_BUCKET).upload(outputPath, {
    destination: `temp/${fileName}`,
    metadata: {
      contentType: "video/mp4",
      cacheControl: "public, max-age=31536000",
    },
  });

  await storage.bucket(TARGET_BUCKET).file(`temp/${fileName}`).makePublic();

  // Cleanup
  fs.unlinkSync(inputPath);
  fs.unlinkSync(outputPath);


  return `https://storage.googleapis.com/${TARGET_BUCKET}/temp/${fileName}`;
}

module.exports = { compressAndMoveVideo };
