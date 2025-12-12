const { defineConfig } = require('cypress');

module.exports = defineConfig({
    e2e: {
        // La URL base que Cypress usará para visitar las páginas.
        // La configuraremos para que apunte al servidor de desarrollo de Vite.
        baseUrl: 'http://localhost:3000',

        // Configuración de video para grabar las ejecuciones de prueba (útil para depuración en CI)
        video: false,

        setupNodeEvents() {
            // implement node event listeners here
        },
    },
});
