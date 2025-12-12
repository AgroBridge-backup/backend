// tools/hash-password.js
// Note: This script uses bcryptjs, which is already a dependency in your package.json
const bcrypt = require('bcryptjs');
const saltRounds = 10; // Standard salt rounds
const plainPassword = 'testpassword';

bcrypt.hash(plainPassword, saltRounds, function(err, hash) {
    if (err) {
        console.error("Error hashing password:", err);
        process.exit(1);
    }
    console.log(`Bcrypt hash for '${plainPassword}':`);
    console.log(hash);
});
