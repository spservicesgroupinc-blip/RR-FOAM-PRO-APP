const fs = require('fs');
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

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

sizes.forEach(function(size) {
  fs.writeFileSync('public/icons/icon-' + size + 'x' + size + '.svg', generateSVG(size, false));
  fs.writeFileSync('public/icons/icon-' + size + 'x' + size + '-maskable.svg', generateSVG(size, true));
});
console.log('Generated icons for sizes: ' + sizes.join(', '));
