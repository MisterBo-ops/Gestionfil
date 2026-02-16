// Génération d'icônes PNG basiques en utilisant SVG en base64
const fs = require('fs');

// Fonction pour créer un SVG simple
function createSVG(size) {
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#FFC800"/>
  <circle cx="${size/2}" cy="${size/2}" r="${size/5}" fill="#000000"/>
  <text x="${size/2}" y="${size/2}" font-family="Arial, sans-serif" font-size="${size*0.4}" font-weight="bold" fill="#FFC800" text-anchor="middle" dominant-baseline="central">Q</text>
</svg>
  `.trim();
}

// Créer les fichiers SVG temporaires
fs.writeFileSync('public/static/icon-192.svg', createSVG(192));
fs.writeFileSync('public/static/icon-512.svg', createSVG(512));

console.log('✅ Icônes SVG générées : icon-192.svg et icon-512.svg');
console.log('Note: Pour la production, convertir les SVG en PNG si nécessaire');
