import SwiftUI
import PhotosUI

struct CropHealthScannerView: View {
    @StateObject private var viewModel = CropHealthScannerViewModel()
    @State private var showImagePicker = false
    @State private var showCamera = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    captureButtons

                    if viewModel.isAnalyzing {
                        analyzingView
                    } else if let result = viewModel.lastResult {
                        resultCard(result)
                    } else {
                        emptyState
                    }

                    if !viewModel.history.isEmpty {
                        historySection
                    }
                }
                .padding()
            }
            .navigationTitle("Diagnóstico de Salud")
            .sheet(isPresented: $showImagePicker) {
                ImagePicker(image: $viewModel.selectedImage)
            }
            .fullScreenCover(isPresented: $showCamera) {
                CameraView(image: $viewModel.selectedImage)
            }
            .onChange(of: viewModel.selectedImage) { _, newValue in
                if newValue != nil {
                    Task {
                        await viewModel.analyze()
                    }
                }
            }
            .alert("Error", isPresented: .constant(viewModel.errorMessage != nil)) {
                Button("OK") {
                    viewModel.errorMessage = nil
                }
            } message: {
                if let error = viewModel.errorMessage {
                    Text(error)
                }
            }
        }
    }

    // MARK: - Capture Buttons
    private var captureButtons: some View {
        HStack(spacing: 16) {
            Button {
                showCamera = true
            } label: {
                Label("Tomar Foto", systemImage: "camera.fill")
                    .font(.headline)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.agroGreen)
                    .cornerRadius(12)
            }

            Button {
                showImagePicker = true
            } label: {
                Label("Galería", systemImage: "photo.on.rectangle")
                    .font(.headline)
                    .foregroundColor(.agroGreen)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.agroGreen.opacity(0.1))
                    .cornerRadius(12)
            }
        }
    }

    // MARK: - Analyzing View
    private var analyzingView: some View {
        VStack(spacing: 16) {
            ProgressView()
                .scaleEffect(1.5)

            Text("Analizando imagen...")
                .font(.headline)
                .foregroundColor(.secondary)

            Text("Esto puede tardar unos segundos")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(40)
        .background(Color.white)
        .cornerRadius(16)
        .cardShadow()
    }

    // MARK: - Result Card
    private func resultCard(_ result: DiagnosticResult) -> some View {
        VStack(spacing: 16) {
            Image(uiImage: result.image)
                .resizable()
                .aspectRatio(contentMode: .fill)
                .frame(height: 200)
                .clipped()
                .cornerRadius(12)

            HStack {
                VStack(alignment: .leading, spacing: 8) {
                    Text(result.disease.replacingOccurrences(of: "_", with: " ").capitalized)
                        .font(.title2)
                        .fontWeight(.bold)

                    HStack {
                        Text("Confianza:")
                            .foregroundColor(.secondary)

                        Text("\(Int(result.confidence * 100))%")
                            .fontWeight(.semibold)
                            .foregroundColor(result.severity.color)
                    }
                    .font(.subheadline)
                }

                Spacer()

                Text(result.severity.rawValue)
                    .font(.caption)
                    .fontWeight(.bold)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(result.severity.color.opacity(0.2))
                    .foregroundColor(result.severity.color)
                    .cornerRadius(8)
            }

            Divider()

            VStack(alignment: .leading, spacing: 8) {
                Label("Tratamiento Recomendado", systemImage: "leaf.fill")
                    .font(.headline)
                    .foregroundColor(.agroGreen)

                Text(result.treatment)
                    .font(.body)
                    .foregroundColor(.textSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
            .background(Color.backgroundSecondary)
            .cornerRadius(12)

            if result.allPredictions.count > 1 {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Otras Posibilidades")
                        .font(.headline)

                    ForEach(result.allPredictions.dropFirst()) { prediction in
                        HStack {
                            Text(prediction.label.replacingOccurrences(of: "_", with: " "))
                                .font(.subheadline)

                            Spacer()

                            Text("\(Int(prediction.confidence * 100))%")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                }
            }

            Button {
                // TODO: Asociar resultado a lote
            } label: {
                Label("Guardar en Lote", systemImage: "square.and.arrow.down")
                    .font(.headline)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.agroGreen)
                    .cornerRadius(12)
            }
        }
        .padding()
        .background(Color.white)
        .cornerRadius(16)
        .cardShadow()
    }

    // MARK: - Empty State
    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "leaf.circle")
                .font(.system(size: 80))
                .foregroundColor(.agroGreen.opacity(0.3))

            Text("Escanea tus Cultivos")
                .font(.title2)
                .fontWeight(.bold)

            Text("Detecta enfermedades y plagas en segundos usando IA")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(40)
    }

    // MARK: - History Section
    private var historySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Historial")
                .font(.headline)

            ForEach(viewModel.history) { result in
                HistoryRow(result: result) {
                    viewModel.lastResult = result
                }
            }
        }
    }
}

// MARK: - History Row
struct HistoryRow: View {
    let result: DiagnosticResult
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                Image(uiImage: result.image)
                    .resizable()
                    .aspectRatio(contentMode: .fill)
                    .frame(width: 60, height: 60)
                    .clipped()
                    .cornerRadius(8)

                VStack(alignment: .leading, spacing: 4) {
                    Text(result.disease.replacingOccurrences(of: "_", with: " "))
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .lineLimit(1)

                    Text(result.timestamp, format: .dateTime.day().month().hour().minute())
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Spacer()

                Text("\(Int(result.confidence * 100))%")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(result.severity.color)
            }
            .padding()
            .background(Color.backgroundSecondary)
            .cornerRadius(12)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Camera View Wrapper
struct CameraView: UIViewControllerRepresentable {
    @Binding var image: UIImage?
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraView

        init(_ parent: CameraView) {
            self.parent = parent
        }

        func imagePickerController(
            _ picker: UIImagePickerController,
            didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey : Any]
        ) {
            if let image = info[.originalImage] as? UIImage {
                parent.image = image
            }
            parent.dismiss()
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.dismiss()
        }
    }
}

// MARK: - Image Picker Wrapper
struct ImagePicker: UIViewControllerRepresentable {
    @Binding var image: UIImage?
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> PHPickerViewController {
        var config = PHPickerConfiguration()
        config.filter = .images
        config.selectionLimit = 1

        let picker = PHPickerViewController(configuration: config)
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: PHPickerViewController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    class Coordinator: NSObject, PHPickerViewControllerDelegate {
        let parent: ImagePicker

        init(_ parent: ImagePicker) {
            self.parent = parent
        }

        func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
            parent.dismiss()

            guard let provider = results.first?.itemProvider else { return }

            if provider.canLoadObject(ofClass: UIImage.self) {
                provider.loadObject(ofClass: UIImage.self) { image, _ in
                    DispatchQueue.main.async {
                        self.parent.image = image as? UIImage
                    }
                }
            }
        }
    }
}
