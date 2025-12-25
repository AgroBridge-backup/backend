'use client';

import {
  Truck,
  Thermometer,
  Fingerprint,
  Satellite,
  FileCheck,
  Check,
  X,
  AlertTriangle,
} from 'lucide-react';

interface DataCardsProps {
  transit: {
    status: string;
    origin: string;
    destination: string;
    currentLocation: { lat: number; lng: number } | null;
    estimatedArrival: string | null;
    distanceTraveled: number | null;
    totalDistance: number | null;
  } | null;
  coldChain: {
    status: string;
    avgTemperature: number;
    minTemperature: number;
    maxTemperature: number;
    targetRange: { min: number; max: number };
    excursions: number;
    readings: number;
  } | null;
  sealStatus: {
    isIntact: boolean;
    serialNumber: string;
    verifiedAt: string | null;
    signatureValid: boolean;
  } | null;
  fieldHealth: {
    ndviScore: number | null;
    healthStatus: string;
    lastImageDate: string | null;
    thumbnailUrl: string | null;
  } | null;
  certificate: {
    type: string;
    issuedAt: string;
    isValid: boolean;
    publicUrl: string | null;
    qualityGrade: string | null;
  } | null;
}

export function DataCards({ transit, coldChain, sealStatus, fieldHealth, certificate }: DataCardsProps) {
  const hasData = transit || coldChain || sealStatus || fieldHealth || certificate;

  if (!hasData) {
    return (
      <div className="card p-6 text-center text-neutral-500">
        <p>No additional traceability data available yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Transit Card */}
      {transit && (
        <div className="card p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-medium text-neutral-900">Transit Tracking</h3>
              <p className="text-sm text-neutral-500 capitalize">{transit.status.toLowerCase().replace('_', ' ')}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-neutral-500">From</span>
              <p className="font-medium">{transit.origin}</p>
            </div>
            <div>
              <span className="text-neutral-500">To</span>
              <p className="font-medium">{transit.destination}</p>
            </div>
            {transit.distanceTraveled && transit.totalDistance && (
              <div className="col-span-2">
                <div className="h-2 w-full rounded-full bg-neutral-100">
                  <div
                    className="h-2 rounded-full bg-blue-500"
                    style={{ width: `${(transit.distanceTraveled / transit.totalDistance) * 100}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-neutral-500">
                  {transit.distanceTraveled.toFixed(0)} / {transit.totalDistance.toFixed(0)} km
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cold Chain Card */}
      {coldChain && (
        <div className="card p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
              coldChain.excursions === 0 ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'
            }`}>
              <Thermometer className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-medium text-neutral-900">Cold Chain</h3>
              <p className="text-sm text-neutral-500">
                {coldChain.excursions === 0 ? 'No temperature excursions' : `${coldChain.excursions} excursions detected`}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between bg-neutral-50 rounded-lg p-3">
            <div className="text-center">
              <p className="text-2xl font-bold text-neutral-900">{coldChain.avgTemperature.toFixed(1)}°C</p>
              <p className="text-xs text-neutral-500">Average</p>
            </div>
            <div className="h-8 w-px bg-neutral-200" />
            <div className="text-center">
              <p className="text-sm font-medium text-neutral-700">{coldChain.minTemperature.toFixed(1)}°C - {coldChain.maxTemperature.toFixed(1)}°C</p>
              <p className="text-xs text-neutral-500">Range</p>
            </div>
            <div className="h-8 w-px bg-neutral-200" />
            <div className="text-center">
              <p className="text-sm font-medium text-neutral-700">{coldChain.readings}</p>
              <p className="text-xs text-neutral-500">Readings</p>
            </div>
          </div>
        </div>
      )}

      {/* NFC Seal Card */}
      {sealStatus && (
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
              sealStatus.isIntact ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
            }`}>
              <Fingerprint className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-neutral-900">Tamper-Evident Seal</h3>
              <p className="text-sm text-neutral-500">SN: {sealStatus.serialNumber}</p>
            </div>
            <div className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium ${
              sealStatus.isIntact
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}>
              {sealStatus.isIntact ? (
                <>
                  <Check className="h-4 w-4" />
                  Intact
                </>
              ) : (
                <>
                  <X className="h-4 w-4" />
                  Broken
                </>
              )}
            </div>
          </div>
          {sealStatus.signatureValid && (
            <div className="mt-2 text-xs text-green-600">
              Cryptographic signature verified
            </div>
          )}
        </div>
      )}

      {/* Field Health Card */}
      {fieldHealth && (
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 text-purple-600">
              <Satellite className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-neutral-900">Field Health</h3>
              <p className="text-sm text-neutral-500 capitalize">{fieldHealth.healthStatus.toLowerCase().replace('_', ' ')}</p>
            </div>
            {fieldHealth.ndviScore !== null && (
              <div className="text-right">
                <p className="text-lg font-bold text-neutral-900">{(fieldHealth.ndviScore * 100).toFixed(0)}%</p>
                <p className="text-xs text-neutral-500">NDVI</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Certificate Card */}
      {certificate && (
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
              certificate.isValid ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'
            }`}>
              <FileCheck className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-neutral-900">{certificate.type}</h3>
              {certificate.qualityGrade && (
                <p className="text-sm text-neutral-500">Grade: {certificate.qualityGrade}</p>
              )}
            </div>
            {certificate.isValid ? (
              <span className="badge badge-verified">
                <Check className="h-3 w-3" />
                Valid
              </span>
            ) : (
              <span className="badge badge-warning">
                <AlertTriangle className="h-3 w-3" />
                Expired
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
