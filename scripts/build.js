const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PLUGIN_NAME = 'goldberg-achievements';
const OUT_DIR = path.join(__dirname, '..', 'out', PLUGIN_NAME);

// Clean previous build
if (fs.existsSync(OUT_DIR)) {
    fs.rmSync(OUT_DIR, { recursive: true, force: true });
}

// Ensure directories exist
fs.mkdirSync(path.join(OUT_DIR, 'dist'), { recursive: true });
fs.mkdirSync(path.join(OUT_DIR, 'backend'), { recursive: true });

console.log('Building frontend...');
try {
    execSync('npm run build', { stdio: 'inherit' });
} catch (e) {
    console.error('Frontend build failed!');
    process.exit(1);
}

console.log('Copying files...');

// Copy plugin.json
fs.copyFileSync(
    path.join(__dirname, '..', 'plugin.json'),
    path.join(OUT_DIR, 'plugin.json')
);

// Copy frontend dist
fs.copyFileSync(
    path.join(__dirname, '..', 'dist', 'index.js'),
    path.join(OUT_DIR, 'dist', 'index.js')
);

// Copy backend
const backendFiles = fs.readdirSync(path.join(__dirname, '..', 'backend'));
backendFiles.forEach(file => {
    fs.copyFileSync(
        path.join(__dirname, '..', 'backend', file),
        path.join(OUT_DIR, 'backend', file)
    );
});

console.log(`\n✅ Build complete! Plugin ready at: ${OUT_DIR}`);
console.log(`Copy the '${PLUGIN_NAME}' folder to your Steam/steamui/plugins/ directory.`);
