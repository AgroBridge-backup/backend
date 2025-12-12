import UIKit
import PDFKit

// MARK: - PDF Generator
/// Utilidad para generar PDFs de reportes y certificados
class PDFGenerator {

    // MARK: - Singleton
    static let shared = PDFGenerator()

    private init() {
        print("📄 PDFGenerator inicializado")
    }

    // MARK: - Generate Lote Report
    /// Genera un PDF con el reporte completo de un lote
    /// - Parameter lote: Lote a incluir en el reporte
    /// - Returns: Data del PDF generado
    func generateLoteReport(lote: Lote) -> Data {
        print("📄 Generando reporte PDF para lote: \(lote.nombre)")

        let pdfMetadata = [
            kCGPDFContextCreator: "AgroBridge",
            kCGPDFContextTitle: "Reporte de Lote - \(lote.nombre)",
            kCGPDFContextAuthor: "AgroBridge Platform"
        ]

        let format = UIGraphicsPDFRendererFormat()
        format.documentInfo = pdfMetadata as [String: Any]

        let pageRect = CGRect(x: 0, y: 0, width: 612, height: 792) // Letter size (8.5" x 11")
        let renderer = UIGraphicsPDFRenderer(bounds: pageRect, format: format)

        let data = renderer.pdfData { context in
            context.beginPage()

            var yPosition: CGFloat = 50
            let leftMargin: CGFloat = 50
            let rightMargin: CGFloat = 562

            // HEADER
            drawText("REPORTE DE LOTE", at: CGPoint(x: leftMargin, y: yPosition), fontSize: 24, bold: true, color: .systemGreen)
            yPosition += 40

            drawLine(from: CGPoint(x: leftMargin, y: yPosition), to: CGPoint(x: rightMargin, y: yPosition), color: .systemGreen)
            yPosition += 20

            // INFORMACIÓN BÁSICA
            drawSectionHeader("Información General", at: CGPoint(x: leftMargin, y: yPosition))
            yPosition += 30

            drawInfoRow(label: "Nombre:", value: lote.nombre, yPosition: &yPosition, leftMargin: leftMargin)
            drawInfoRow(label: "Ubicación:", value: lote.ubicacion, yPosition: &yPosition, leftMargin: leftMargin)
            drawInfoRow(label: "Tipo de Cultivo:", value: lote.tipoCultivo, yPosition: &yPosition, leftMargin: leftMargin)

            if let area = lote.areaHectareas {
                drawInfoRow(label: "Área:", value: String(format: "%.2f hectáreas", area), yPosition: &yPosition, leftMargin: leftMargin)
            }

            drawInfoRow(label: "Estado:", value: lote.estado.displayName, yPosition: &yPosition, leftMargin: leftMargin)
            drawInfoRow(label: "Fecha de Creación:", value: formatDate(lote.fechaCreacion), yPosition: &yPosition, leftMargin: leftMargin)

            yPosition += 20

            // BLOQUE ASOCIADO
            if let bloqueNombre = lote.bloqueNombre {
                drawSectionHeader("Bloque Asociado", at: CGPoint(x: leftMargin, y: yPosition))
                yPosition += 30

                drawInfoRow(label: "Bloque:", value: bloqueNombre, yPosition: &yPosition, leftMargin: leftMargin)

                if let bloqueId = lote.bloqueId {
                    drawText("ID: \(bloqueId)", at: CGPoint(x: leftMargin, y: yPosition), fontSize: 10, color: .gray)
                    yPosition += 25
                }

                yPosition += 20
            }

            // METADATA
            if let metadata = lote.metadata {
                drawSectionHeader("Información Adicional", at: CGPoint(x: leftMargin, y: yPosition))
                yPosition += 30

                if let coordenadas = metadata.coordenadasGPS {
                    drawInfoRow(label: "Coordenadas GPS:", value: String(format: "%.6f, %.6f", coordenadas.latitud, coordenadas.longitud), yPosition: &yPosition, leftMargin: leftMargin)

                    if let altitud = coordenadas.altitud {
                        drawInfoRow(label: "Altitud:", value: String(format: "%.1f msnm", altitud), yPosition: &yPosition, leftMargin: leftMargin)
                    }
                }

                if let notas = metadata.notas {
                    yPosition += 10
                    drawText("Notas:", at: CGPoint(x: leftMargin, y: yPosition), fontSize: 14, bold: true)
                    yPosition += 20

                    drawMultilineText(notas, at: CGPoint(x: leftMargin, y: yPosition), width: rightMargin - leftMargin, fontSize: 12)
                    yPosition += 40
                }
            }

            // FOOTER
            drawFooter(at: pageRect, leftMargin: leftMargin)
        }

        print("✅ PDF generado exitosamente: \(data.count) bytes")
        return data
    }

