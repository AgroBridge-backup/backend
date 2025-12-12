const { Command } = require('commander');
const program = new Command();

program
    .name('agrobridge-cli')
    .description('CLI unificada para herramientas y operaciones de AgroBridge')
    .version('1.0.0');

program
    .command('create-user')
    .description('Crear un nuevo usuario en la base de datos')
    .argument('<username>', 'Nombre de usuario')
    .argument('<password>', 'Contraseña del usuario')
    .option(
        '-r, --role <role>',
        'Rol del usuario (producer, buyer, admin)',
        'producer'
    )
    .action((username, password, options) => {
        // Lógica para crear un usuario. En una implementación real, esto se conectaría
        // a la base de datos y utilizaría la misma lógica de hashing que la API.
        console.log(`
        [SIMULACIÓN] Creando usuario...
        ---------------------------
        Username: ${username}
        Password: [PROTEGIDO]
        Rol:      ${options.role}
        ---------------------------
        Usuario creado exitosamente (simulado).
        `);
    });

program.parse(process.argv);
