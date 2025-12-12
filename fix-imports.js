// fix-imports.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(file => {
    const fullname = path.join(dir, file);
    if (fs.lstatSync(fullname).isDirectory()) {
      walk(fullname, callback);
    } else if (fullname.endsWith('.ts')) {
      callback(fullname);
    }
  });
}

function fixImports(file) {
  let code = fs.readFileSync(file, 'utf8');
  let lines = code.split('\n');
  let changed = false;

  // Regex to capture import statements.
  // Group 1: everything before the path (e.g., "import { Foo } from ")
  // Group 2: the opening quote (e.g., "'")
  // Group 3: the import path (e.g., "./some/path" or "../another/path" or "module-name")
  // Group 4: the closing quote and semicolon (e.g., "';")
  const importRegex = /(import(?:["\'\s]*(?:[\w*{}\n\r\t, ]+)from\s*)?)(["`])([^"`]+?)(["`]\s*;?)/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(importRegex);

    if (match) {
      const [, importStart, quote1, importPath, quote2] = match;
      
      // Check if it's a relative import (starts with ./) or (../)
      if (importPath.startsWith('./') || importPath.startsWith('../')) {
        // Only add .js if it doesn't already end with .js or .ts
        if (!importPath.endsWith('.js') && !importPath.endsWith('.ts')) {
          lines[i] = `${importStart}${quote1}${importPath}.js${quote2}`;
          changed = true;
        }
      }
    }
  }

  if (changed) {
    fs.writeFileSync(file, lines.join('\n'));
    console.log('Patched:', file);
  }
}

const projectRoot = path.resolve(__dirname, './');
const apiSrcPath = path.join(projectRoot, 'apps', 'api', 'src');

walk(apiSrcPath, fixImports);
