import { defineConfig } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';

// https://vitejs.dev/config/
export default defineConfig({
    // ¡AQUÍ ESTÁ EL ARREGLO #1 para "index.html no encontrado"!
    // Le decimos a Vite que tu proyecto frontend vive adentro de 'public_html'
    root: 'wow-landing',
    publicDir: 'public',

    plugins: [
        visualizer({
            open: true,
            filename: '../stats.html',
        }),
    ],

    build: {
        // (inject: 'body', ha sido eliminado)
        outDir: '../dist',
        emptyOutDir: true, // Limpia la 'dist/' vieja cada vez
        sourcemap: false, // Habilitar para depuración del bundle
    },
});
