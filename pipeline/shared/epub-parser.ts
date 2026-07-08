// pipeline/shared/epub-parser.ts
// Handles AZW3 → EPUB conversion via Calibre CLI + EPUB chapter extraction
// Used only for The Economist pipeline

import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join, extname, basename } from 'path';
import EPub from 'epub2';

const CALIBRE = '/Applications/calibre.app/Contents/MacOS/ebook-convert';
const TMP_DIR = join(process.cwd(), 'pipeline', '.tmp');

export interface EpubChapter {
  id: string;
  title: string;
  html: string;
}

export interface EpubMeta {
  title: string;
  publisher: string;
  date: string;
  coverPath: string | null;
  chapters: EpubChapter[];
}

function ensureTmp() {
  if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });
}

/** Convert AZW3 to EPUB using Calibre CLI, returns path to the .epub file */
export function convertToEpub(inputPath: string): string {
  ensureTmp();
  if (extname(inputPath) === '.epub') return inputPath;

  const name = basename(inputPath, extname(inputPath));
  const outputPath = join(TMP_DIR, `${name}.epub`);

  if (!existsSync(CALIBRE)) {
    throw new Error(
      'Calibre not found at /Applications/calibre.app. Please install Calibre from https://calibre-ebook.com'
    );
  }

  console.log(`⚙️  Converting ${basename(inputPath)} → EPUB via Calibre…`);
  execSync(`"${CALIBRE}" "${inputPath}" "${outputPath}"`, { stdio: 'inherit' });
  console.log(`✅ Converted to ${outputPath}`);
  return outputPath;
}

/** Parse EPUB file and extract chapters as HTML + metadata */
export function parseEpub(epubPath: string): Promise<EpubMeta> {
  return new Promise((resolve, reject) => {
    const epub = new EPub(epubPath);

    epub.on('error', reject);
    epub.on('end', async () => {
      const chapters: EpubChapter[] = [];

      // Extract each chapter in spine order
      for (const item of epub.flow) {
        try {
          const chapterId = item.id as string;
          const html = await new Promise<string>((res, rej) => {
            epub.getChapter(chapterId, (err, text) => {
              if (err) rej(err); else res(text ?? '');
            });
          });
          if (html.trim().length > 200) {
            chapters.push({ id: chapterId, title: (item.title as string | undefined) ?? '', html });
          }
        } catch {
          // Skip chapters that fail to extract
        }
      }

      resolve({
        title: epub.metadata.title ?? '',
        publisher: epub.metadata.publisher ?? '',
        date: epub.metadata.date ?? '',
        coverPath: null, // Cover handling can be added later
        chapters,
      });
    });

    epub.parse();
  });
}
