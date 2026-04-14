// Cleanup script to remove unnecessary files and folders
const fs = require('fs');
const path = require('path');

const filesToDelete = [
  'babel.config.js',
  'jest.config.js',
  'esbuild.js',
  'www-cors.js',
  'www-simple.js',
  'www-server.js',
  'new',
  'release',
  'migrations-setup.md',
  'config.js'
];

const foldersToDelete = [
  'database',
  'cli',
  'scss',
  'doc',
  'build'
];

console.log('🗑️  Starting cleanup...\n');

// Delete files
filesToDelete.forEach(file => {
  const filePath = path.join(__dirname, file);
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`✅ Deleted file: ${file}`);
    }
  } catch (err) {
    console.log(`⚠️  Could not delete ${file}: ${err.message}`);
  }
});

// Delete folders
foldersToDelete.forEach(folder => {
  const folderPath = path.join(__dirname, folder);
  try {
    if (fs.existsSync(folderPath)) {
      fs.rmSync(folderPath, { recursive: true, force: true });
      console.log(`✅ Deleted folder: ${folder}`);
    }
  } catch (err) {
    console.log(`⚠️  Could not delete ${folder}: ${err.message}`);
  }
});

console.log('\n✨ Cleanup complete!');
console.log('\n📋 Next steps:');
console.log('1. Stop all running servers (Ctrl+C)');
console.log('2. Run: ren src src-old');
console.log('3. Run: ren src-new src');
console.log('4. Run: copy src\\package.json package.json');
console.log('5. Run: npm install');
console.log('6. Run: npm run dev');
