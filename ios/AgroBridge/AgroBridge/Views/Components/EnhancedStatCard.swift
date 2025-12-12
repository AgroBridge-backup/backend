import SwiftUI

struct EnhancedStatCard: View {
    let stat: EnhancedStat

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: stat.icon)
                    .foregroundColor(stat.color)

                Spacer()

                if let trend = stat.trend {
                    TrendIndicator(value: trend)
                }
            }

            Text(stat.value)
                .font(.title)
                .fontWeight(.bold)

            Text(stat.label)
                .font(.caption)
                .foregroundColor(.secondary)

            if let comparison = stat.comparison {
                Text(comparison)
                    .font(.caption2)
                    .foregroundColor(.agroGreen)
            }
        }
        .padding()
        .background(Color.white)
        .cornerRadius(12)
        .cardShadow()
    }
}

struct TrendIndicator: View {
    let value: Double

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: value >= 0 ? "arrow.up.right" : "arrow.down.right")
                .font(.caption2)

            Text(String(format: "%.1f%%", abs(value)))
                .font(.caption2)
                .fontWeight(.semibold)
        }
        .foregroundColor(value >= 0 ? .agroGreen : .red)
        .padding(.horizontal, 6)
        .padding(.vertical, 3)
        .background((value >= 0 ? Color.agroGreen : Color.red).opacity(0.1))
        .cornerRadius(6)
    }
}

#Preview {
    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
        EnhancedStatCard(stat: EnhancedStat(
            icon: "leaf.fill",
            label: "Lotes Activos",
            value: "12",
            color: .green,
            trend: 12.5,
            comparison: "vs mes anterior"
        ))

        EnhancedStatCard(stat: EnhancedStat(
            icon: "chart.line.uptrend.xyaxis",
            label: "Área Total",
            value: "45.2 ha",
            color: .blue,
            trend: -3.2,
            comparison: "en producción"
        ))
    }
    .padding()
}
