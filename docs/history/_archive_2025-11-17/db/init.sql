
-- Script de inicialización para la base de datos de AgroBridge
-- Se ejecuta automáticamente por Docker Compose al crear el contenedor de la BD.

-- Crear un ENUM para los roles de usuario para mayor integridad de datos
CREATE TYPE user_role AS ENUM ('producer', 'buyer', 'auditor', 'admin');

-- Crear la tabla de usuarios
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Crear la tabla de lotes para el marketplace
CREATE TABLE lots (
    id SERIAL PRIMARY KEY,
    producer_id INT NOT NULL REFERENCES users(id),
    product_type VARCHAR(100) NOT NULL,
    quantity_kg INT NOT NULL,
    price_per_kg DECIMAL(10, 2) NOT NULL,
    origin_country_code VARCHAR(2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'available', -- available, sold, shipped
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Crear la tabla de pedidos
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    lot_id INT NOT NULL REFERENCES lots(id),
    buyer_id INT NOT NULL REFERENCES users(id),
    quantity_kg INT NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, confirmed, shipped, delivered
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Crear un índice en el nombre de usuario para acelerar las búsquedas
CREATE INDEX idx_users_username ON users(username);

-- (Opcional) Insertar un usuario administrador por defecto
-- La contraseña es 'adminpass'
INSERT INTO users (username, password, role) VALUES ('admin', '$2a$10$f.' || 'Z3i/i6.OKnJ4vN.VL3h/WJcIaXf1a3i5.O/D.wz.Zz.a.a', 'admin');

-- Crear la tabla de bloques para persistir la blockchain
CREATE TABLE blocks (
    id SERIAL PRIMARY KEY,
    hash VARCHAR(64) UNIQUE NOT NULL,
    previous_hash VARCHAR(64) NOT NULL,
    "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL,
    nonce INT NOT NULL,
    transactions JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Crear un índice en el hash para búsquedas rápidas
CREATE INDEX idx_blocks_hash ON blocks(hash);