    // MARK: - Generate Bloque Certificate
    /// Genera un certificado PDF para un bloque certificado
    /// - Parameter bloque: Bloque certificado
    /// - Returns: Data del PDF del certificado
    func generateBloqueCertificate(bloque: Bloque) -> Data {
        print("📄 Generando certificado PDF para bloque: \(bloque.nombre)")

        let pdfMetadata = [
            kCGPDFContextCreator: "AgroBridge",
            kCGPDFContextTitle: "Certificado de Bloque - \(bloque.nombre)",
            kCGPDFContextAuthor: "AgroBridge Certification Authority"
        ]

        let format = UIGraphicsPDFRendererFormat()
        format.documentInfo = pdfMetadata as [String: Any]

        let pageRect = CGRect(x: 0, y: 0, width: 612, height: 792)
        let renderer = UIGraphicsPDFRenderer(bounds: pageRect, format: format)

        let data = renderer.pdfData { context in
            context.beginPage()

            var yPosition: CGFloat = 50
            let leftMargin: CGFloat = 50
            let rightMargin: CGFloat = 562

            // HEADER CON LOGO/BADGE
            drawCertificateBadge(at: CGPoint(x: pageRect.width / 2, y: yPosition))
            yPosition += 100

            // TÍTULO CERTIFICADO
            drawCenteredText("CERTIFICADO DE BLOQUE", at: yPosition, pageWidth: pageRect.width, fontSize: 26, bold: true, color: .systemGreen)
            yPosition += 40

            drawLine(from: CGPoint(x: leftMargin, y: yPosition), to: CGPoint(x: rightMargin, y: yPosition), color: .systemGreen, width: 2)
            yPosition += 30

            // TEXTO CERTIFICACIÓN
            let certificacionText = bloque.certificado ?
                "Este documento certifica que el siguiente bloque ha sido validado y certificado en la plataforma AgroBridge" :
                "Este documento certifica que el siguiente bloque está registrado en la plataforma AgroBridge"

            drawMultilineText(certificacionText, at: CGPoint(x: leftMargin, y: yPosition), width: rightMargin - leftMargin, fontSize: 14, alignment: .center)
            yPosition += 60

            // INFORMACIÓN DEL BLOQUE
            drawSectionHeader("Información del Bloque", at: CGPoint(x: leftMargin, y: yPosition))
            yPosition += 30

            drawInfoRow(label: "ID del Bloque:", value: bloque.id, yPosition: &yPosition, leftMargin: leftMargin)
            drawInfoRow(label: "Nombre:", value: bloque.nombre, yPosition: &yPosition, leftMargin: leftMargin)

            if let descripcion = bloque.descripcion {
                drawInfoRow(label: "Descripción:", value: descripcion, yPosition: &yPosition, leftMargin: leftMargin)
            }

            drawInfoRow(label: "Estado:", value: bloque.estado.displayName, yPosition: &yPosition, leftMargin: leftMargin)
            drawInfoRow(label: "Certificado:", value: bloque.certificado ? "Sí ✓" : "No", yPosition: &yPosition, leftMargin: leftMargin)

            yPosition += 10

            // FECHAS
            drawSectionHeader("Fechas", at: CGPoint(x: leftMargin, y: yPosition))
            yPosition += 30

            drawInfoRow(label: "Fecha de Creación:", value: formatDate(bloque.fechaCreacion), yPosition: &yPosition, leftMargin: leftMargin)

            if let fechaCert = bloque.fechaCertificacion {
                drawInfoRow(label: "Fecha de Certificación:", value: formatDate(fechaCert), yPosition: &yPosition, leftMargin: leftMargin)
            }

            yPosition += 20

            // BLOCKCHAIN HASH
            if let hash = bloque.metadata?.blockchainHash {
                drawSectionHeader("Blockchain", at: CGPoint(x: leftMargin, y: yPosition))
                yPosition += 30

                drawText("Hash:", at: CGPoint(x: leftMargin, y: yPosition), fontSize: 12, bold: true)
                yPosition += 20

                // Hash en monospace font
                let hashAttrs: [NSAttributedString.Key: Any] = [
                    .font: UIFont.monospacedSystemFont(ofSize: 9, weight: .regular),
                    .foregroundColor: UIColor.systemBlue
                ]
                hash.draw(at: CGPoint(x: leftMargin, y: yPosition), withAttributes: hashAttrs)
                yPosition += 25
            }

            // QR CODE
            yPosition += 20
            if let qrImage = QRCodeGenerator.shared.generateQRCodeForBloque(bloque, size: CGSize(width: 150, height: 150)) {
                let qrRect = CGRect(x: (pageRect.width - 150) / 2, y: yPosition, width: 150, height: 150)
                qrImage.draw(in: qrRect)
                yPosition += 170

                drawCenteredText("Escanea el código QR para verificar en blockchain", at: yPosition, pageWidth: pageRect.width, fontSize: 10, color: .gray)
                yPosition += 30
            }

            // FIRMA DIGITAL
            yPosition = 660 // Posición fija cerca del footer
            drawLine(from: CGPoint(x: leftMargin + 150, y: yPosition), to: CGPoint(x: rightMargin - 150, y: yPosition))
            yPosition += 15
            drawCenteredText("Certificado por AgroBridge Certification Authority", at: yPosition, pageWidth: pageRect.width, fontSize: 11, bold: true)

            // FOOTER
            drawFooter(at: pageRect, leftMargin: leftMargin)
        }

        print("✅ Certificado PDF generado exitosamente: \(data.count) bytes")
        return data
    }

