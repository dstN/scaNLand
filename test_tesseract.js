const { createWorker } = require('tesseract.js');
const Jimp = require('jimp');

async function test() {
  const imagePath = process.argv[2];
  
  // Apply a robust pre-processor
  const image = await Jimp.read(imagePath);
  
  // Crop the oval boundaries just like in the app (only take the center 45%x20%)
  // Wait, the test image is already an oval. Let's just scale it up and run OCR.
  
  image.scale(2); // Scale up to give Tesseract larger characters
  image.greyscale();
  image.contrast(0.2); // mild contrast
  
  const buffer = await image.getBufferAsync(Jimp.MIME_JPEG);
  
  const worker = await createWorker('eng');
  await worker.setParameters({
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -',
    tessedit_pageseg_mode: 6,
  });
  
  const { data: { text, confidence } } = await worker.recognize(buffer);
  console.log('--- TEST: SCALE + MILD CONTRAST + PSM 6 + WHITELIST ---');
  console.log(text.trim());
  console.log('--- CONFIDENCE ---');
  console.log(confidence);

  // Let's test single line mode PSM 7 if the string is mostly on one line (it's not, it's 3 lines)
  // Let's test PSM 11
  await worker.setParameters({ tessedit_pageseg_mode: 11 });
  const { data: { text: text11 } } = await worker.recognize(buffer);
  console.log('--- TEST: PSM 11 ---');
  console.log(text11.trim());

  await worker.terminate();
}

test();
