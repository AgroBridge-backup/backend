/**
 * Traceability 2.0 - Blockchain Quality Certificates
 * Android Data Models
 */

package com.agrobridge.data.model

import androidx.compose.ui.graphics.Color
import com.google.gson.annotations.SerializedName
import java.util.Date

/**
 * Certificate grade enum with display properties
 */
enum class CertificateGrade(
    val displayName: String,
    val description: String,
    val color: Long,
    val icon: String
) {
    @SerializedName("STANDARD")
    STANDARD(
        displayName = "Estándar",
        description = "Certificado básico de calidad",
        color = 0xFF9E9E9E,
        icon = "verified"
    ),

    @SerializedName("PREMIUM")
    PREMIUM(
        displayName = "Premium",
        description = "Calidad superior verificada",
        color = 0xFFFFD700,
        icon = "star"
    ),

    @SerializedName("EXPORT")
    EXPORT(
        displayName = "Exportación",
        description = "Apto para mercados internacionales",
        color = 0xFF2196F3,
        icon = "flight"
    ),

    @SerializedName("ORGANIC")
    ORGANIC(
        displayName = "Orgánico",
        description = "Certificación orgánica verificada",
        color = 0xFF4CAF50,
        icon = "eco"
    );

    fun getComposeColor(): Color = Color(color)
}

/**
 * Quality certificate domain model
 */
data class QualityCertificate(
    val id: String,
    val batchId: String,
    val grade: CertificateGrade,
    val certifyingBody: String,
    val validFrom: Date,
    val validTo: Date,
    val hashOnChain: String?,
    val pdfUrl: String?,
    val issuedAt: Date,
    val issuedBy: String,
    val payloadSnapshot: String?,
    val createdAt: Date,
    val updatedAt: Date
) {
    val isValid: Boolean
        get() {
            val now = Date()
            return validFrom <= now && validTo >= now
        }

    val daysUntilExpiry: Long
        get() {
            val diff = validTo.time - System.currentTimeMillis()
            return diff / (1000 * 60 * 60 * 24)
        }
}

/**
 * Certificate eligibility check result
 */
data class CertificateEligibility(
    val canIssue: Boolean,
    val missingStages: List<String>,
    val message: String
)

/**
 * Certificate verification result
 */
data class CertificateVerification(
    val isValid: Boolean,
    val isExpired: Boolean,
    val message: String,
    val certificate: CertificateBasicInfo?,
    val verification: HashVerification?
)

data class CertificateBasicInfo(
    val id: String,
    val batchId: String,
    val grade: CertificateGrade,
    val certifyingBody: String,
    val validFrom: Date,
    val validTo: Date,
    val issuedAt: Date
)

data class HashVerification(
    val computedHash: String?,
    val storedHash: String?,
    val hashMatch: Boolean
)

/**
 * Request to issue a new certificate
 */
data class IssueCertificateRequest(
    val grade: CertificateGrade,
    val certifyingBody: String,
    val validityDays: Int? = 365
)

/**
 * Response from issuing a certificate
 */
data class IssueCertificateResponse(
    val certificate: QualityCertificate,
    val hash: String,
    val blockchainTxId: String?
)

/**
 * API response wrappers
 */
data class CertificatesListResponse(
    val success: Boolean,
    val data: CertificatesListData
)

data class CertificatesListData(
    val certificates: List<QualityCertificate>,
    val count: Int
)

data class CertificateResponse(
    val success: Boolean,
    val data: QualityCertificate
)

data class CertificateEligibilityResponse(
    val success: Boolean,
    val data: CertificateEligibility
)

data class CertificateVerificationResponse(
    val success: Boolean,
    val data: CertificateVerification
)

data class IssueCertificateApiResponse(
    val success: Boolean,
    val data: IssueCertificateResponse,
    val message: String?
)