    // MARK: - Generate Dashboard Report
    /// Genera un reporte PDF del dashboard con estadísticas
    /// - Parameter stats: Estadísticas del dashboard
    /// - Returns: Data del PDF generado
    func generateDashboardReport(stats: DashboardStats) -> Data {
        print("📄 Generando reporte de dashboard")

        let pdfMetadata = [
            kCGPDFContextCreator: "AgroBridge",
            kCGPDFContextTitle: "Reporte de Dashboard - AgroBridge",
            kCGPDFContextAuthor: "AgroBridge Platform"
        ]

        let format = UIGraphicsPDFRendererFormat()
        format.documentInfo = pdfMetadata as [String: Any]

        let pageRect = CGRect(x: 0, y: 0, width: 612, height: 792)
        let renderer = UIGraphicsPDFRenderer(bounds: pageRect, format: format)

        let data = renderer.pdfData { context in
            context.beginPage()

            var yPosition: CGFloat = 50
            let leftMargin: CGFloat = 50
            let rightMargin: CGFloat = 562

            // HEADER
            drawText("REPORTE DE ESTADÍSTICAS", at: CGPoint(x: leftMargin, y: yPosition), fontSize: 24, bold: true, color: .systemBlue)
            yPosition += 40

            drawLine(from: CGPoint(x: leftMargin, y: yPosition), to: CGPoint(x: rightMargin, y: yPosition), color: .systemBlue)
            yPosition += 30

            // ESTADÍSTICAS PRINCIPALES
            drawSectionHeader("Resumen General", at: CGPoint(x: leftMargin, y: yPosition))
            yPosition += 30

            drawInfoRow(label: "Total Productores:", value: "\(stats.totalProductores)", yPosition: &yPosition, leftMargin: leftMargin)
            drawInfoRow(label: "Lotes Activos:", value: "\(stats.lotesActivos)", yPosition: &yPosition, leftMargin: leftMargin)
            drawInfoRow(label: "Bloques Certificados:", value: "\(stats.bloquesCertificados)", yPosition: &yPosition, leftMargin: leftMargin)

            yPosition += 20

            // ESTADO DE CONEXIÓN
            drawSectionHeader("Estado de Conexión", at: CGPoint(x: leftMargin, y: yPosition))
            yPosition += 30

            let estadoTexto = stats.estadoConexion == .conectado ? "✓ Conectado" : "⚠️ Desconectado"
            let estadoColor: UIColor = stats.estadoConexion == .conectado ? .systemGreen : .systemRed

            drawText(estadoTexto, at: CGPoint(x: leftMargin, y: yPosition), fontSize: 14, bold: true, color: estadoColor)
            yPosition += 30

            drawInfoRow(label: "Última Sincronización:", value: formatDate(stats.ultimaSincronizacion), yPosition: &yPosition, leftMargin: leftMargin)

            // FOOTER
            drawFooter(at: pageRect, leftMargin: leftMargin)
        }

        print("✅ Reporte de dashboard generado: \(data.count) bytes")
        return data
    }

    // MARK: - Helper: Draw Section Header
    private func drawSectionHeader(_ text: String, at point: CGPoint) {
        drawText(text, at: point, fontSize: 16, bold: true, color: .systemGray)
    }

    // MARK: - Helper: Draw Info Row
    private func drawInfoRow(label: String, value: String, yPosition: inout CGFloat, leftMargin: CGFloat) {
        drawText(label, at: CGPoint(x: leftMargin, y: yPosition), fontSize: 12, bold: true)
        drawText(value, at: CGPoint(x: leftMargin + 150, y: yPosition), fontSize: 12)
        yPosition += 25
    }

