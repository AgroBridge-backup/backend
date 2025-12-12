import SwiftUI
import Charts

// MARK: - Analytics View
/// Vista principal de Analytics con gráficas interactivas
struct AnalyticsView: View {

    // MARK: - Properties
    @StateObject private var viewModel = AnalyticsViewModel()

    // MARK: - Body
    var body: some View {
        NavigationView {
            ZStack {
                // Background
                Color(UIColor.systemGroupedBackground)
                    .ignoresSafeArea()

                // Content
                if viewModel.isLoading {
                    loadingView
                } else if viewModel.hasError {
                    errorView
                } else if viewModel.hasData {
                    contentView
                } else {
                    emptyView
                }
            }
            .navigationTitle("📊 Analytics")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        Task {
                            await viewModel.refresh()
                        }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                            .foregroundColor(.agrobridgePrimary)
                    }
                    .disabled(viewModel.isLoading)
                }
            }
        }
        .task {
            await viewModel.fetchAnalytics()
        }
    }

    // MARK: - Content View
    private var contentView: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Header con fecha de generación
                if let fecha = viewModel.fechaGeneracion {
                    headerView(fecha: fecha)
                }

                // Period Selector
                periodSelector

                // Resumen Cards
                if let resumen = viewModel.resumen {
                    resumenSection(resumen: resumen)
                }

                // Charts
                if let produccion = viewModel.produccion {
                    // Chart 1: Producción por Mes
                    produccionMensualChart(produccion: produccion)

                    // Chart 2: Top Cultivos
                    topCultivosChart(produccion: produccion)
                }

                if let calidad = viewModel.calidad {
                    // Chart 3: Distribución de Calidad
                    distribucionCalidadChart(calidad: calidad)
                }

                if let tendencias = viewModel.tendencias {
                    // Chart 4: Proyección Mensual
                    proyeccionChart(tendencias: tendencias)

                    // Indicadores de Crecimiento
                    crecimientoSection(tendencias: tendencias)
                }

                if let certificacion = viewModel.certificacion {
                    // Certificación Stats
                    certificacionSection(certificacion: certificacion)
                }
            }
            .padding()
        }
        .refreshable {
            await viewModel.refresh()
        }
    }

    // MARK: - Header View
    private func headerView(fecha: String) -> some View {
        HStack {
            Image(systemName: "clock.fill")
                .foregroundColor(.secondary)
            Text("Generado: \(fecha)")
                .font(.caption)
                .foregroundColor(.secondary)
            Spacer()
        }
        .padding(.horizontal)
    }

    // MARK: - Period Selector
    private var periodSelector: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Período")
                .font(.headline)
                .foregroundColor(.secondary)

            Picker("Período", selection: $viewModel.periodoSeleccionado) {
                ForEach(PeriodoAnalytics.allCases) { periodo in
                    Label(periodo.displayName, systemImage: periodo.icon)
                        .tag(periodo)
                }
            }
            .pickerStyle(.segmented)
            .onChange(of: viewModel.periodoSeleccionado) { _, newValue in
                Task {
                    await viewModel.changePeriodo(newValue)
                }
            }
        }
        .padding()
        .background(Color.white)
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.05), radius: 5)
    }

    // MARK: - Resumen Section
    private func resumenSection(resumen: ResumenAnalytics) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Resumen General")
                .font(.headline)
                .foregroundColor(.secondary)

            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: 12) {
                ResumenCard(
                    title: "Productores",
                    value: "\(resumen.totalProductores)",
                    subtitle: "\(resumen.productoresActivos) activos",
                    icon: "person.3.fill",
                    color: .blue
                )

                ResumenCard(
                    title: "Lotes",
                    value: "\(resumen.totalLotes)",
                    subtitle: "\(resumen.lotesActivos) activos",
                    icon: "leaf.fill",
                    color: .green
                )

                ResumenCard(
                    title: "Bloques",
                    value: "\(resumen.totalBloques)",
                    subtitle: "\(resumen.bloquesCertificados) certificados",
                    icon: "cube.fill",
                    color: .orange
                )

                if let produccionTotal = resumen.produccionTotal {
                    ResumenCard(
                        title: "Producción",
                        value: String(format: "%.1f kg", produccionTotal),
                        subtitle: "Total período",
                        icon: "scalemass.fill",
                        color: .purple
                    )
                }
            }
        }
        .padding()
        .background(Color.white)
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.05), radius: 5)
    }

    // MARK: - Chart 1: Producción Mensual
    private func produccionMensualChart(produccion: ProduccionAnalytics) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack {
                Image(systemName: "chart.line.uptrend.xyaxis")
                    .foregroundColor(.agrobridgePrimary)
                Text("Producción por Mes")
                    .font(.headline)
                Spacer()
                Text(String(format: "%.1f kg total", produccion.totalKilos))
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }

            // Chart
            if !produccion.distribucionPorMes.isEmpty {
                Chart(produccion.distribucionPorMes) { item in
                    LineMark(
                        x: .value("Mes", item.mes),
                        y: .value("Kilos", item.kilos)
                    )
                    .foregroundStyle(.agrobridgePrimary)
                    .interpolationMethod(.catmullRom)

                    PointMark(
                        x: .value("Mes", item.mes),
                        y: .value("Kilos", item.kilos)
                    )
                    .foregroundStyle(.agrobridgePrimary)
                }
                .frame(height: 200)
                .chartXAxis {
                    AxisMarks(values: .automatic) { _ in
                        AxisGridLine()
                        AxisTick()
                        AxisValueLabel()
                    }
                }
                .chartYAxis {
                    AxisMarks(position: .leading)
                }
            } else {
                noDataPlaceholder
            }
        }
        .padding()
        .background(Color.white)
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.05), radius: 5)
    }

    // MARK: - Chart 2: Top Cultivos
    private func topCultivosChart(produccion: ProduccionAnalytics) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack {
                Image(systemName: "chart.bar.fill")
                    .foregroundColor(.blue)
                Text("Top Cultivos por Producción")
                    .font(.headline)
                Spacer()
            }

            // Chart
            if !produccion.topCultivos.isEmpty {
                Chart(produccion.topCultivos.prefix(5)) { item in
                    BarMark(
                        x: .value("Kilos", item.totalKilos),
                        y: .value("Cultivo", item.tipoCultivo)
                    )
                    .foregroundStyle(colorForCultivo(item.tipoCultivo))
                    .annotation(position: .trailing) {
                        HStack(spacing: 4) {
                            Text(String(format: "%.0f kg", item.totalKilos))
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Text("(\(String(format: "%.1f%%", item.porcentaje)))")
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                    }
                }
                .frame(height: CGFloat(min(produccion.topCultivos.count, 5) * 50))
                .chartXAxis {
                    AxisMarks(position: .bottom)
                }
            } else {
                noDataPlaceholder
            }
        }
        .padding()
        .background(Color.white)
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.05), radius: 5)
    }

    // MARK: - Chart 3: Distribución de Calidad
    private func distribucionCalidadChart(calidad: CalidadAnalytics) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack {
                Image(systemName: "star.fill")
                    .foregroundColor(.yellow)
                Text("Distribución de Calidad")
                    .font(.headline)
                Spacer()
                Text(String(format: "Promedio: %.1f", calidad.promedioGeneral))
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }

            // Chart
            if !calidad.distribucionCalidad.isEmpty {
                Chart(calidad.distribucionCalidad) { item in
                    BarMark(
                        x: .value("Rango", item.rango),
                        y: .value("Cantidad", item.cantidad)
                    )
                    .foregroundStyle(colorForCalidadRango(item.rango))
                    .annotation(position: .top) {
                        VStack(spacing: 2) {
                            Text("\(item.cantidad)")
                                .font(.caption)
                                .bold()
                            Text("(\(String(format: "%.0f%%", item.porcentaje)))")
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                    }
                }
                .frame(height: 200)
                .chartXAxis {
                    AxisMarks { _ in
                        AxisValueLabel()
                    }
                }
            } else {
                noDataPlaceholder
            }
        }
        .padding()
        .background(Color.white)
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.05), radius: 5)
    }

    // MARK: - Chart 4: Proyección
    private func proyeccionChart(tendencias: TendenciasAnalytics) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack {
                Image(systemName: "chart.line.uptrend.xyaxis.circle.fill")
                    .foregroundColor(.purple)
                Text("Proyección de Producción")
                    .font(.headline)
                Spacer()
            }

            // Chart
            if !tendencias.proyeccionMensual.isEmpty {
                Chart(tendencias.proyeccionMensual) { item in
                    LineMark(
                        x: .value("Mes", item.mes),
                        y: .value("Proyección", item.proyeccion)
                    )
                    .foregroundStyle(.purple)
                    .interpolationMethod(.catmullRom)

                    AreaMark(
                        x: .value("Mes", item.mes),
                        y: .value("Proyección", item.proyeccion)
                    )
                    .foregroundStyle(.purple.opacity(0.2))
                }
                .frame(height: 200)
                .chartXAxis {
                    AxisMarks(values: .automatic) { _ in
                        AxisGridLine()
                        AxisValueLabel()
                    }
                }
            } else {
                noDataPlaceholder
            }
        }
        .padding()
        .background(Color.white)
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.05), radius: 5)
    }

    // MARK: - Crecimiento Section
    private func crecimientoSection(tendencias: TendenciasAnalytics) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Indicadores de Crecimiento")
                .font(.headline)
                .foregroundColor(.secondary)

            HStack(spacing: 12) {
                CrecimientoCard(
                    title: "Productores",
                    valor: tendencias.crecimientoProductores,
                    viewModel: viewModel
                )

                CrecimientoCard(
                    title: "Lotes",
                    valor: tendencias.crecimientoLotes,
                    viewModel: viewModel
                )

                CrecimientoCard(
                    title: "Producción",
                    valor: tendencias.crecimientoProduccion,
                    viewModel: viewModel
                )
            }
        }
        .padding()
        .background(Color.white)
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.05), radius: 5)
    }

    // MARK: - Certificación Section
    private func certificacionSection(certificacion: CertificacionAnalytics) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "checkmark.seal.fill")
                    .foregroundColor(.green)
                Text("Certificación")
                    .font(.headline)
                Spacer()
            }

            HStack(spacing: 20) {
                VStack(alignment: .leading) {
                    Text("\(certificacion.totalCertificados)")
                        .font(.title2)
                        .bold()
                    Text("Certificados")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Divider()
                    .frame(height: 40)

                VStack(alignment: .leading) {
                    Text("\(certificacion.enProceso)")
                        .font(.title2)
                        .bold()
                        .foregroundColor(.orange)
                    Text("En proceso")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Spacer()

                VStack(alignment: .trailing) {
                    Text(String(format: "%.1f%%", certificacion.tasaCertificacion))
                        .font(.title2)
                        .bold()
                        .foregroundColor(.green)
                    Text("Tasa certificación")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding()
        .background(Color.white)
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.05), radius: 5)
    }

    // MARK: - Color Helpers
    private func colorForCultivo(_ tipo: String) -> Color {
        switch tipo.lowercased() {
        case _ where tipo.lowercased().contains("aguacate"):
            return .green
        case _ where tipo.lowercased().contains("fresa"):
            return .red
        case _ where tipo.lowercased().contains("tomate"):
            return Color.red.opacity(0.8)
        case _ where tipo.lowercased().contains("lechuga"):
            return Color.green.opacity(0.7)
        case _ where tipo.lowercased().contains("maíz"):
            return .yellow
        default:
            return .blue
        }
    }

    private func colorForCalidadRango(_ rango: String) -> Color {
        if rango.lowercased().contains("alta") || rango.lowercased().contains("excelente") {
            return .green
        } else if rango.lowercased().contains("media") || rango.lowercased().contains("buena") {
            return .blue
        } else if rango.lowercased().contains("baja") {
            return .orange
        } else {
            return .gray
        }
    }

    // MARK: - No Data Placeholder
    private var noDataPlaceholder: some View {
        VStack {
            Image(systemName: "chart.bar.xaxis")
                .font(.system(size: 40))
                .foregroundColor(.gray.opacity(0.5))
            Text("Sin datos disponibles")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .frame(height: 150)
        .frame(maxWidth: .infinity)
    }

    // MARK: - Loading View
    private var loadingView: some View {
        VStack(spacing: 20) {
            ProgressView()
                .scaleEffect(1.5)
            Text("Cargando analytics...")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
    }

    // MARK: - Error View
    private var errorView: some View {
        VStack(spacing: 20) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 60))
                .foregroundColor(.red)

            Text("Error al cargar analytics")
                .font(.headline)

            if let errorMessage = viewModel.errorMessage {
                Text(errorMessage)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
            }

            Button {
                Task {
                    await viewModel.fetchAnalytics()
                }
            } label: {
                Label("Reintentar", systemImage: "arrow.clockwise")
                    .font(.headline)
                    .foregroundColor(.white)
                    .padding()
                    .background(Color.agrobridgePrimary)
                    .cornerRadius(10)
            }
        }
        .padding()
    }

    // MARK: - Empty View
    private var emptyView: some View {
        VStack(spacing: 20) {
            Image(systemName: "chart.bar.doc.horizontal")
                .font(.system(size: 60))
                .foregroundColor(.gray)

            Text("No hay datos disponibles")
                .font(.headline)

            Text("Aún no hay analytics para mostrar")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
    }
}

// MARK: - Resumen Card Component
private struct ResumenCard: View {
    let title: String
    let value: String
    let subtitle: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(color)
                Spacer()
            }

            Text(value)
                .font(.title2)
                .bold()

            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)

            Text(subtitle)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .padding()
        .background(color.opacity(0.1))
        .cornerRadius(10)
    }
}

// MARK: - Crecimiento Card Component
private struct CrecimientoCard: View {
    let title: String
    let valor: Double
    let viewModel: AnalyticsViewModel

    var body: some View {
        VStack(spacing: 4) {
            Text(viewModel.formatPercentage(valor))
                .font(.title3)
                .bold()
                .foregroundColor(viewModel.colorForCrecimiento(valor))

            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)

            Image(systemName: valor > 0 ? "arrow.up.right" : valor < 0 ? "arrow.down.right" : "minus")
                .font(.caption)
                .foregroundColor(viewModel.colorForCrecimiento(valor))
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(viewModel.colorForCrecimiento(valor).opacity(0.1))
        .cornerRadius(10)
    }
}

// MARK: - Preview
#Preview {
    AnalyticsView()
}
