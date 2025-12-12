import SwiftUI

struct WeatherDetailView: View {
    let weather: WeatherData?
    @State private var forecast: [WeatherForecast] = []
    @State private var isLoadingForecast = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    if let weather = weather {
                        currentWeatherSection(weather)
                        forecastSection
                        detailedMetricsSection(weather)
                        recommendationsSection(weather)
                    } else {
                        ProgressView("Cargando clima...")
                    }
                }
                .padding()
            }
            .background(Color.backgroundPrimary)
            .navigationTitle("Pronóstico del Clima")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Cerrar") {
                        dismiss()
                    }
                }
            }
        }
        .task {
            await loadForecast()
        }
    }

    // MARK: - Current Weather Section
    private func currentWeatherSection(_ weather: WeatherData) -> some View {
        VStack(spacing: 20) {
            VStack(spacing: 8) {
                Text(weather.ubicacion)
                    .font(.title2)
                    .fontWeight(.bold)

                HStack(alignment: .top, spacing: 8) {
                    Text("\(Int(weather.temperatura))")
                        .font(.system(size: 72, weight: .thin))

                    Text("°C")
                        .font(.title)
                        .fontWeight(.light)
                        .padding(.top, 8)
                }

                Text(weather.descripcion.capitalized)
                    .font(.title3)
                    .foregroundColor(.secondary)
            }

            HStack(spacing: 32) {
                VStack {
                    Text("Mín")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text("\(Int(weather.tempMin))°")
                        .font(.title3)
                        .fontWeight(.semibold)
                }

                Rectangle()
                    .fill(Color.secondary.opacity(0.3))
                    .frame(width: 1, height: 40)

                VStack {
                    Text("Máx")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text("\(Int(weather.tempMax))°")
                        .font(.title3)
                        .fontWeight(.semibold)
                }
            }
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color.white)
        .cornerRadius(20)
        .elevatedShadow()
    }

    // MARK: - Detailed Metrics
    private func detailedMetricsSection(_ weather: WeatherData) -> some View {
        LazyVGrid(columns: [
            GridItem(.flexible()),
            GridItem(.flexible())
        ], spacing: 16) {
            metricCard(
                icon: "thermometer",
                title: "Sensación",
                value: "\(Int(weather.sensacionTermica))°C",
                color: .orange
            )

            metricCard(
                icon: "drop.fill",
                title: "Humedad",
                value: "\(weather.humedad)%",
                color: .blue
            )

            metricCard(
                icon: "wind",
                title: "Viento",
                value: String(format: "%.1f m/s", weather.velocidadViento),
                color: .gray
            )

            metricCard(
                icon: "gauge",
                title: "Presión",
                value: "\(weather.presion) hPa",
                color: .purple
            )
        }
    }

    private func metricCard(icon: String, title: String, value: String, color: Color) -> some View {
        VStack(spacing: 12) {
            Image(systemName: icon)
                .font(.title)
                .foregroundColor(color)

            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)

            Text(value)
                .font(.headline)
                .fontWeight(.semibold)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color.white)
        .cornerRadius(16)
        .cardShadow()
    }

    // MARK: - Forecast Section
    private var forecastSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Próximos 7 Días")
                .font(.headline)
                .padding(.horizontal)

            if isLoadingForecast {
                ProgressView()
                    .frame(maxWidth: .infinity)
            } else if forecast.isEmpty {
                Text("No hay pronóstico disponible")
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity)
            } else {
                ForEach(forecast.prefix(7)) { item in
                    ForecastRow(forecast: item)
                }
            }
        }
        .padding()
        .background(Color.white)
        .cornerRadius(20)
        .elevatedShadow()
    }

    // MARK: - Recommendations
    private func recommendationsSection(_ weather: WeatherData) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Recomendaciones", systemImage: "lightbulb.fill")
                .font(.headline)
                .foregroundColor(.agroGreen)

            Text(weather.irrigationRecommendation)
                .font(.body)

            Divider()

            if weather.temperatura > 30 {
                recommendationItem(
                    icon: "sun.max.fill",
                    text: "Temperatura alta: Considerar riego adicional",
                    color: .orange
                )
            }

            if weather.humedad > 80 {
                recommendationItem(
                    icon: "humidity.fill",
                    text: "Alta humedad: Monitorear hongos y plagas",
                    color: .blue
                )
            }

            if weather.velocidadViento > 10 {
                recommendationItem(
                    icon: "wind",
                    text: "Viento fuerte: Posponer fumigaciones",
                    color: .gray
                )
            }
        }
        .padding()
        .background(Color.agroGreen.opacity(0.1))
        .cornerRadius(16)
    }

    private func recommendationItem(icon: String, text: String, color: Color) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundColor(color)

            Text(text)
                .font(.subheadline)
        }
    }

    // MARK: - Data Loading
    private func loadForecast() async {
        guard let weather = weather else { return }

        isLoadingForecast = true
        defer { isLoadingForecast = false }

        // Usar coordenadas del campo o fallback
        let coordenada = Coordenada(latitud: 19.432608, longitud: -99.133209)

        do {
            forecast = try await WeatherService.shared.fetchForecast(for: coordenada)
        } catch {
            print("❌ Error cargando pronóstico: \(error)")
        }
    }
}

// MARK: - Forecast Row
struct ForecastRow: View {
    let forecast: WeatherForecast

    var body: some View {
        HStack(spacing: 16) {
            Text(forecast.fecha, format: .dateTime.weekday(.abbreviated))
                .font(.subheadline)
                .fontWeight(.medium)
                .frame(width: 50, alignment: .leading)

            AsyncImage(url: URL(string: "https://openweathermap.org/img/wn/\(forecast.icono).png")) { image in
                image.resizable()
            } placeholder: {
                ProgressView()
            }
            .frame(width: 40, height: 40)

            Text(forecast.descripcion.capitalized)
                .font(.caption)
                .foregroundColor(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)

            if forecast.probabilidadLluvia > 0 {
                Label {
                    Text("\(Int(forecast.probabilidadLluvia))%")
                        .font(.caption)
                } icon: {
                    Image(systemName: "cloud.rain.fill")
                        .foregroundColor(.blue)
                }
            }

            Text("\(Int(forecast.temperatura))°")
                .font(.title3)
                .fontWeight(.semibold)
                .frame(width: 50, alignment: .trailing)
        }
        .padding(.vertical, 8)
        .padding(.horizontal)
        .background(Color.backgroundSecondary)
        .cornerRadius(12)
    }
}
