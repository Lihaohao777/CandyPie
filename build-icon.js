const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const svgPath = path.join(__dirname, 'src/picture/candy.svg')
const outDir = path.join(__dirname, 'assets')
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir)

sharp(fs.readFileSync(svgPath))
  .resize(256, 256)
  .png()
  .toFile(path.join(outDir, 'icon.png'))
  .then(() => console.log('icon.png created'))
  .catch(e => console.error(e))
