import LedgerService from '../services/LedgerService.js';
import logger from '../utils/logger.js';

class AgroBridgeAPI {
    constructor() {
        this.ledger = LedgerService;
        this.apiVersion = 'v3'; // Versión de API actualizada
        this.initializeAPI();
    }

    initializeAPI() {
        logger.info(
            `🌱 Agro Bridge API ${this.apiVersion} inicializada con LedgerService.`
        );
    }

    // ==================== ENDPOINTS PRINCIPALES (Refactorizados) ====================

    async registerLote(loteData) {
        try {
            logger.info(`Registrando lote: ${loteData.loteID}`);
            const validationErrors = this._validateLoteData(loteData);
            if (validationErrors.length > 0) {
                throw new Error(
                    `Datos de lote inválidos: ${validationErrors.join(', ')}`
                );
            }

            const result = await this.ledger.recordLote(loteData);
            if (!result.success) {
                throw new Error('Falló la escritura en el libro mayor.');
            }

            logger.info(
                `✅ Lote ${loteData.loteID} registrado exitosamente en el libro mayor.`,
                {
                    documentId: result.documentId,
                }
            );

            return { success: true, ...result };
        } catch (error) {
            logger.error(`❌ Error registrando lote ${loteData?.loteID}`, {
                error: error.message,
            });
            return { success: false, error: error.message };
        }
    }

    async findLoteById(loteId) {
        try {
            if (!loteId || typeof loteId !== 'string') {
                throw new Error('ID de lote inválido');
            }

            const loteData = await this.ledger.findLoteById(loteId);

            if (loteData) {
                logger.info(`Lote encontrado con ID: ${loteId}`);
                return { success: true, loteData, status: 'CONFIRMED' };
            } else {
                logger.warn(`Lote no encontrado con ID: ${loteId}`);
                return {
                    success: false,
                    message: 'Lote no encontrado',
                    status: 'NOT_FOUND',
                };
            }
        } catch (error) {
            logger.error(`❌ Error buscando lote por ID: ${loteId}`, {
                error: error.message,
            });
            return { success: false, error: error.message };
        }
    }

    // ==================== MÉTODOS DE APOYO ====================

    _validateLoteData(loteData) {
        const errors = [];
        if (!loteData.loteID) errors.push('loteID es requerido');
        if (!loteData.huertoOrigen) errors.push('huertoOrigen es requerido');
        return errors;
    }
}

export default AgroBridgeAPI;
