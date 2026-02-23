const fs = require('fs');
const sharp = require('sharp');
const sizes = [72, 96, 128, 144, 152, 180, 192, 384, 512];

function generateSVG(size, maskable) {
  const fontSize = Math.floor(size * 0.18);
  const subFontSize = Math.floor(size * 0.055);
  const proFontSize = Math.floor(size * 0.045);
  const cx = size / 2;
  const cy = size / 2;
  const rx = maskable ? 0 : Math.floor(size * 0.15);
  const rfeBoxW = Math.floor(fontSize * 2.2);
  const rfeBoxH = Math.floor(fontSize * 1.3);
  const rfeBoxX = Math.floor(-fontSize * 1.1);
  const rfeBoxY = Math.floor(-fontSize * 0.65);
  const proBoxW = Math.floor(proFontSize * 4);
  const proBoxH = Math.floor(proFontSize * 1.6);
  const proBoxX = Math.floor(cx - proFontSize * 2);
  const proBoxY = Math.floor(cy + size * 0.25);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${rx}" fill="#0F172A"/>
  <g transform="translate(${cx},${Math.floor(cy - size * 0.05)})">
    <g transform="skewX(-12)">
      <rect x="${rfeBoxX}" y="${rfeBoxY}" width="${rfeBoxW}" height="${rfeBoxH}" rx="${Math.floor(size * 0.015)}" fill="#E30613"/>
    </g>
    <text x="0" y="${Math.floor(fontSize * 0.25)}" text-anchor="middle" fill="white" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="${fontSize}">RFE</text>
  </g>
  <text x="${cx}" y="${Math.floor(cy + size * 0.2)}" text-anchor="middle" fill="#FFDE00" font-family="Arial,sans-serif" font-weight="700" font-size="${subFontSize}" letter-spacing="${Math.floor(subFontSize * 0.3)}">FOAM EQUIP</text>
  <rect x="${proBoxX}" y="${proBoxY}" width="${proBoxW}" height="${proBoxH}" rx="${Math.floor(size * 0.01)}" fill="#E30613"/>
  <text x="${cx}" y="${Math.floor(proBoxY + proFontSize * 1.2)}" text-anchor="middle" fill="white" font-family="Arial,sans-serif" font-weight="900" font-size="${proFontSize}">PRO</text>
</svg>`;
}

async function generateIcons() {
  // Ensure output directory exists
  if (!fs.existsSync('public/icons')) {
    fs.mkdirSync('public/icons', { recursive: true });
  }

  for (const size of sizes) {
    const svg = generateSVG(size, false);
    const maskableSvg = generateSVG(size, true);

    // Write SVG icons
    fs.writeFileSync(`public/icons/icon-${size}x${size}.svg`, svg);
    fs.writeFileSync(`public/icons/icon-${size}x${size}-maskable.svg`, maskableSvg);

    // Generate PNG from SVG using sharp (required for iOS)
    await sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toFile(`public/icons/icon-${size}x${size}.png`);

    await sharp(Buffer.from(maskableSvg))
      .resize(size, size)
      .png()
      .toFile(`public/icons/icon-${size}x${size}-maskable.png`);

    console.log(`  ✓ Generated ${size}x${size} (SVG + PNG)`);
  }

  // Also generate the standard named icons used by manifest & HTML
  const svg192 = generateSVG(192, false);
  const svg512 = generateSVG(512, false);
  const svgMaskable = generateSVG(512, true);
  const svg180 = generateSVG(180, false);

  fs.writeFileSync('public/icons/icon-192.svg', svg192);
  fs.writeFileSync('public/icons/icon-512.svg', svg512);
  fs.writeFileSync('public/icons/icon-maskable.svg', svgMaskable);

  await sharp(Buffer.from(svg192)).resize(192, 192).png().toFile('public/icons/icon-192.png');
  await sharp(Buffer.from(svg512)).resize(512, 512).png().toFile('public/icons/icon-512.png');
  await sharp(Buffer.from(svgMaskable)).resize(512, 512).png().toFile('public/icons/icon-maskable.png');
  await sharp(Buffer.from(svg180)).resize(180, 180).png().toFile('public/icons/apple-touch-icon.png');
  await sharp(Buffer.from(svg180)).resize(180, 180).png().toFile('public/icons/apple-touch-icon-180x180.png');

  // Generate Apple splash screen icons
  const splashSizes = [
    { w: 1125, h: 2436, name: 'apple-splash-1125x2436' },  // iPhone X/XS
    { w: 1242, h: 2688, name: 'apple-splash-1242x2688' },  // iPhone XS Max
    { w: 828, h: 1792, name: 'apple-splash-828x1792' },     // iPhone XR
    { w: 1170, h: 2532, name: 'apple-splash-1170x2532' },   // iPhone 12/13
    { w: 1179, h: 2556, name: 'apple-splash-1179x2556' },   // iPhone 14 Pro
    { w: 1290, h: 2796, name: 'apple-splash-1290x2796' },   // iPhone 14 Pro Max
  ];
  
  for (const splash of splashSizes) {
    const iconSize = Math.min(splash.w, splash.h) * 0.3;
    const iconSvg = generateSVG(Math.round(iconSize), false);
    
    await sharp({
      create: {
        width: splash.w,
        height: splash.h,
        channels: 4,
        background: { r: 15, g: 23, b: 42, alpha: 1 } // #0F172A
      }
    })
    .composite([{
      input: await sharp(Buffer.from(iconSvg)).resize(Math.round(iconSize), Math.round(iconSize)).png().toBuffer(),
      gravity: 'centre'
    }])
    .png()
    .toFile(`public/icons/${splash.name}.png`);
    
    console.log(`  ✓ Generated splash ${splash.name}`);
  }

  console.log('\n✅ All icons generated successfully!');
  console.log('   Sizes: ' + sizes.join(', '));
  console.log('   Formats: SVG + PNG (for iOS compatibility)');
  console.log('   Apple splash screens: ' + splashSizes.length + ' sizes');
}

generateIcons().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
