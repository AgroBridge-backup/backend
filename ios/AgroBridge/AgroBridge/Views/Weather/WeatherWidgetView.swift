import SwiftUI

struct WeatherWidgetView: View {
    let weatherData: WeatherData
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 16) {
                // Icono del clima
                AsyncImage(url: URL(string: "https://openweathermap.org/img/wn/\(weatherData.icono)@2x.png")) { image in
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                } placeholder: {
                    ProgressView()
                }
                .frame(width: 60, height: 60)

                VStack(alignment: .leading, spacing: 4) {
                    // Temperatura
                    Text("\(Int(weatherData.temperatura))°C")
                        .font(.system(size: 32, weight: .bold))
                        .foregroundColor(.textPrimary)

                    // Descripción
                    Text(weatherData.descripcion.capitalized)
                        .font(.subheadline)
                        .foregroundColor(.textSecondary)

                    // Recomendación de riego
                    Text(weatherData.irrigationRecommendation)
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundColor(irrigationColor)
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 8) {
                    // Humedad
                    Label {
                        Text("\(weatherData.humedad)%")
                            .font(.caption)
                            .fontWeight(.semibold)
                    } icon: {
                        Image(systemName: "drop.fill")
                            .foregroundColor(.blue)
                    }

                    // Viento
                    Label {
                        Text(String(format: "%.1f m/s", weatherData.velocidadViento))
                            .font(.caption)
                            .fontWeight(.semibold)
                    } icon: {
                        Image(systemName: "wind")
                            .foregroundColor(.gray)
                    }
                }
            }
            .padding()
            .background(Color.white)
            .cornerRadius(16)
            .cardShadow()
        }
        .buttonStyle(.plain)
    }

    private var irrigationColor: Color {
        let recommendation = weatherData.irrigationRecommendation
        if recommendation.contains("❌") {
            return .red
        } else if recommendation.contains("⚠️") {
            return .orange
        } else if recommendation.contains("✅") {
            return .agroGreen
        } else {
            return .blue
        }
    }
}
