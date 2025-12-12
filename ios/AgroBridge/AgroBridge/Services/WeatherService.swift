import Foundation

// MARK: - Weather Service
@MainActor
class WeatherService: ObservableObject {
    static let shared = WeatherService()

    private let apiKey = "YOUR_OPENWEATHER_API_KEY" // ⚠️ Reemplazar con tu API key
    private let baseURL = "https://api.openweathermap.org/data/2.5"

    private init() {}

    // MARK: - Fetch Current Weather
    func fetchCurrentWeather(for coordenada: Coordenada) async throws -> WeatherData {
        let urlString = "\(baseURL)/weather?lat=\(coordenada.latitud)&lon=\(coordenada.longitud)&appid=\(apiKey)&units=metric&lang=es"

        guard let url = URL(string: urlString) else {
            throw WeatherError.invalidURL
        }

        let (data, response) = try await URLSession.shared.data(from: url)

        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw WeatherError.serverError
        }

        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        let weatherResponse = try decoder.decode(OpenWeatherResponse.self, from: data)

        return WeatherData(from: weatherResponse)
    }

    // MARK: - Fetch Forecast (7 días)
    func fetchForecast(for coordenada: Coordenada) async throws -> [WeatherForecast] {
        let urlString = "\(baseURL)/forecast?lat=\(coordenada.latitud)&lon=\(coordenada.longitud)&appid=\(apiKey)&units=metric&lang=es"

        guard let url = URL(string: urlString) else {
            throw WeatherError.invalidURL
        }

        let (data, _) = try await URLSession.shared.data(from: url)
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        let forecastResponse = try decoder.decode(OpenWeatherForecastResponse.self, from: data)

        return forecastResponse.list.map { WeatherForecast(from: $0) }
    }
}

// MARK: - Weather Data Model
struct WeatherData: Codable, Identifiable {
    let id = UUID()
    let temperatura: Double
    let sensacionTermica: Double
    let tempMin: Double
    let tempMax: Double
    let humedad: Int
    let presion: Int
    let velocidadViento: Double
    let descripcion: String
    let icono: String
    let ubicacion: String
    let timestamp: Date

    init(from response: OpenWeatherResponse) {
        self.temperatura = response.main.temp
        self.sensacionTermica = response.main.feelsLike
        self.tempMin = response.main.tempMin
        self.tempMax = response.main.tempMax
        self.humedad = response.main.humidity
        self.presion = response.main.pressure
        self.velocidadViento = response.wind.speed
        self.descripcion = response.weather.first?.description ?? "Despejado"
        self.icono = response.weather.first?.icon ?? "01d"
        self.ubicacion = response.name
        self.timestamp = Date()
    }

    // Recomendación de riego basada en humedad y temperatura
    var irrigationRecommendation: String {
        if humedad > 80 {
            return "❌ No regar - Humedad alta (\(humedad)%)"
        } else if humedad < 30 {
            return "✅ Riego urgente - Humedad baja (\(humedad)%)"
        } else if temperatura > 30 {
            return "⚠️ Considerar riego - Alta temperatura (\(Int(temperatura))°C)"
        } else {
            return "✓ Humedad óptima (\(humedad)%)"
        }
    }
}

// MARK: - Weather Forecast Model
struct WeatherForecast: Codable, Identifiable {
    let id = UUID()
    let fecha: Date
    let temperatura: Double
    let descripcion: String
    let icono: String
    let probabilidadLluvia: Double

    init(from item: ForecastItem) {
        self.fecha = Date(timeIntervalSince1970: TimeInterval(item.dt))
        self.temperatura = item.main.temp
        self.descripcion = item.weather.first?.description ?? ""
        self.icono = item.weather.first?.icon ?? "01d"
        self.probabilidadLluvia = item.pop * 100
    }
}

// MARK: - OpenWeather API Response Models
private struct OpenWeatherResponse: Codable {
    let main: MainWeather
    let weather: [Weather]
    let wind: Wind
    let name: String
}

private struct OpenWeatherForecastResponse: Codable {
    let list: [ForecastItem]
}

private struct ForecastItem: Codable {
    let dt: Int
    let main: MainWeather
    let weather: [Weather]
    let pop: Double
}

private struct MainWeather: Codable {
    let temp: Double
    let feelsLike: Double
    let tempMin: Double
    let tempMax: Double
    let humidity: Int
    let pressure: Int
}

private struct Weather: Codable {
    let description: String
    let icon: String
}

private struct Wind: Codable {
    let speed: Double
}

// MARK: - Weather Error
enum WeatherError: Error, LocalizedError {
    case invalidURL
    case serverError
    case decodingError

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "URL inválida"
        case .serverError:
            return "Error del servidor"
        case .decodingError:
            return "Error al procesar datos"
        }
    }
}
