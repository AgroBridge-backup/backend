import Foundation

// MARK: - SensorData
/// Modelo de datos de sensores IoT
struct SensorData: Codable, Identifiable {
    let id: String
    let loteId: String?
    let loteNombre: String?
    let tipoSensor: TipoSensor
    let valor: Double
    let unidad: String
    let timestamp: Date
    let estado: EstadoSensor
    let ubicacion: UbicacionSensor?

    enum CodingKeys: String, CodingKey {
        case id
        case loteId = "lote_id"
        case loteNombre = "lote_nombre"
        case tipoSensor = "tipo_sensor"
        case valor
        case unidad
        case timestamp
        case estado
        case ubicacion
    }
}

// MARK: - TipoSensor
enum TipoSensor: String, Codable, CaseIterable {
    case temperatura = "temperatura"
    case humedad = "humedad"
    case humedadSuelo = "humedad_suelo"
    case ph = "ph"
    case luminosidad = "luminosidad"
    case precipitacion = "precipitacion"
    case vientoVelocidad = "viento_velocidad"

    var displayName: String {
        switch self {
        case .temperatura: return "Temperatura"
        case .humedad: return "Humedad Ambiental"
        case .humedadSuelo: return "Humedad del Suelo"
        case .ph: return "pH del Suelo"
        case .luminosidad: return "Luminosidad"
        case .precipitacion: return "Precipitación"
        case .vientoVelocidad: return "Velocidad del Viento"
        }
    }

    var icon: String {
        switch self {
        case .temperatura: return "thermometer"
        case .humedad: return "humidity"
        case .humedadSuelo: return "drop.fill"
        case .ph: return "flask.fill"
        case .luminosidad: return "sun.max.fill"
        case .precipitacion: return "cloud.rain.fill"
        case .vientoVelocidad: return "wind"
        }
    }

    var defaultUnit: String {
        switch self {
        case .temperatura: return "°C"
        case .humedad: return "%"
        case .humedadSuelo: return "%"
        case .ph: return "pH"
        case .luminosidad: return "lux"
        case .precipitacion: return "mm"
        case .vientoVelocidad: return "km/h"
        }
    }
}

// MARK: - EstadoSensor
enum EstadoSensor: String, Codable {
    case normal = "normal"
    case advertencia = "advertencia"
    case critico = "critico"
    case offline = "offline"

    var displayName: String {
        switch self {
        case .normal: return "Normal"
        case .advertencia: return "Advertencia"
        case .critico: return "Crítico"
        case .offline: return "Sin Conexión"
        }
    }

    var color: String {
        switch self {
        case .normal: return "green"
        case .advertencia: return "orange"
        case .critico: return "red"
        case .offline: return "gray"
        }
    }
}

// MARK: - UbicacionSensor
struct UbicacionSensor: Codable {
    let latitud: Double
    let longitud: Double
    let altitud: Double?

    enum CodingKeys: String, CodingKey {
        case latitud
        case longitud
        case altitud
    }
}

// MARK: - SensorHistorial
/// Historial de lecturas de un sensor
struct SensorHistorial: Codable {
    let sensorId: String
    let lecturas: [LecturaSensor]

    enum CodingKeys: String, CodingKey {
        case sensorId = "sensor_id"
        case lecturas
    }
}

struct LecturaSensor: Codable, Identifiable {
    let id: String
    let valor: Double
    let timestamp: Date

    enum CodingKeys: String, CodingKey {
        case id
        case valor
        case timestamp
    }
}

// MARK: - SensoresResponse
/// Response del servidor para sensores
struct SensoresResponse: Codable {
    let sensores: [SensorData]
    let total: Int
    let ultimaActualizacion: Date?

    enum CodingKeys: String, CodingKey {
        case sensores
        case total
        case ultimaActualizacion = "ultima_actualizacion"
    }
}

// MARK: - ResumenSensores
/// Resumen de estado de sensores
struct ResumenSensores: Codable {
    let totalSensores: Int
    let sensoresActivos: Int
    let sensoresOffline: Int
    let alertas: Int

    enum CodingKeys: String, CodingKey {
        case totalSensores = "total_sensores"
        case sensoresActivos = "sensores_activos"
        case sensoresOffline = "sensores_offline"
        case alertas
    }
}
