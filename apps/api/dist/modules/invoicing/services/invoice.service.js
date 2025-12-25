import { PrismaClient, InvoiceStatus } from '@prisma/client';
import { ethers } from 'ethers';
import crypto from 'crypto';
import { logger } from '../../../infrastructure/logging/logger.js';
import { blockchainNotificationService } from '../../whatsapp-bot/services/blockchain-notification.service.js';
const prisma = new PrismaClient();
const config = {
    facturama: {
        baseUrl: process.env.FACTURAMA_API_URL || 'https://apisandbox.facturama.mx',
        user: process.env.FACTURAMA_USER || '',
        password: process.env.FACTURAMA_PASSWORD || '',
    },
    blockchain: {
        enabled: process.env.BLOCKCHAIN_ENABLED === 'true',
        rpcUrl: process.env.BLOCKCHAIN_RPC_URL || 'https://polygon-rpc.com',
        contractAddress: process.env.INVOICE_REGISTRY_CONTRACT || '',
        privateKey: process.env.BLOCKCHAIN_PRIVATE_KEY || '',
        network: 'polygon',
        explorerUrl: 'https://polygonscan.com',
    },
    storage: {
        s3Bucket: process.env.S3_BUCKET || 'agrobridge-invoices',
        baseUrl: process.env.S3_BASE_URL || 'https://s3.amazonaws.com',
    },
};
export class InvoiceService {
    provider = null;
    wallet = null;
    constructor() {
        if (config.blockchain.enabled && config.blockchain.privateKey) {
            this.initializeBlockchain();
        }
    }
    async initializeBlockchain() {
        try {
            this.provider = new ethers.providers.JsonRpcProvider(config.blockchain.rpcUrl);
            this.wallet = new ethers.Wallet(config.blockchain.privateKey, this.provider);
            logger.info('Invoice blockchain service initialized');
        }
        catch (error) {
            logger.error('Failed to initialize blockchain for invoicing', { error });
        }
    }
    async generateCFDI(request) {
        try {
            const subtotal = request.lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
            const ivaRate = 0.16;
            const iva = subtotal * ivaRate;
            const total = subtotal + iva;
            const folio = await this.generateFolio();
            const invoice = await prisma.invoice.create({
                data: {
                    userId: request.userId,
                    producerId: request.producerId,
                    batchId: request.batchId,
                    folio,
                    uuid: '',
                    subtotal,
                    iva,
                    ivaRate,
                    total,
                    currency: request.currency || 'MXN',
                    recipientRfc: request.recipientRfc,
                    recipientName: request.recipientName,
                    recipientEmail: request.recipientEmail,
                    notes: request.notes,
                    status: InvoiceStatus.PENDING,
                },
            });
            const cfdiResponse = await this.callFacturamaAPI(request, folio);
            const invoiceHash = this.calculateInvoiceHash({
                folio: cfdiResponse.Folio,
                uuid: cfdiResponse.Complement.TaxStamp.Uuid,
                total,
                recipientRfc: request.recipientRfc,
                timestamp: new Date().toISOString(),
            });
            let blockchainTx = null;
            if (config.blockchain.enabled && this.wallet) {
                blockchainTx = await this.registerInvoiceOnBlockchain(cfdiResponse.Complement.TaxStamp.Uuid, invoiceHash, total);
            }
            const qrCodeUrl = await this.generateDualVerificationQR(cfdiResponse.Complement.TaxStamp.Uuid, invoiceHash);
            const updatedInvoice = await prisma.invoice.update({
                where: { id: invoice.id },
                data: {
                    uuid: cfdiResponse.Complement.TaxStamp.Uuid,
                    pdfUrl: cfdiResponse.CfdiPdf,
                    xmlUrl: cfdiResponse.CfdiXml,
                    qrCodeUrl,
                    cfdiSeal: cfdiResponse.Complement.TaxStamp.SatSeal,
                    satSeal: cfdiResponse.Complement.TaxStamp.SatSeal,
                    satCertNumber: cfdiResponse.Complement.TaxStamp.NoCertificadoSat,
                    stampDate: new Date(cfdiResponse.Complement.TaxStamp.FechaTimbrado),
                    blockchainHash: invoiceHash,
                    blockchainTxHash: blockchainTx?.transactionHash || null,
                    blockchainNetwork: config.blockchain.network,
                    blockchainVerified: !!blockchainTx,
                    blockchainTimestamp: blockchainTx ? new Date() : null,
                    status: blockchainTx ? InvoiceStatus.VERIFIED : InvoiceStatus.ISSUED,
                    issuedAt: new Date(),
                },
            });
            await this.sendInvoiceNotification(updatedInvoice, request.userId);
            logger.info('Invoice generated successfully', {
                invoiceId: invoice.id,
                folio,
                uuid: cfdiResponse.Complement.TaxStamp.Uuid,
                blockchainVerified: !!blockchainTx,
            });
            return {
                success: true,
                invoice: {
                    id: updatedInvoice.id,
                    folio: updatedInvoice.folio,
                    uuid: updatedInvoice.uuid,
                    total: Number(updatedInvoice.total),
                    pdfUrl: updatedInvoice.pdfUrl || '',
                    xmlUrl: updatedInvoice.xmlUrl || '',
                    qrCodeUrl: updatedInvoice.qrCodeUrl || '',
                    blockchainHash: updatedInvoice.blockchainHash || undefined,
                    blockchainTxHash: updatedInvoice.blockchainTxHash || undefined,
                    verificationUrl: `${process.env.VERIFY_BASE_URL || 'https://verify.agrobridge.io'}/invoice/${updatedInvoice.uuid}`,
                },
            };
        }
        catch (error) {
            logger.error('Invoice generation failed', { error, request });
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
    async callFacturamaAPI(request, folio) {
        const cfdiRequest = {
            Folio: folio,
            Serie: 'A',
            CfdiType: 'I',
            PaymentForm: request.paymentMethod || '99',
            PaymentMethod: 'PUE',
            Currency: request.currency || 'MXN',
            Receiver: {
                Rfc: request.recipientRfc,
                Name: request.recipientName,
                CfdiUse: 'G03',
                FiscalRegime: '601',
                TaxZipCode: '06600',
            },
            Items: request.lineItems.map((item) => ({
                ProductCode: item.productKey,
                Description: item.description,
                Unit: item.unit,
                UnitCode: item.unit === 'KGM' ? 'KGM' : 'E48',
                Quantity: item.quantity,
                UnitPrice: item.unitPrice,
                Subtotal: item.quantity * item.unitPrice,
                Total: item.quantity * item.unitPrice * 1.16,
                Taxes: [
                    {
                        Name: 'IVA',
                        Rate: 0.16,
                        Total: item.quantity * item.unitPrice * 0.16,
                        Base: item.quantity * item.unitPrice,
                        IsRetention: false,
                    },
                ],
            })),
        };
        if (process.env.NODE_ENV !== 'production' || !config.facturama.user) {
            return this.mockFacturamaResponse(folio, request);
        }
        const auth = Buffer.from(`${config.facturama.user}:${config.facturama.password}`).toString('base64');
        const response = await fetch(`${config.facturama.baseUrl}/3/cfdis`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(cfdiRequest),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Facturama API error: ${JSON.stringify(errorData)}`);
        }
        return response.json();
    }
    mockFacturamaResponse(folio, request) {
        const uuid = crypto.randomUUID();
        const subtotal = request.lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
        return {
            Folio: folio,
            Complement: {
                TaxStamp: {
                    Uuid: uuid,
                    SatSeal: `MOCK_SAT_SEAL_${Date.now()}`,
                    NoCertificadoSat: '00001000000504465028',
                    FechaTimbrado: new Date().toISOString(),
                },
            },
            CfdiPdf: `${config.storage.baseUrl}/${config.storage.s3Bucket}/invoices/${uuid}.pdf`,
            CfdiXml: `${config.storage.baseUrl}/${config.storage.s3Bucket}/invoices/${uuid}.xml`,
            Total: subtotal * 1.16,
        };
    }
    calculateInvoiceHash(data) {
        const content = JSON.stringify(data, Object.keys(data).sort());
        return '0x' + crypto.createHash('sha256').update(content).digest('hex');
    }
    async registerInvoiceOnBlockchain(uuid, hash, amount) {
        if (!this.wallet || !config.blockchain.contractAddress) {
            logger.warn('Blockchain not configured for invoice registration');
            return null;
        }
        try {
            const abi = [
                'function registerInvoice(string uuid, bytes32 hash, uint256 amount) public',
                'event InvoiceRegistered(string indexed uuid, bytes32 hash, uint256 amount, uint256 timestamp)',
            ];
            const contract = new ethers.Contract(config.blockchain.contractAddress, abi, this.wallet);
            const tx = await contract.registerInvoice(uuid, hash, ethers.utils.parseUnits(amount.toString(), 2));
            const receipt = await tx.wait();
            logger.info('Invoice registered on blockchain', {
                uuid,
                txHash: receipt.transactionHash,
                blockNumber: receipt.blockNumber,
            });
            return { transactionHash: receipt.transactionHash };
        }
        catch (error) {
            logger.error('Failed to register invoice on blockchain', { error, uuid });
            return null;
        }
    }
    async verifyInvoiceOnBlockchain(uuid) {
        if (!this.provider || !config.blockchain.contractAddress) {
            return { verified: false, error: 'Blockchain not configured' };
        }
        try {
            const abi = [
                'function getInvoice(string uuid) view returns (bytes32 hash, uint256 amount, uint256 timestamp)',
            ];
            const contract = new ethers.Contract(config.blockchain.contractAddress, abi, this.provider);
            const result = await contract.getInvoice(uuid);
            if (result.hash === ethers.constants.HashZero) {
                return { verified: false, error: 'Invoice not found on blockchain' };
            }
            return {
                verified: true,
                onChainHash: result.hash,
                registeredAt: new Date(result.timestamp.toNumber() * 1000),
            };
        }
        catch (error) {
            logger.error('Failed to verify invoice on blockchain', { error, uuid });
            return { verified: false, error: 'Verification failed' };
        }
    }
    async generateDualVerificationQR(uuid, blockchainHash) {
        const verificationData = {
            sat: `https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id=${uuid}`,
            blockchain: `https://verify.agrobridge.io/invoice/${uuid}`,
            type: 'DUAL_VERIFICATION',
            hash: blockchainHash.substring(0, 16),
        };
        const encoded = Buffer.from(JSON.stringify(verificationData)).toString('base64');
        return `https://api.agrobridge.io/qr/invoice/${uuid}?data=${encoded}`;
    }
    async sendInvoiceNotification(invoice, userId) {
        try {
            const phoneNumber = await blockchainNotificationService.getUserPhoneNumber(userId);
            if (!phoneNumber) {
                logger.info('No WhatsApp number for invoice notification', { userId });
                return;
            }
            await blockchainNotificationService.sendInvoiceWithBlockchainNotification({
                folio: invoice.folio,
                uuid: invoice.uuid,
                total: Number(invoice.total),
                blockchainHash: invoice.blockchainHash || '',
                pdfUrl: invoice.pdfUrl || '',
            }, phoneNumber);
        }
        catch (error) {
            logger.error('Failed to send invoice notification', { error, userId });
        }
    }
    async generateFolio() {
        const year = new Date().getFullYear();
        const count = await prisma.invoice.count({
            where: {
                createdAt: {
                    gte: new Date(`${year}-01-01`),
                },
            },
        });
        return `AB-${year}-${String(count + 1).padStart(6, '0')}`;
    }
    async getInvoiceById(id) {
        return prisma.invoice.findUnique({
            where: { id },
        });
    }
    async getInvoiceByUuid(uuid) {
        return prisma.invoice.findUnique({
            where: { uuid },
        });
    }
    async listInvoices(userId, options) {
        return prisma.invoice.findMany({
            where: {
                userId,
                ...(options?.status && { status: options.status }),
            },
            orderBy: { createdAt: 'desc' },
            take: options?.limit || 50,
            skip: options?.offset || 0,
        });
    }
    async cancelInvoice(id, reason) {
        try {
            const invoice = await prisma.invoice.findUnique({ where: { id } });
            if (!invoice)
                return false;
            await prisma.invoice.update({
                where: { id },
                data: {
                    status: InvoiceStatus.CANCELLED,
                    cancelledAt: new Date(),
                    cancellationReason: reason,
                },
            });
            logger.info('Invoice cancelled', { id, reason });
            return true;
        }
        catch (error) {
            logger.error('Failed to cancel invoice', { error, id });
            return false;
        }
    }
}
export const invoiceService = new InvoiceService();
