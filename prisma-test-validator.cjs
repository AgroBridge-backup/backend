/**
 * Prisma E2E Test Validator — Pre-push/QA Script
 * Analiza el schema.prisma y todos tus tests (.e2e.test.ts, .test.ts, .e2e.test.js)
 * Busca llamadas a `prisma.MODEL.create({ data: { ... } })` y reporta si faltan campos requeridos.
 * Autor: Alejandro Navarro Ayala / Fortune 500 QA
 */

const fs = require('fs');
const path = require('path');

// Ajusta estas rutas:
const PRISMA_SCHEMA_PATH = './prisma/schema.prisma';
const TESTS_DIR = './apps/api/tests/e2e'; // Target E2E tests specifically

function parsePrismaSchema(schema) {
  const models = {};
  let currentModel = null;
  for (const line of schema.split('\n')) {
    let m;
    // Start of model
    if ((m = line.match(/^model\s+(\w+)\s+{/))) {
      currentModel = m[1];
      models[currentModel] = [];
    }
    // Field line inside model
    if (currentModel && line.trim() && !line.includes('///')) {
      const tokens = line.trim().split(/\s+/);
      if (tokens[1] && tokens[0] !== 'id' && !tokens[0].startsWith('//')) {
        // A field is required if it doesn't have a '?' and doesn't have a '@default'
        const isOptional = tokens[1].includes('?') || tokens.some(t => t.startsWith('@default')) || tokens.some(t => t.startsWith('@updatedAt'));
        const isRelation = tokens.some(t => t.startsWith('@relation'));

        if (!isOptional && !isRelation && !tokens[0].startsWith('@@')) {
          models[currentModel].push(tokens[0]);
        }
      }
    }
    // End of model
    if (currentModel && line.includes('}'))
      currentModel = null;
  }
  return models;
}

function collectTestFiles(root) {
  let files = [];
  try {
    if (!fs.existsSync(root)) {
        console.warn(`[WARN] Directorio de tests no encontrado: ${root}`);
        return [];
    }
    for (const file of fs.readdirSync(root)) {
      const full = path.join(root, file);
      if (fs.statSync(full).isDirectory()) {
        files = files.concat(collectTestFiles(full));
      } else if (file.match(/\.e2e\.test\.(ts|js)$/) || file.match(/\.test\.(ts|js)$/)) {
        files.push(full);
      }
    }
  } catch (e) {
      console.error(`[ERROR] No se pudo leer el directorio de tests: ${root}`, e);
  }
  return files;
}

function analyzeTestForModel(filename, models) {
  const code = fs.readFileSync(filename, 'utf8');
  const regex = /prisma.(\w+).create\s*\(\s*{[^}]*data\s*:\s*{([^}]+)}/gms;
  let foundErrors = [];

  let m;
  while ((m = regex.exec(code))) {
    const modelName = m[1].charAt(0).toUpperCase() + m[1].slice(1);
    if (!models[modelName]) continue;
    
    const dataBlockContent = m[2];
    // This regex is a bit simplistic and might not handle all cases, but works for simple key:value pairs.
    const usedFields = [...dataBlockContent.matchAll(/(\w+)\s*:/g)].map(res => res[1]);
    
    const missing = models[modelName].filter(f => !usedFields.includes(f));
    
    if (missing.length) {
      foundErrors.push({
        file: filename,
        model: modelName,
        missing,
        line: code.slice(0, m.index).split('\n').length,
        used: usedFields,
      });
    }
  }
  return foundErrors;
}

try {
    const schema = fs.readFileSync(PRISMA_SCHEMA_PATH, 'utf8');
    const models = parsePrismaSchema(schema);
    
    const files = collectTestFiles(TESTS_DIR);
    let allIssues = [];
    for (const file of files) {
      const issues = analyzeTestForModel(file, models);
      if (issues.length) allIssues = allIssues.concat(issues);
    }
    
    if (allIssues.length) {
      console.error('=== PRISMA TEST FIELD VALIDATION (PRE-PUSH BLOCKER) ===');
      for (const issue of allIssues) {
        console.error(`\n- [FAIL] In ${issue.file} (line ~${issue.line}), prisma.${issue.model}.create() is missing required fields: ${issue.missing.join(', ')}`);
        console.log(`  (Present fields: ${issue.used.join(', ')})`);
      }
      console.error('\nCorrige los tests para incluir todos los campos requeridos antes de hacer push.\n');
      process.exit(1); // Fail pre-push
    } else {
      console.log('✔ Todos los tests E2E cubren los campos requeridos por Prisma. Listo para Fortune 500 QA/push.');
      process.exit(0);
    }
} catch (e) {
    console.error('[FATAL] El script de validación no pudo ejecutarse.', e);
    process.exit(1);
}