    // MARK: - Helper: Draw Text
    private func drawText(
        _ text: String,
        at point: CGPoint,
        fontSize: CGFloat,
        bold: Bool = false,
        color: UIColor = .black
    ) {
        let font = bold ? UIFont.boldSystemFont(ofSize: fontSize) : UIFont.systemFont(ofSize: fontSize)
        let attributes: [NSAttributedString.Key: Any] = [
            .font: font,
            .foregroundColor: color
        ]
        text.draw(at: point, withAttributes: attributes)
    }

    // MARK: - Helper: Draw Centered Text
    private func drawCenteredText(
        _ text: String,
        at yPosition: CGFloat,
        pageWidth: CGFloat,
        fontSize: CGFloat,
        bold: Bool = false,
        color: UIColor = .black
    ) {
        let font = bold ? UIFont.boldSystemFont(ofSize: fontSize) : UIFont.systemFont(ofSize: fontSize)
        let attributes: [NSAttributedString.Key: Any] = [
            .font: font,
            .foregroundColor: color
        ]

        let textSize = text.size(withAttributes: attributes)
        let x = (pageWidth - textSize.width) / 2

        text.draw(at: CGPoint(x: x, y: yPosition), withAttributes: attributes)
    }

    // MARK: - Helper: Draw Multiline Text
    private func drawMultilineText(
        _ text: String,
        at point: CGPoint,
        width: CGFloat,
        fontSize: CGFloat,
        bold: Bool = false,
        alignment: NSTextAlignment = .left
    ) {
        let font = bold ? UIFont.boldSystemFont(ofSize: fontSize) : UIFont.systemFont(ofSize: fontSize)

        let paragraphStyle = NSMutableParagraphStyle()
        paragraphStyle.alignment = alignment
        paragraphStyle.lineSpacing = 4

        let attributes: [NSAttributedString.Key: Any] = [
            .font: font,
            .foregroundColor: UIColor.black,
            .paragraphStyle: paragraphStyle
        ]

        let rect = CGRect(x: point.x, y: point.y, width: width, height: 1000)
        text.draw(in: rect, withAttributes: attributes)
    }

    // MARK: - Helper: Draw Line
    private func drawLine(from start: CGPoint, to end: CGPoint, color: UIColor = .black, width: CGFloat = 1) {
        let path = UIBezierPath()
        path.move(to: start)
        path.addLine(to: end)
        path.lineWidth = width
        color.setStroke()
        path.stroke()
    }

    // MARK: - Helper: Draw Certificate Badge
    private func drawCertificateBadge(at center: CGPoint) {
        // Dibuja un badge circular de certificación
        let badgeSize: CGFloat = 80

        let circlePath = UIBezierPath(
            arcCenter: center,
            radius: badgeSize / 2,
            startAngle: 0,
            endAngle: 2 * .pi,
            clockwise: true
        )

        UIColor.systemGreen.withAlphaComponent(0.2).setFill()
        circlePath.fill()

        UIColor.systemGreen.setStroke()
        circlePath.lineWidth = 3
        circlePath.stroke()

        // Dibujar checkmark en el centro
        let checkmark = "✓"
        let checkmarkAttributes: [NSAttributedString.Key: Any] = [
            .font: UIFont.boldSystemFont(ofSize: 40),
            .foregroundColor: UIColor.systemGreen
        ]

        let checkmarkSize = checkmark.size(withAttributes: checkmarkAttributes)
        let checkmarkPoint = CGPoint(
            x: center.x - checkmarkSize.width / 2,
            y: center.y - checkmarkSize.height / 2
        )

        checkmark.draw(at: checkmarkPoint, withAttributes: checkmarkAttributes)
    }

    // MARK: - Helper: Draw Footer
    private func drawFooter(at pageRect: CGRect, leftMargin: CGFloat) {
        var yPosition: CGFloat = 742

        drawLine(
            from: CGPoint(x: leftMargin, y: yPosition),
            to: CGPoint(x: pageRect.width - leftMargin, y: yPosition),
            color: .systemGray
        )

        yPosition += 15

        drawText(
            "Generado por AgroBridge - \(formatDate(Date()))",
            at: CGPoint(x: leftMargin, y: yPosition),
            fontSize: 9,
            color: .systemGray
        )

        drawText(
            "agrobridge.io",
            at: CGPoint(x: pageRect.width - 100, y: yPosition),
            fontSize: 9,
            color: .systemGray
        )
    }

    // MARK: - Helper: Format Date
    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "es_ES")
        formatter.dateStyle = .long
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}
