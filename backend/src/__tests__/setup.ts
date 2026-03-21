import fs from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';

async function ensureFixtures(): Promise<void> {
  const fixturesDir = path.resolve(__dirname, 'fixtures');
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true });
  }

  const pdfPath = path.join(fixturesDir, 'test.pdf');
  if (!fs.existsSync(pdfPath)) {
    const pdf = await PDFDocument.create();
    pdf.addPage([200, 200]);
    const bytes = await pdf.save();
    fs.writeFileSync(pdfPath, Buffer.from(bytes));
  }

  const jpgPath = path.join(fixturesDir, 'test.jpg');
  if (!fs.existsSync(jpgPath)) {
    const buf = await sharp({
      create: { width: 50, height: 50, channels: 3, background: { r: 255, g: 255, b: 255 } },
    })
      .jpeg()
      .toBuffer();
    fs.writeFileSync(jpgPath, buf);
  }

  const pngPath = path.join(fixturesDir, 'test.png');
  if (!fs.existsSync(pngPath)) {
    const buf = await sharp({
      create: { width: 50, height: 50, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
    })
      .png()
      .toBuffer();
    fs.writeFileSync(pngPath, buf);
  }
}

beforeAll(async () => {
  await ensureFixtures();
});
