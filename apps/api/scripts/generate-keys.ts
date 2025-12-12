// apps/api/scripts/generate-keys.ts
import { generateKeyPairSync } from 'crypto';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

console.log('Generating new JWT key pair...');

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem',
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem',
  },
});

const privateKeyPath = resolve(process.cwd(), 'jwtRS256.key');
const publicKeyPath = resolve(process.cwd(), 'jwtRS256.key.pub');

writeFileSync(privateKeyPath, privateKey);
writeFileSync(publicKeyPath, publicKey);

console.log(`Keys generated successfully at:`);
console.log(`- Private Key: ${privateKeyPath}`);
console.log(`- Public Key: ${publicKeyPath}`);
