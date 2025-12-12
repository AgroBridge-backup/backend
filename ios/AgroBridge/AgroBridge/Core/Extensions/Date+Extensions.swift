import Foundation

// MARK: - Date Extensions
extension Date {
    // MARK: - Formatters
    /// Formatter para fechas en español
    static let standardFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "es_ES")
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter
    }()

    /// Formatter para fecha y hora completa
    static let fullFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "es_ES")
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter
    }()

    /// Formatter para hora solamente
    static let timeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "es_ES")
        formatter.dateStyle = .none
        formatter.timeStyle = .short
        return formatter
    }()

    /// Formatter ISO8601 para backend
    static let iso8601Formatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    // MARK: - Métodos de Conversión
    /// Convierte la fecha a string con formato estándar
    func toStandardString() -> String {
        return Date.standardFormatter.string(from: self)
    }

    /// Convierte la fecha a string con formato completo (fecha + hora)
    func toFullString() -> String {
        return Date.fullFormatter.string(from: self)
    }

    /// Convierte la fecha a string con solo hora
    func toTimeString() -> String {
        return Date.timeFormatter.string(from: self)
    }

    /// Convierte la fecha a string ISO8601 para enviar al backend
    func toISO8601String() -> String {
        return Date.iso8601Formatter.string(from: self)
    }

    // MARK: - Métodos de Cálculo
    /// Verifica si la fecha es hoy
    var isToday: Bool {
        return Calendar.current.isDateInToday(self)
    }

    /// Verifica si la fecha es ayer
    var isYesterday: Bool {
        return Calendar.current.isDateInYesterday(self)
    }

    /// Retorna el tiempo transcurrido en formato legible (ej: "hace 2 horas")
    func timeAgoDisplay() -> String {
        let calendar = Calendar.current
        let now = Date()
        let components = calendar.dateComponents([.year, .month, .day, .hour, .minute], from: self, to: now)

        if let year = components.year, year >= 1 {
            return year == 1 ? "hace 1 año" : "hace \(year) años"
        } else if let month = components.month, month >= 1 {
            return month == 1 ? "hace 1 mes" : "hace \(month) meses"
        } else if let day = components.day, day >= 1 {
            return day == 1 ? "hace 1 día" : "hace \(day) días"
        } else if let hour = components.hour, hour >= 1 {
            return hour == 1 ? "hace 1 hora" : "hace \(hour) horas"
        } else if let minute = components.minute, minute >= 1 {
            return minute == 1 ? "hace 1 minuto" : "hace \(minute) minutos"
        } else {
            return "justo ahora"
        }
    }
}
