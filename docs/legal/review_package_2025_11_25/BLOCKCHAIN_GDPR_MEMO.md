# MEMORÁNDUM TÉCNICO: Blockchain & GDPR

**Fecha:** 2025-11-25
**Asunto:** Limitaciones Tecnológicas de "Derecho al Olvido" en AgroBridge Protocol

## 1. Arquitectura Inmutable
La plataforma utiliza una red blockchain (EVM compatible) para garantizar la trazabilidad. Por diseño, los registros en la cadena de bloques son:
*   **Inmutables:** No se pueden modificar ni borrar.
*   **Distribuidos:** Existen copias en múltiples nodos.

## 2. Conflicto con GDPR (Art. 17 - Right to Erasure)
El "Derecho al Olvido" exige la eliminación de datos personales. Esto es técnicamente imposible en la capa de blockchain para las transacciones ya confirmadas.

## 3. Estrategia de Mitigación (Pseudonimización)
Para cumplir con la normativa, implementamos:
*   **Separación de Datos:** Los datos personales (PII) como nombres, direcciones y teléfonos NUNCA se escriben en la blockchain. Se almacenan en una base de datos SQL tradicional (Neon/PostgreSQL) que sí permite borrado ("Off-chain storage").
*   **Referencias Hash:** En la blockchain solo se escribe un hash criptográfico (SHA-256) que vincula al lote con el productor, sin revelar su identidad públicamente.

## 4. Cláusula de Responsabilidad Requerida
Se solicita al equipo legal redactar una cláusula donde el usuario acepte que:
*"La inmutabilidad es una característica esencial del servicio de certificación. Al solicitar un certificado blockchain, el usuario entiende que el rastro criptográfico de la transacción será permanente, aunque sus datos personales off-chain sean eliminados."*
