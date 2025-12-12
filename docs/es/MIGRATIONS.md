# Guía de Migraciones y Mantenimiento

> 🇺🇸 **[Read this in English](../en/MIGRATIONS.md)**

> **Audiencia:** Ingenieros Backend, DevOps, SRE
> **Objetivo:** Proporcionar un procedimiento operativo estándar (SOP) para actualizar dependencias de software y gestionar cambios en el esquema de base de datos de forma segura y predecible.

## 1. Migraciones de Base de Datos (Prisma)

Las migraciones de base de datos son una forma de gestionar cambios incrementales y reversibles en el esquema de nuestra base de datos. Cada vez que cambiamos el modelo de datos (por ejemplo, al añadir un campo a `User`), creamos un archivo de "migración" que contiene las instrucciones específicas (código SQL) para aplicar ese cambio.

> **Para Stakeholders No Técnicos: Una Analogía para las Migraciones**
> Imagine que nuestra base de datos es un gran edificio cuidadosamente construido.
> *   El **esquema** (`schema.prisma`) es el plano oficial del edificio.
> *   Cuando necesitamos hacer un cambio, como añadir una nueva habitación, primero actualizamos el **plano**.
> *   Luego, escribimos una **migración**, que es un conjunto de instrucciones paso a paso para el equipo de construcción sobre cómo construir esa nueva habitación sin derribar el resto del edificio.
> Este proceso asegura que cada cambio sea planificado, documentado y pueda aplicarse de manera consistente en todas partes.

### 1.1. Flujo de Trabajo en Desarrollo

1.  **Modificar el Plano:** Edite el archivo `apps/api/src/infrastructure/database/prisma/schema.prisma` con los cambios deseados.
2.  **Generar Instrucciones de Migración:** Desde el directorio `apps/api`, ejecute:
    ```bash
    pnpm prisma migrate dev --name <nombre-descriptivo-de-la-migracion>
    ```
    *   **¿Qué hace este comando?:** Prisma compara su esquema actualizado con la base de datos de desarrollo. Utiliza una "base de datos sombra" temporal para detectar posibles problemas. Luego, genera un nuevo archivo SQL en la carpeta `prisma/migrations` con los pasos exactos y lo aplica a su base de datos local.

### 1.2. Flujo de Trabajo en Producción y Mejores Prácticas

*   **Mejor Práctica: Migraciones "Forward-Only" y No Destructivas.** Debemos evitar cambios "destructivos" (como eliminar una columna) en las migraciones de producción. En su lugar, es preferible un proceso de varios pasos (por ejemplo, desplegar código que deja de usar la columna, y luego desplegar una migración para eliminarla).
*   **Aplicar Migraciones en Producción:** En un pipeline de CI/CD, se utiliza el siguiente comando para aplicar todas las migraciones pendientes de forma segura:
    ```bash
    pnpm prisma migrate deploy
    ```
    Este comando no es interactivo y no pedirá confirmación, lo que lo hace seguro para la automatización. Aplica las migraciones que han sido confirmadas en el control de versiones pero que aún no se han ejecutado en la base de datos de producción.

### 1.3. FAQ: ¿Cómo revertimos una migración fallida?
*   Prisma no admite reversiones automáticas para migraciones de producción fallidas, ya que esto puede ser peligroso. La mejor práctica es **restaurar la base de datos desde la copia de seguridad** realizada justo antes del despliegue (ver `BACKUP.md`) y luego corregir el archivo de migración defectuoso en una nueva versión.

## 2. Actualizaciones de Dependencias de Software

### 2.1. Comprobar Paquetes Desactualizados
Desde la raíz del proyecto, ejecute `pnpm outdated` para ver una lista de dependencias que tienen nuevas versiones disponibles.

### 2.2. Flujo de Trabajo de Actualización Segura (Checklist)
1.  [ ] **Aislar Cambios:** Cree una nueva rama de feature (`git checkout -b feat/update-dependencies`).
2.  [ ] **Actualizar:** Ejecute `pnpm up <package-name>` para actualizar paquetes específicos. Para una actualización de versión mayor (MAJOR), lea las notas de la versión del paquete en busca de cambios disruptivos.
3.  [ ] **Verificar:** Ejecute la suite de pruebas completa (`pnpm test`) para detectar cualquier regresión.
4.  [ ] **Revisar:** Abra un Pull Request para revisión por pares. Los cambios en el lockfile (`pnpm-lock.yaml`) deben ser parte de esta revisión.
5.  [ ] **Fusionar (Merge):** Fusionar solo después de que todas las verificaciones y aprobaciones estén completas.
