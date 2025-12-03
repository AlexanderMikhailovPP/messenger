const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, '../public/icon.svg');
const publicDir = path.join(__dirname, '../public');

async function generateIcons() {
    const svgBuffer = fs.readFileSync(svgPath);

    // Generate PNG 1024x1024
    await sharp(svgBuffer)
        .resize(1024, 1024)
        .png()
        .toFile(path.join(publicDir, 'icon.png'));

    console.log('Generated icon.png (1024x1024)');

    // Generate different sizes for icns
    const sizes = [16, 32, 64, 128, 256, 512, 1024];
    const iconsetDir = path.join(publicDir, 'icon.iconset');

    if (!fs.existsSync(iconsetDir)) {
        fs.mkdirSync(iconsetDir);
    }

    for (const size of sizes) {
        await sharp(svgBuffer)
            .resize(size, size)
            .png()
            .toFile(path.join(iconsetDir, `icon_${size}x${size}.png`));

        // Retina versions
        if (size <= 512) {
            await sharp(svgBuffer)
                .resize(size * 2, size * 2)
                .png()
                .toFile(path.join(iconsetDir, `icon_${size}x${size}@2x.png`));
        }
    }

    console.log('Generated iconset for macOS');
    console.log('Run: iconutil -c icns public/icon.iconset -o public/icon.icns');
}

generateIcons().catch(console.error);
