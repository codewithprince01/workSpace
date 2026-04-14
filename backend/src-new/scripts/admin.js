/**
 * WORKLENZ ADMIN CLI
 * Usage: node src-new/scripts/admin.js <command-name>
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const command = process.argv[2];
const maintenanceDir = path.join(__dirname, 'maintenance');

if (!command) {
  console.log('\n🚀 Worklenz Admin CLI');
  console.log('Usage: node src-new/scripts/admin.js <command>\n');
  console.log('Available commands:');
  fs.readdirSync(maintenanceDir).forEach(file => {
    if (file.endsWith('.js')) {
      console.log(`  - ${file.replace('.js', '')}`);
    }
  });
  console.log('  - health (Built-in health check)\n');
  process.exit(0);
}

const runScript = (scriptPath) => {
  console.log(`\n⏳ Executing: ${path.basename(scriptPath)}...\n`);
  const child = spawn('node', [scriptPath], { stdio: 'inherit' });
  child.on('close', (code) => {
    if (code === 0) {
      console.log(`\n✅ Finished successfully.`);
    } else {
      console.log(`\n❌ Failed with exit code ${code}.`);
    }
    process.exit(code);
  });
};

if (command === 'health') {
  runScript(path.join(__dirname, 'health-check.js'));
} else {
  const scriptPath = path.join(maintenanceDir, `${command}.js`);
  if (fs.existsSync(scriptPath)) {
    runScript(scriptPath);
  } else {
    console.error(`❌ Command "${command}" not found in ${maintenanceDir}`);
    process.exit(1);
  }
}
