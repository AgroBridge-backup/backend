import logger from '../../shared/utils/logger.js';
export class IPFSService {
    async uploadFiles(files) {
        logger.info({ message: 'Uploading files to IPFS (dummy)', meta: { files: files.map(f => f.filename) } });
        return files.map((f, i) => `QmHash${i}`);
    }
    async uploadJSON(name, object) {
        logger.info({ message: `Uploading JSON to IPFS (dummy): ${name}`, meta: { object } });
        return `QmJSONHash${name}`;
    }
    getGatewayUrl(ipfsHash) {
        logger.info({ message: 'Getting IPFS file URL (dummy)', meta: { ipfsHash } });
        return `https://ipfs.io/ipfs/${ipfsHash}`;
    }
    async pinFile(ipfsHash) {
        logger.info({ message: 'Pinning IPFS file (dummy)', meta: { ipfsHash } });
    }
}
