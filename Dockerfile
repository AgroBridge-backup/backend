
# Fase 1: Build - Usar una imagen base de Node.js con una versión LTS (Long-Term Support)
FROM node:18-alpine AS builder

# Establecer el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiar los archivos de manifiesto de dependencias
COPY package*.json ./

# Instalar dependencias de producción. `npm ci` es más rápido y seguro para builds.
RUN npm install --only=production

# Copiar el resto del código de la aplicación
COPY . .

# Fase 2: Production - Usar una imagen más pequeña para reducir la superficie de ataque
FROM node:18-alpine

WORKDIR /app

# Copiar las dependencias instaladas y el código de la fase de build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app ./

# Exponer el puerto en el que corre la aplicación
EXPOSE 3000

# Comando para iniciar la aplicación. Usamos una forma que maneja correctamente las señales del sistema.
CMD [ "node", "src/index.js" ]
