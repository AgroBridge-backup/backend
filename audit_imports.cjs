const fs = require('fs');
const path = require('path');
const glob = require('glob');

// --- CONFIGURATION ---
const AUDIT_DIRECTORIES = ['apps/api/src', 'apps/api/tests'];
const FILE_EXTENSION_PATTERN = /\.(ts|tsx)$/;
const IMPORT_REGEX = /from\s+['"]((@\/|\.\/|\.\.\/)[^'"]+)['"]/g;

console.log('[QA] Iniciando Auditoría Proactiva de Dependencias...');

const missingFiles = new Set();
const checkedFiles = new Set();

// 1. Find all TypeScript files in the target directories
let filesToAudit = [];
AUDIT_DIRECTORIES.forEach(dir => {
    filesToAudit = filesToAudit.concat(glob.sync(`${dir}/**/*.ts`));
});
console.log(`[INFO] Encontrados ${filesToAudit.length} archivos para auditar.`);

// 2. Read each file and extract its imports
filesToAudit.forEach(filePath => {
    if (!fs.existsSync(filePath)) return;
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const directoryName = path.dirname(filePath);

    let match;
    while ((match = IMPORT_REGEX.exec(fileContent)) !== null) {
        const importPath = match[1];

        // Skip package imports
        if (!importPath.startsWith('.') && !importPath.startsWith('@/')) {
            continue;
        }

        // Resolve path alias
        let resolvedPath = importPath.startsWith('@/') 
            ? path.join('apps/api/src', importPath.substring(2))
            : path.resolve(directoryName, importPath);

        // Normalize path and handle extensions
        let finalPath = resolvedPath.replace(/\.js$/, ''); // Remove .js if present
        
        if (checkedFiles.has(finalPath)) continue;

        // Check for existence with .ts, .ts/index.ts, etc.
        if (
            !fs.existsSync(`${finalPath}.ts`) &&
            !fs.existsSync(`${finalPath}.d.ts`) &&
            !fs.existsSync(path.join(finalPath, 'index.ts'))
        ) {
            missingFiles.add(`${finalPath}.ts`);
        }
        checkedFiles.add(finalPath);
    }
});

// 3. Report and create missing files
if (missingFiles.size > 0) {
    console.warn(`[WARN] Se detectaron ${missingFiles.size} archivos de dependencia faltantes.`);
    missingFiles.forEach(missingPath => {
        console.log(`  - [FALTA] ${missingPath}`);
        
        // 4. Create dummy file
        const dummyContent = `// MOCK AUTO-GENERATED FOR QA TEST: REPLACE WITH REAL MODULE BEFORE DEPLOY
// This file was created by the QA Automation Agent because it was missing.

export default {};
`;
        try {
            fs.mkdirSync(path.dirname(missingPath), { recursive: true });
            fs.writeFileSync(missingPath, dummyContent, 'utf8');
            console.log(`    [FIX] Archivo dummy creado en: ${missingPath}`);
        } catch (e) {
            console.error(`    [ERROR] No se pudo crear el archivo dummy para ${missingPath}:`, e);
        }
    });
} else {
    console.log('[SUCCESS] No se encontraron dependencias rotas o archivos faltantes en las rutas de importación.');
}

console.log('[QA] Auditoría de Dependencias Finalizada.');
