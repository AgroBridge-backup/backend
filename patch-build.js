const fs = require('fs');
const path = require('path');

// Adjust this if your output is not 'dist'
const DIST_DIR = path.resolve(__dirname, 'dist'); 

function walk(dir, callback) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath, callback);
    } else if (fullPath.endsWith('.js') || fullPath.endsWith('.d.ts')) {
      callback(fullPath);
    }
  });
}

function patchFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Regex to find relative imports/exports without extension
  // Searches for: from './algo' or from '../algo' that DOES NOT end in .js/.json
  const regex = /((?:import|export)\s+[\s\S]*?from\s+['"])(\.\.?\/[^'"]+?)(['"])/g;

  const newContent = content.replace(regex, (match, prefix, importPath, suffix) => {
    if (importPath.endsWith('.js') || importPath.endsWith('.json')) {
      return match;
    }
    changed = true;
    return `${prefix}${importPath}.js${suffix}`;
  });

  if (changed) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Patched: ${path.relative(process.cwd(), filePath)}`);
  }
}

console.log(`Starting import patch in: ${DIST_DIR}`);
walk(DIST_DIR, patchFile);
console.log('Patch complete.');