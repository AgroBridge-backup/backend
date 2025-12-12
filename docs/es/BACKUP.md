# Respaldo, Recuperación y Continuidad del Negocio

> 🇺🇸 **[Read this in English](../en/BACKUP.md)**

> **Resumen Ejecutivo:** Este documento describe nuestra estrategia de respaldo 3-2-1 y un Plan de Continuidad del Negocio (BCP) formal para incidentes de Severidad 1. El plan se guía por nuestro principio cultural de **Resiliencia Estoica**, asegurando una respuesta calmada, ordenada y efectiva durante una crisis. Una prueba de validación trimestral obligatoria garantiza nuestra preparación técnica y refuerza nuestra mentalidad antifrágil.
>
> ---
> **Última Revisión:** 2025-11-20
> **Propietario del Documento:** Jefe de Infraestructura y SRE

## 1. Estrategia: Resiliencia y Continuidad

*   **Estrategia de Backup:** Seguimos la regla 3-2-1 con snapshots diarios, automatizados y off-site de nuestra base de datos, permitiendo una Recuperación a un Punto en el Tiempo (PITR) de ~5 minutos.
*   **Plan de Continuidad del Negocio (BCP):** En una crisis, activamos un BCP formal liderado por un Comandante del Incidente. Nuestra respuesta se guía por los principios de nuestra **[Guía de Antifragilidad y Crisis](../strategy/CULTURE_AND_LEADERSHIP.md)**, enfatizando la acción calmada y decisiva.

## 2. Flujo de Recuperación

1.  **Declaración:** Se declara un incidente. El IC reúne al equipo.
2.  **Evaluación y Comunicación:** Se evalúa el impacto. El Líder de Comunicaciones comienza a actualizar a los stakeholders a través de nuestra Statuspage.
3.  **Ejecución:** El Líder Técnico restaura la base de datos a una **nueva** instancia.
4.  **Failover (Conmutación):** Tras la validación, el tráfico se redirige al sistema restaurado.
5.  **Post-Mortem:** Se realiza un post-mortem "sin culpa" para aprender y mejorar.

## 3. Checklist de Validación de Procesos (Trimestral)

*   **[ ] Prueba de Restauración Automatizada:** Se ejecuta un script para probar que podemos restaurar el último backup y que los datos son válidos.
*   **[ ] Simulacro de BCP:** Se realiza un ejercicio de simulación de una interrupción mayor con el equipo de respuesta a incidentes para asegurar que todos los miembros conozcan sus roles y protocolos.
