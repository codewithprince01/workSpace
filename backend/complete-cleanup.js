// Complete cleanup - Delete everything extra
const fs = require('fs');
const path = require('path');

const itemsToDelete = [
  // Old source folder
  { path: 'src', type: 'folder' },
  
  // Scripts folder
  { path: 'scripts', type: 'folder' },
  
  // Worklenz email templates
  { path: 'worklenz-email-templates', type: 'folder' },
  
  // All remaining www files
  { path: 'www-minimal-auth.js', type: 'file' },
  
  // All fix scripts
  { path: 'fix-database-service.js', type: 'file' },
  { path: 'fix-db-imports.js', type: 'file' },
  { path: 'fix-db-imports.ps1', type: 'file' },
  { path: 'fix-final-issues.js', type: 'file' },
  { path: 'fix-final-rows.js', type: 'file' },
  { path: 'fix-import-paths.js', type: 'file' },
  { path: 'fix-remaining-issues.js', type: 'file' },
  { path: 'fix-rows-references.js', type: 'file' },
  { path: 'fix-single-records.js', type: 'file' },
  
  // Error files
  { path: 'errors.txt', type: 'file' },
  { path: 'errors2.txt', type: 'file' },
  { path: 'errors3.txt', type: 'file' },
  { path: 'sql_errors.txt', type: 'file' },
  { path: 'verify_errors.txt', type: 'file' },
  
  // Other files
  { path: 'new', type: 'file' },
  { path: 'release', type: 'file' },
  { path: 'migrations-setup.md', type: 'file' },
  { path: 'config.js', type: 'file' },
  { path: 'build.sh', type: 'file' },
  { path: 'sonar-project.properties', type: 'file' }
];

console.log('🗑️  COMPLETE CLEANUP - Deleting ALL extra files...\n');

let deletedCount = 0;
let failedCount = 0;

itemsToDelete.forEach(item => {
  const itemPath = path.join(__dirname, item.path);
  try {
    if (fs.existsSync(itemPath)) {
      if (item.type === 'folder') {
        fs.rmSync(itemPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(itemPath);
      }
      console.log(`✅ Deleted ${item.type}: ${item.path}`);
      deletedCount++;
    } else {
      console.log(`⏭️  Already gone: ${item.path}`);
    }
  } catch (err) {
    console.log(`❌ Failed to delete ${item.path}: ${err.message}`);
    failedCount++;
  }
});

console.log(`\n📊 Summary:`);
console.log(`   ✅ Deleted: ${deletedCount}`);
console.log(`   ❌ Failed: ${failedCount}`);
console.log('\n✨ Cleanup done! Now rename src-new to src');
