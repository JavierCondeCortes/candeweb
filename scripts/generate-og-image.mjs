// Genera public/media/og-cover.jpg (1200x630) para Open Graph y Twitter Cards.
// Uso: node scripts/generate-og-image.mjs
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = new URL('../public/media/', import.meta.url);
const source = fileURLToPath(new URL('hero-poster.webp', root));
const output = fileURLToPath(new URL('og-cover.jpg', root));

await sharp(source)
  .resize(1200, 630, { fit: 'cover', position: 'attention' })
  .jpeg({ quality: 82, mozjpeg: true })
  .toFile(output);
console.log(`Imagen generada: ${output}`);
