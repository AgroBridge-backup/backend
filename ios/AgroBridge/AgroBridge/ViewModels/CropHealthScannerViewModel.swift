import Foundation
import UIKit
import SwiftUI

@MainActor
class CropHealthScannerViewModel: ObservableObject {
    @Published var selectedImage: UIImage?
    @Published var lastResult: DiagnosticResult?
    @Published var history: [DiagnosticResult] = []
    @Published var isAnalyzing = false
    @Published var errorMessage: String?

    func analyze() async {
        guard let image = selectedImage else { return }

        isAnalyzing = true
        errorMessage = nil

        do {
            let result = try await CropHealthService.shared.analyzeImage(image)
            lastResult = result
            history.insert(result, at: 0)

            // Limitar historial a 20 items
            if history.count > 20 {
                history = Array(history.prefix(20))
            }

            // Haptic feedback
            let generator = UINotificationFeedbackGenerator()
            generator.notificationOccurred(result.isHealthy ? .success : .warning)

        } catch {
            errorMessage = error.localizedDescription
            print("❌ Error analyzing image: \(error)")
        }

        isAnalyzing = false
    }
}
