/**
 * LinkedIn native document export.
 *
 * LinkedIn renders each PDF page as a 4:5 slide and gives document posts ~25-60s
 * of dwell time. Pages are therefore exactly 1080x1350 pt with a full-bleed
 * image and zero interactive links (tap targets inside a PDF viewer frustrate
 * mobile readers and depress completion).
 */
import { PDFDocument } from 'pdf-lib';

export const PDF_PAGE_WIDTH = 1080;
export const PDF_PAGE_HEIGHT = 1350;

export interface PdfOptions {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  creator?: string;
}

/** Builds a multi-page PDF from PNG page rasters, one page per slide. */
export async function buildPdf(pages: Buffer[], options: PdfOptions = {}): Promise<Buffer> {
  if (pages.length === 0) throw new Error('buildPdf requires at least one page');
  const doc = await PDFDocument.create();
  doc.setTitle(options.title ?? 'Carousel');
  doc.setAuthor(options.author ?? 'omni-carousel-agent');
  doc.setSubject(options.subject ?? 'LinkedIn carousel (1080x1350 pages)');
  doc.setCreator(options.creator ?? 'omni-carousel-agent');
  doc.setProducer('omni-carousel-agent');
  doc.setKeywords(options.keywords ?? []);
  doc.setCreationDate(new Date(0));
  doc.setModificationDate(new Date(0));

  for (const png of pages) {
    const image = await doc.embedPng(png);
    const page = doc.addPage([PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT]);
    page.drawImage(image, { x: 0, y: 0, width: PDF_PAGE_WIDTH, height: PDF_PAGE_HEIGHT });
  }

  const bytes = await doc.save({ useObjectStreams: false });
  return Buffer.from(bytes);
}
