/**
 * QR Scanner Simulation Component
 * Allows users to simulate scanning a QR code by entering a lot code
 */

import { useState, useRef, useEffect } from 'react';
import { QrCode, Search } from 'lucide-react';

interface QrScannerProps {
  onScan: (lotCode: string) => void;
}

export function QrScanner({ onScan }: QrScannerProps) {
  const [code, setCode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleSimulateScan = () => {
    const sanitizedCode = code.trim();
    if (!sanitizedCode) return;

    setIsScanning(true);

    // Simulate scanning delay
    timeoutRef.current = setTimeout(() => {
      onScan(sanitizedCode);
      setIsScanning(false);
      setCode(''); // Clear input after successful scan
    }, 500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSimulateScan();
    }
  };

  return (
    <div className="bg-surface-elevated border border-surface-border rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <QrCode className="w-6 h-6 text-primary-400" aria-hidden="true" />
        <h2 className="text-white text-xl font-bold">Simulador de Escaneo QR</h2>
      </div>

      <p className="text-gray-400 text-sm mb-4">
        Ingresa el código de un lote para simular el escaneo de su código QR y ver su trazabilidad completa.
      </p>

      <div className="space-y-3">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ej: AVT-2024-001 o lote-001"
            aria-label="Código de lote para escanear"
            aria-describedby="qr-hint"
            autoFocus
            className="w-full pl-10 pr-4 py-3 bg-surface-muted border border-surface-border rounded-lg text-white placeholder-gray-400 focus:border-primary-500/50 focus:outline-none transition-colors"
            disabled={isScanning}
          />
        </div>

        <button
          type="button"
          onClick={handleSimulateScan}
          disabled={!code.trim() || isScanning}
          aria-label={isScanning ? 'Escaneando código QR' : 'Simular escaneo de código QR'}
          className="w-full px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isScanning ? (
            <>
              <div
                className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"
                role="status"
                aria-label="Escaneando"
              />
              Escaneando...
            </>
          ) : (
            <>
              <QrCode className="w-5 h-5" aria-hidden="true" />
              Simular Escaneo
            </>
          )}
        </button>
      </div>

      <div className="mt-4 pt-4 border-t border-surface-border">
        <p id="qr-hint" className="text-gray-500 text-xs">
          💡 Prueba con códigos como: AVT-2024-001, FRS-2024-001, o lote-001
        </p>
      </div>
    </div>
  );
}
