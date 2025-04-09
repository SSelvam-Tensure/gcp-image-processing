
const { exec } = require("child_process");


async function scanUploadedFile(sourceBucket, fileName) { 
    const tmpFilePath = path.join('/tmp', fileName);
    await storage.bucket(sourceBucket).file(fileName).download({ destination: tmpFilePath });
    console.log('Download complete. Starting scan...');

    const scanResult = await new Promise((resolve, reject) => {
      exec(`clamscan ${tmpFilePath}`, (err, stdout, stderr) => {
        if (err && err.code !== 1) {
          console.error(`Scan error: ${stderr}`);
          reject(`Scan failed: ${stderr}`);
          return;
        }
        resolve(stdout);
      });
    });

    console.log(`Scan result: ${scanResult}`);

    if (scanResult.includes('OK')) {
      console.log(`Clean file. Uploading to ${CLEAN_BUCKET}`);
      await storage.bucket(CLEAN_BUCKET).upload(tmpFilePath, { destination: name });
    }

    await fs.unlink(tmpFilePath);
    console.log(`Processing complete for: ${name}`);
}

module.exports = { scanUploadedFile }
