/**
 * Cold Chain Service
 *
 * Business logic for IoT-enabled cold chain monitoring and quality verification.
 * Handles sensor management, session tracking, breach detection, and compliance scoring.
 *
 * @module ColdChainService
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { addMinutes, differenceInMinutes } from 'date-fns';
import { AppError } from '../../shared/errors/AppError.js';
import logger from '../../shared/utils/logger.js';
import {
  CropType,
  SessionType,
  ColdChainSessionStatus,
  QualityGradeType,
  BreachType,
  BreachSeverity,
  AlertType,
  AlertSeverity,
  SensorStatus,
  COLD_CHAIN_THRESHOLDS,
  calculateComplianceScore,
  calculateQualityGrade,
  calculateBreachSeverity,
  isTemperatureCompliant,
  isHumidityCompliant,
} from '../entities/SmartColdChain.js';

// ════════════════════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════════════════════

export interface CreateSensorInput {
  deviceId: string;
  deviceType: string;
  exportCompanyId: string;
  name?: string;
  manufacturer?: string;
  firmwareVersion?: string;
}

export interface StartSessionInput {
  exportCompanyId: string;
  sessionType: SessionType;
  cropType: CropType;
  sensorIds: string[];
  fieldId?: string;
  batchId?: string;
  shipmentId?: string;
  certificateId?: string;
}

export interface RecordReadingInput {
  sensorId: string;
  sessionId?: string;
  temperature: number;
  humidity?: number;
  brixLevel?: number;
  phLevel?: number;
  firmness?: number;
  batteryLevel?: number;
  gpsLat?: number;
  gpsLon?: number;
  readingTime?: Date;
}

export interface SessionMetrics {
  totalReadings: number;
  compliantReadings: number;
  complianceScore: number;
  breachCount: number;
  avgTemperature: number | null;
  minTemperature: number | null;
  maxTemperature: number | null;
  avgHumidity: number | null;
  avgBrixLevel: number | null;
  avgPhLevel: number | null;
  qualityGrade: QualityGradeType | null;
}

// ════════════════════════════════════════════════════════════════════════════════
// SERVICE
// ════════════════════════════════════════════════════════════════════════════════

export class ColdChainService {
  constructor(private readonly prisma: PrismaClient) {}

  // ══════════════════════════════════════════════════════════════════════════════
  // SENSOR MANAGEMENT
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * Register a new IoT sensor
   */
  async registerSensor(input: CreateSensorInput) {
    // Check if sensor already exists
    const existing = await this.prisma.ioTSensor.findUnique({
      where: { deviceId: input.deviceId },
    });

    if (existing) {
      throw new AppError(`Sensor with device ID ${input.deviceId} already exists`, 409);
    }

    // Verify export company exists
    const company = await this.prisma.exportCompany.findUnique({
      where: { id: input.exportCompanyId },
    });

    if (!company) {
      throw new AppError('Export company not found', 404);
    }

    const sensor = await this.prisma.ioTSensor.create({
      data: {
        deviceId: input.deviceId,
        deviceType: input.deviceType,
        exportCompanyId: input.exportCompanyId,
        name: input.name,
        manufacturer: input.manufacturer,
        firmwareVersion: input.firmwareVersion,
        status: 'ACTIVE',
      },
    });

    logger.info('[ColdChain] Sensor registered', {
      sensorId: sensor.id,
      deviceId: sensor.deviceId,
      companyId: input.exportCompanyId,
    });

    return sensor;
  }

  /**
   * Get sensor by ID
   */
  async getSensor(id: string) {
    const sensor = await this.prisma.ioTSensor.findUnique({
      where: { id },
      include: {
        exportCompany: {
          select: { id: true, name: true },
        },
      },
    });

    if (!sensor) {
      throw new AppError('Sensor not found', 404);
    }

    return sensor;
  }

  /**
   * List sensors for an export company
   */
  async listSensors(exportCompanyId: string, options?: {
    status?: string;
    assignedType?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: Prisma.IoTSensorWhereInput = { exportCompanyId };

    if (options?.status) {
      where.status = options.status as any;
    }
    if (options?.assignedType) {
      where.assignedType = options.assignedType;
    }

    const [sensors, total] = await Promise.all([
      this.prisma.ioTSensor.findMany({
        where,
        take: options?.limit || 50,
        skip: options?.offset || 0,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.ioTSensor.count({ where }),
    ]);

    return { sensors, total };
  }

  /**
   * Assign sensor to a field, batch, or shipment
   */
  async assignSensor(sensorId: string, assignedTo: string, assignedType: 'FIELD' | 'BATCH' | 'SHIPMENT' | 'STORAGE') {
    const sensor = await this.prisma.ioTSensor.update({
      where: { id: sensorId },
      data: {
        assignedTo,
        assignedType,
      },
    });

    logger.info('[ColdChain] Sensor assigned', {
      sensorId,
      assignedTo,
      assignedType,
    });

    return sensor;
  }

  /**
   * Update sensor status
   */
  async updateSensorStatus(sensorId: string, status: SensorStatus) {
    return this.prisma.ioTSensor.update({
      where: { id: sensorId },
      data: { status },
    });
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // SESSION MANAGEMENT
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * Start a new cold chain monitoring session
   */
  async startSession(input: StartSessionInput) {
    // Get crop-specific thresholds
    const thresholds = COLD_CHAIN_THRESHOLDS[input.cropType];

    if (!thresholds) {
      throw new AppError(`Unknown crop type: ${input.cropType}`, 400);
    }

    // Verify all sensors exist and belong to the company
    const sensors = await this.prisma.ioTSensor.findMany({
      where: {
        id: { in: input.sensorIds },
        exportCompanyId: input.exportCompanyId,
      },
    });

    if (sensors.length !== input.sensorIds.length) {
      throw new AppError('One or more sensors not found or not owned by company', 400);
    }

    // Create session
    const session = await this.prisma.coldChainSession.create({
      data: {
        sessionType: input.sessionType,
        exportCompanyId: input.exportCompanyId,
        fieldId: input.fieldId,
        batchId: input.batchId,
        shipmentId: input.shipmentId,
        certificateId: input.certificateId,
        cropType: input.cropType,
        minTemperature: thresholds.minTemp,
        maxTemperature: thresholds.maxTemp,
        targetHumidity: thresholds.targetHumidity,
        startTime: new Date(),
        status: 'ACTIVE',
        sensors: {
          connect: input.sensorIds.map(id => ({ id })),
        },
      },
      include: {
        sensors: true,
      },
    });

    logger.info('[ColdChain] Session started', {
      sessionId: session.id,
      sessionType: input.sessionType,
      cropType: input.cropType,
      sensorCount: input.sensorIds.length,
    });

    return session;
  }

  /**
   * Get session by ID
   */
  async getSession(id: string) {
    const session = await this.prisma.coldChainSession.findUnique({
      where: { id },
      include: {
        sensors: true,
        breaches: {
          orderBy: { startTime: 'desc' },
          take: 10,
        },
        alerts: {
          orderBy: { timestamp: 'desc' },
          take: 10,
        },
        _count: {
          select: { readings: true },
        },
      },
    });

    if (!session) {
      throw new AppError('Session not found', 404);
    }

    return session;
  }

  /**
   * List sessions for an export company
   */
  async listSessions(exportCompanyId: string, options?: {
    status?: string;
    sessionType?: string;
    cropType?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: Prisma.ColdChainSessionWhereInput = { exportCompanyId };

    if (options?.status) {
      where.status = options.status as any;
    }
    if (options?.sessionType) {
      where.sessionType = options.sessionType as any;
    }
    if (options?.cropType) {
      where.cropType = options.cropType as any;
    }

    const [sessions, total] = await Promise.all([
      this.prisma.coldChainSession.findMany({
        where,
        take: options?.limit || 20,
        skip: options?.offset || 0,
        orderBy: { startTime: 'desc' },
        include: {
          sensors: { select: { id: true, deviceId: true, name: true } },
          _count: { select: { readings: true, breaches: true } },
        },
      }),
      this.prisma.coldChainSession.count({ where }),
    ]);

    return { sessions, total };
  }

  /**
   * End a cold chain session
   */
  async endSession(sessionId: string): Promise<void> {
    const session = await this.prisma.coldChainSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new AppError('Session not found', 404);
    }

    if (session.status !== 'ACTIVE') {
      throw new AppError('Session is not active', 400);
    }

    const durationMinutes = differenceInMinutes(new Date(), session.startTime);

    // Update final metrics
    await this.updateSessionMetrics(sessionId);

    // Get final session data
    const finalSession = await this.prisma.coldChainSession.findUnique({
      where: { id: sessionId },
    });

    // Determine final status based on compliance score
    let finalStatus: ColdChainSessionStatus = ColdChainSessionStatus.COMPLETED;
    if (finalSession && Number(finalSession.complianceScore) < 80) {
      finalStatus = ColdChainSessionStatus.BREACHED;
    } else if (finalSession && Number(finalSession.complianceScore) < 95) {
      finalStatus = ColdChainSessionStatus.NEEDS_REVIEW;
    }

    // Close any open breaches
    await this.prisma.coldChainBreach.updateMany({
      where: {
        sessionId,
        endTime: null,
      },
      data: {
        endTime: new Date(),
      },
    });

    // Update session
    await this.prisma.coldChainSession.update({
      where: { id: sessionId },
      data: {
        endTime: new Date(),
        durationMinutes,
        status: finalStatus,
      },
    });

    logger.info('[ColdChain] Session ended', {
      sessionId,
      durationMinutes,
      finalStatus,
      complianceScore: finalSession?.complianceScore,
    });
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // READING MANAGEMENT
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * Record a sensor reading
   */
  async recordReading(input: RecordReadingInput) {
    // Get sensor
    const sensor = await this.prisma.ioTSensor.findUnique({
      where: { id: input.sensorId },
    });

    if (!sensor) {
      throw new AppError('Sensor not found', 404);
    }

    // Get session if provided
    let session = null;
    if (input.sessionId) {
      session = await this.prisma.coldChainSession.findUnique({
        where: { id: input.sessionId },
      });

      if (!session) {
        throw new AppError('Session not found', 404);
      }

      if (session.status !== 'ACTIVE') {
        throw new AppError('Session is not active', 400);
      }
    }

    // Check compliance
    const cropType = session?.cropType as CropType || CropType.AVOCADO;
    const temperatureInRange = isTemperatureCompliant(cropType, input.temperature);
    const humidityInRange = input.humidity !== undefined
      ? isHumidityCompliant(cropType, input.humidity)
      : true;

    // Calculate quality grade if Brix available
    let qualityGrade: QualityGradeType | null = null;
    if (input.brixLevel !== undefined) {
      qualityGrade = calculateQualityGrade(cropType, input.brixLevel, input.phLevel);
    }

    // Create reading
    const reading = await this.prisma.coldChainReading.create({
      data: {
        sensorId: input.sensorId,
        sessionId: input.sessionId,
        fieldId: session?.fieldId,
        batchId: session?.batchId,
        shipmentId: session?.shipmentId,
        temperature: input.temperature,
        humidity: input.humidity,
        brixLevel: input.brixLevel,
        phLevel: input.phLevel,
        firmness: input.firmness,
        batteryLevel: input.batteryLevel,
        gpsLat: input.gpsLat,
        gpsLon: input.gpsLon,
        temperatureInRange,
        humidityInRange,
        qualityGrade: qualityGrade as any,
        readingTime: input.readingTime || new Date(),
      },
    });

    // Update sensor last reading
    await this.prisma.ioTSensor.update({
      where: { id: input.sensorId },
      data: {
        lastReadingAt: new Date(),
        batteryLevel: input.batteryLevel,
        status: input.batteryLevel !== undefined && input.batteryLevel < 20 ? 'LOW_BATTERY' : 'ACTIVE',
      },
    });

    // Handle breaches and alerts
    if (session && (!temperatureInRange || !humidityInRange)) {
      await this.handleBreach(session.id, input.sensorId, {
        temperature: input.temperature,
        humidity: input.humidity,
        temperatureInRange,
        humidityInRange,
        thresholds: {
          minTemp: Number(session.minTemperature),
          maxTemp: Number(session.maxTemperature),
          targetHumidity: Number(session.targetHumidity),
        },
      });
    }

    // Check for low battery alert
    if (session && input.batteryLevel !== undefined && input.batteryLevel < 20) {
      await this.createAlert(session.id, input.sensorId, {
        alertType: AlertType.BATTERY_LOW,
        severity: input.batteryLevel < 10 ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
        currentValue: input.batteryLevel,
        threshold: 20,
        message: `Batería baja (${input.batteryLevel}%) en sensor`,
      });
    }

    // Update session metrics periodically (every 10 readings)
    if (session) {
      const readingCount = await this.prisma.coldChainReading.count({
        where: { sessionId: session.id },
      });

      if (readingCount % 10 === 0) {
        await this.updateSessionMetrics(session.id);
      }
    }

    return reading;
  }

  /**
   * Get readings for a session
   */
  async getSessionReadings(sessionId: string, options?: {
    limit?: number;
    offset?: number;
    startTime?: Date;
    endTime?: Date;
  }) {
    const where: Prisma.ColdChainReadingWhereInput = { sessionId };

    if (options?.startTime || options?.endTime) {
      where.readingTime = {};
      if (options.startTime) {
        where.readingTime.gte = options.startTime;
      }
      if (options.endTime) {
        where.readingTime.lte = options.endTime;
      }
    }

    const [readings, total] = await Promise.all([
      this.prisma.coldChainReading.findMany({
        where,
        take: options?.limit || 100,
        skip: options?.offset || 0,
        orderBy: { readingTime: 'desc' },
      }),
      this.prisma.coldChainReading.count({ where }),
    ]);

    return { readings, total };
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // BREACH HANDLING
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * Handle temperature/humidity breach
   */
  private async handleBreach(
    sessionId: string,
    sensorId: string,
    data: {
      temperature: number;
      humidity?: number;
      temperatureInRange: boolean;
      humidityInRange: boolean;
      thresholds: { minTemp: number; maxTemp: number; targetHumidity: number };
    }
  ): Promise<void> {
    // Check for ongoing breach
    const ongoingBreach = await this.prisma.coldChainBreach.findFirst({
      where: {
        sessionId,
        endTime: null,
      },
      orderBy: { startTime: 'desc' },
    });

    let breachType: BreachType;
    let threshold: number;
    let peakValue: number;

    if (!data.temperatureInRange) {
      if (data.temperature > data.thresholds.maxTemp) {
        breachType = BreachType.OVER_TEMP;
        threshold = data.thresholds.maxTemp;
      } else {
        breachType = BreachType.UNDER_TEMP;
        threshold = data.thresholds.minTemp;
      }
      peakValue = data.temperature;
    } else if (!data.humidityInRange && data.humidity !== undefined) {
      if (data.humidity > data.thresholds.targetHumidity + 5) {
        breachType = BreachType.HUMIDITY_HIGH;
      } else {
        breachType = BreachType.HUMIDITY_LOW;
      }
      threshold = data.thresholds.targetHumidity;
      peakValue = data.humidity;
    } else {
      return; // No breach to handle
    }

    const deviation = Math.abs(peakValue - threshold);

    if (ongoingBreach) {
      // Update existing breach
      const durationMinutes = differenceInMinutes(new Date(), ongoingBreach.startTime);
      const severity = calculateBreachSeverity(deviation, durationMinutes);

      await this.prisma.coldChainBreach.update({
        where: { id: ongoingBreach.id },
        data: {
          peakValue: Math.max(peakValue, Number(ongoingBreach.peakValue)),
          durationMinutes,
          severity,
        },
      });
    } else {
      // Create new breach
      const severity = calculateBreachSeverity(deviation, 0);

      const breach = await this.prisma.coldChainBreach.create({
        data: {
          sessionId,
          sensorId,
          breachType,
          severity,
          startTime: new Date(),
          durationMinutes: 0,
          threshold,
          peakValue,
          avgValue: peakValue,
        },
      });

      // Create alert for new breach
      await this.createAlert(sessionId, sensorId, {
        alertType: breachType.includes('TEMP') ? AlertType.TEMPERATURE_BREACH : AlertType.HUMIDITY_BREACH,
        severity: severity === BreachSeverity.CRITICAL ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
        currentValue: peakValue,
        threshold,
        message: `${breachType === BreachType.OVER_TEMP ? 'Temperatura alta' :
                  breachType === BreachType.UNDER_TEMP ? 'Temperatura baja' :
                  breachType === BreachType.HUMIDITY_HIGH ? 'Humedad alta' : 'Humedad baja'}: ${peakValue.toFixed(1)} (límite: ${threshold})`,
      });

      // Update session breach count
      await this.prisma.coldChainSession.update({
        where: { id: sessionId },
        data: {
          breachCount: { increment: 1 },
        },
      });

      logger.warn('[ColdChain] Breach detected', {
        sessionId,
        sensorId,
        breachType,
        severity,
        peakValue,
        threshold,
      });
    }
  }

  /**
   * Create an alert
   */
  private async createAlert(
    sessionId: string,
    sensorId: string,
    data: {
      alertType: AlertType;
      severity: AlertSeverity;
      currentValue: number;
      threshold: number;
      message: string;
    }
  ): Promise<void> {
    // Check for duplicate recent alert (within 5 minutes)
    const recentAlert = await this.prisma.coldChainAlert.findFirst({
      where: {
        sessionId,
        sensorId,
        alertType: data.alertType as any,
        timestamp: { gte: addMinutes(new Date(), -5) },
      },
    });

    if (recentAlert) {
      return; // Don't create duplicate alert
    }

    await this.prisma.coldChainAlert.create({
      data: {
        sessionId,
        sensorId,
        alertType: data.alertType as any,
        severity: data.severity as any,
        currentValue: data.currentValue,
        threshold: data.threshold,
        message: data.message,
        messageLang: 'es',
        sent: false,
      },
    });

    logger.info('[ColdChain] Alert created', {
      sessionId,
      sensorId,
      alertType: data.alertType,
      severity: data.severity,
    });
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // METRICS & REPORTING
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * Update session metrics from readings
   */
  async updateSessionMetrics(sessionId: string): Promise<SessionMetrics> {
    const readings = await this.prisma.coldChainReading.findMany({
      where: { sessionId },
    });

    if (readings.length === 0) {
      return {
        totalReadings: 0,
        compliantReadings: 0,
        complianceScore: 0,
        breachCount: 0,
        avgTemperature: null,
        minTemperature: null,
        maxTemperature: null,
        avgHumidity: null,
        avgBrixLevel: null,
        avgPhLevel: null,
        qualityGrade: null,
      };
    }

    // Calculate metrics
    const totalReadings = readings.length;
    const compliantReadings = readings.filter(r => r.temperatureInRange && r.humidityInRange).length;

    // Get breach data
    const breaches = await this.prisma.coldChainBreach.findMany({
      where: { sessionId },
    });

    const maxBreachDuration = breaches.reduce((max, b) => Math.max(max, b.durationMinutes), 0);
    const complianceScore = calculateComplianceScore(
      totalReadings,
      compliantReadings,
      breaches.length,
      maxBreachDuration
    );

    // Temperature stats
    const temperatures = readings.map(r => Number(r.temperature));
    const avgTemperature = temperatures.reduce((a, b) => a + b, 0) / temperatures.length;
    const minTemperature = Math.min(...temperatures);
    const maxTemperature = Math.max(...temperatures);

    // Humidity stats
    const humidityReadings = readings.filter(r => r.humidity !== null);
    const avgHumidity = humidityReadings.length > 0
      ? humidityReadings.reduce((sum, r) => sum + Number(r.humidity), 0) / humidityReadings.length
      : null;

    // Quality metrics
    const brixReadings = readings.filter(r => r.brixLevel !== null);
    const avgBrixLevel = brixReadings.length > 0
      ? brixReadings.reduce((sum, r) => sum + Number(r.brixLevel), 0) / brixReadings.length
      : null;

    const phReadings = readings.filter(r => r.phLevel !== null);
    const avgPhLevel = phReadings.length > 0
      ? phReadings.reduce((sum, r) => sum + Number(r.phLevel), 0) / phReadings.length
      : null;

    // Get session for crop type
    const session = await this.prisma.coldChainSession.findUnique({
      where: { id: sessionId },
    });

    let qualityGrade: QualityGradeType | null = null;
    if (avgBrixLevel !== null && session) {
      qualityGrade = calculateQualityGrade(
        session.cropType as CropType,
        avgBrixLevel,
        avgPhLevel
      );
    }

    // Update session
    await this.prisma.coldChainSession.update({
      where: { id: sessionId },
      data: {
        totalReadings,
        compliantReadings,
        complianceScore,
        avgTemperature,
        minTemperatureRecorded: minTemperature,
        maxTemperatureRecorded: maxTemperature,
        avgHumidity,
        avgBrixLevel,
        avgPhLevel,
        qualityGrade: qualityGrade as any,
        breachDurationMinutes: maxBreachDuration > 0 ? maxBreachDuration : null,
        maxTemperatureBreach: breaches.length > 0
          ? Math.max(...breaches.map(b => Math.abs(Number(b.peakValue) - Number(b.threshold))))
          : null,
      },
    });

    return {
      totalReadings,
      compliantReadings,
      complianceScore,
      breachCount: breaches.length,
      avgTemperature,
      minTemperature,
      maxTemperature,
      avgHumidity,
      avgBrixLevel,
      avgPhLevel,
      qualityGrade,
    };
  }

  /**
   * Get dashboard stats for an export company
   */
  async getDashboardStats(exportCompanyId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      activeSessions,
      completedSessionsThisMonth,
      totalSensors,
      activeSensors,
      breachesThisMonth,
      avgComplianceScore,
    ] = await Promise.all([
      this.prisma.coldChainSession.count({
        where: { exportCompanyId, status: 'ACTIVE' },
      }),
      this.prisma.coldChainSession.count({
        where: {
          exportCompanyId,
          status: 'COMPLETED',
          endTime: { gte: startOfMonth },
        },
      }),
      this.prisma.ioTSensor.count({
        where: { exportCompanyId },
      }),
      this.prisma.ioTSensor.count({
        where: { exportCompanyId, status: 'ACTIVE' },
      }),
      this.prisma.coldChainBreach.count({
        where: {
          session: { exportCompanyId },
          startTime: { gte: startOfMonth },
        },
      }),
      this.prisma.coldChainSession.aggregate({
        where: {
          exportCompanyId,
          status: 'COMPLETED',
          endTime: { gte: startOfMonth },
        },
        _avg: { complianceScore: true },
      }),
    ]);

    return {
      activeSessions,
      completedSessionsThisMonth,
      totalSensors,
      activeSensors,
      offlineSensors: totalSensors - activeSensors,
      breachesThisMonth,
      avgComplianceScore: avgComplianceScore._avg.complianceScore
        ? Number(avgComplianceScore._avg.complianceScore)
        : null,
    };
  }

  /**
   * Get session compliance report data
   */
  async getComplianceReport(sessionId: string) {
    const session = await this.prisma.coldChainSession.findUnique({
      where: { id: sessionId },
      include: {
        sensors: true,
        breaches: { orderBy: { startTime: 'asc' } },
        alerts: { orderBy: { timestamp: 'asc' } },
        exportCompany: { select: { name: true } },
      },
    });

    if (!session) {
      throw new AppError('Session not found', 404);
    }

    // Get readings summary by hour
    const readings = await this.prisma.coldChainReading.findMany({
      where: { sessionId },
      orderBy: { readingTime: 'asc' },
    });

    // Group readings by hour for chart data
    const hourlyData: Record<string, {
      hour: string;
      avgTemp: number;
      minTemp: number;
      maxTemp: number;
      readings: number;
    }> = {};

    readings.forEach(r => {
      const hour = new Date(r.readingTime).toISOString().slice(0, 13);
      if (!hourlyData[hour]) {
        hourlyData[hour] = {
          hour,
          avgTemp: 0,
          minTemp: Number(r.temperature),
          maxTemp: Number(r.temperature),
          readings: 0,
        };
      }
      hourlyData[hour].avgTemp += Number(r.temperature);
      hourlyData[hour].minTemp = Math.min(hourlyData[hour].minTemp, Number(r.temperature));
      hourlyData[hour].maxTemp = Math.max(hourlyData[hour].maxTemp, Number(r.temperature));
      hourlyData[hour].readings++;
    });

    // Calculate averages
    Object.values(hourlyData).forEach(h => {
      h.avgTemp = h.avgTemp / h.readings;
    });

    return {
      session: {
        id: session.id,
        sessionType: session.sessionType,
        cropType: session.cropType,
        status: session.status,
        startTime: session.startTime,
        endTime: session.endTime,
        durationMinutes: session.durationMinutes,
        complianceScore: Number(session.complianceScore),
        qualityGrade: session.qualityGrade,
        thresholds: {
          minTemperature: Number(session.minTemperature),
          maxTemperature: Number(session.maxTemperature),
          targetHumidity: Number(session.targetHumidity),
        },
      },
      metrics: {
        totalReadings: session.totalReadings,
        compliantReadings: session.compliantReadings,
        breachCount: session.breachCount,
        avgTemperature: session.avgTemperature ? Number(session.avgTemperature) : null,
        minTemperature: session.minTemperatureRecorded ? Number(session.minTemperatureRecorded) : null,
        maxTemperature: session.maxTemperatureRecorded ? Number(session.maxTemperatureRecorded) : null,
        avgHumidity: session.avgHumidity ? Number(session.avgHumidity) : null,
        avgBrixLevel: session.avgBrixLevel ? Number(session.avgBrixLevel) : null,
        avgPhLevel: session.avgPhLevel ? Number(session.avgPhLevel) : null,
      },
      sensors: session.sensors,
      breaches: session.breaches,
      alerts: session.alerts,
      hourlyData: Object.values(hourlyData),
      exportCompany: session.exportCompany.name,
    };
  }
}
