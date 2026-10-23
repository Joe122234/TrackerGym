import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const sizes = [192, 512];
await mkdir("public/icons", { recursive: true });

const svg = `
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="112" fill="#0B0D10"/>
  <rect x="20" y="20" width="472" height="472" rx="96" stroke="#262D36" stroke-width="4"/>
  <circle cx="256" cy="74" r="190" fill="#C5F467" fill-opacity="0.07"/>
  <path d="M144 112H368V184H256V248H368V320H256V400H144V112Z" fill="#C5F467"/>
  <path d="M368 336L416 384L368 432V336Z" fill="#C5F467" fill-opacity="0.55"/>
</svg>`;

for (const size of sizes) {
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(`public/icons/icon-${size}.png`);
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(`public/icons/maskable-${size}.png`);
}

await sharp(Buffer.from(svg))
  .resize(180, 180)
  .png()
  .toFile("public/icons/apple-touch-icon.png");

console.log("Generated FORGE icons.");
