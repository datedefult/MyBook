const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const toIco = require('to-ico');

async function generateIcons() {
  const sourceImage = path.join(__dirname, '../resources/MyWork.png');
  const resourcesDir = path.join(__dirname, '../resources');

  if (!fs.existsSync(sourceImage)) {
    console.error('Source image not found:', sourceImage);
    process.exit(1);
  }

  console.log('Generating icons from', sourceImage);

  try {
    // 1. Generate icon.png (512x512)
    await sharp(sourceImage)
      .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(resourcesDir, 'icon.png'));
    console.log('✓ icon.png generated');

    // 2. Generate tray-icon.png (64x64, suitable for system tray)
    await sharp(sourceImage)
      .resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(resourcesDir, 'tray-icon.png'));
    console.log('✓ tray-icon.png generated');

    // 3. Generate wordmark.png (let's make it 256x256, keeping logo)
    await sharp(sourceImage)
      .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(resourcesDir, 'wordmark.png'));
    console.log('✓ wordmark.png generated');

    // 4. Generate icon.ico using to-ico with proper PNG buffers
    console.log('Generating icon.ico...');
    const sizes = [256, 128, 64, 48, 32, 16];
    const buffers = [];
    
    for (const size of sizes) {
      const buffer = await sharp(sourceImage)
        .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
        .png()
        .toBuffer();
      buffers.push(buffer);
    }
    
    const icoBuffer = await toIco(buffers);
    fs.writeFileSync(path.join(resourcesDir, 'icon.ico'), icoBuffer);
    console.log('✓ icon.ico generated');

    // 5. Note: For ICNS (macOS), electron-builder handles conversion from icon.png
    console.log('Note: icon.icns will be handled by electron-builder from icon.png during packaging');

    console.log('\nAll icon files generated successfully!');
    console.log('You can now run `npm run dev` to test or `npm run dist:win` to build.');
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
