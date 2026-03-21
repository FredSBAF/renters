import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import sharp from 'sharp';

type WatermarkParams = {
  fileBuffer: Buffer;
  mimeType: string;
  agencyName: string;
  agencyId: number;
  userId: number;
  documentId: number;
  timestamp: Date;
  linkId?: string;
};

export class WatermarkService {
  static async watermarkDocument(params: WatermarkParams): Promise<Buffer> {
    if (params.mimeType === 'application/pdf') {
      return WatermarkService.watermarkPdf(params.fileBuffer, params);
    }
    if (params.mimeType === 'image/jpeg' || params.mimeType === 'image/png') {
      return WatermarkService.watermarkImage(params.fileBuffer, params.mimeType, params);
    }
    return params.fileBuffer;
  }

  private static async watermarkPdf(buffer: Buffer, data: WatermarkParams): Promise<Buffer> {
    const pdfDoc = await PDFDocument.load(buffer);
    const pages = pdfDoc.getPages();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const date = data.timestamp.toISOString();
    const ref = `WM-${data.documentId}-${data.agencyId}`;

    for (const page of pages) {
      const { width, height } = page.getSize();
      page.drawText(`Consulte par ${data.agencyName} le ${date} - Ref: ${ref}`, {
        x: 30,
        y: 20,
        size: 9,
        font,
        color: rgb(0.5, 0.5, 0.5),
        opacity: 0.4,
      });
      page.drawText(`RENTERS - ${data.agencyName}`, {
        x: width / 6,
        y: height / 2,
        size: 40,
        font,
        color: rgb(0.5, 0.5, 0.5),
        opacity: 0.08,
        rotate: degrees(45),
      });
    }

    pdfDoc.setSubject(
      JSON.stringify({
        agency_id: data.agencyId,
        user_id: data.userId,
        document_id: data.documentId,
        timestamp: data.timestamp.toISOString(),
        wm_version: '1',
        link_id: data.linkId ?? null,
      })
    );
    pdfDoc.setKeywords([`agency:${data.agencyId}`, `doc:${data.documentId}`]);

    return Buffer.from(await pdfDoc.save());
  }

  private static async watermarkImage(
    buffer: Buffer,
    mimeType: string,
    data: WatermarkParams
  ): Promise<Buffer> {
    const text = `Consulte par ${data.agencyName} le ${data.timestamp.toISOString()}`;
    const meta = await sharp(buffer).metadata();
    const width = meta.width ?? 120;
    const height = Math.max(20, Math.floor((meta.height ?? 100) * 0.2));
    const svg = `<svg width="${width}" height="${height}"><text x="10" y="${Math.max(
      20,
      Math.floor(height * 0.7)
    )}" fill="gray" fill-opacity="0.4" font-size="${Math.max(
      10,
      Math.floor(height * 0.5)
    )}">${text}</text></svg>`;
    const img = await sharp(buffer)
      .composite([{ input: Buffer.from(svg), gravity: 'southwest' }])
      .toBuffer();

    return mimeType === 'image/png'
      ? sharp(img).png().toBuffer()
      : sharp(img).jpeg({ quality: 90 }).toBuffer();
  }

  static async extractSteganography(buffer: Buffer, mimeType: string): Promise<object | null> {
    if (mimeType === 'application/pdf') {
      const pdfDoc = await PDFDocument.load(buffer);
      const subject = pdfDoc.getSubject();
      if (!subject) return null;
      try {
        return JSON.parse(subject) as object;
      } catch {
        return null;
      }
    }
    return null;
  }
}
