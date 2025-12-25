/**
 * Traceability 2.0 - Blockchain Quality Certificates
 * Android ViewModel with Hilt DI
 */

package com.agrobridge.presentation.screens.certificates

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.agrobridge.data.model.*
import com.agrobridge.data.repository.CertificatesRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * UI state for certificates screen
 */
data class CertificatesUiState(
    val isLoading: Boolean = false,
    val certificates: List<QualityCertificate> = emptyList(),
    val selectedCertificate: QualityCertificate? = null,
    val verification: CertificateVerification? = null,
    val eligibility: Map<CertificateGrade, CertificateEligibility> = emptyMap(),
    val error: String? = null,
    val showValidOnly: Boolean = false,
    val isIssuing: Boolean = false,
    val issueSuccess: Boolean = false
)

@HiltViewModel
class CertificatesViewModel @Inject constructor(
    private val repository: CertificatesRepository,
    savedStateHandle: SavedStateHandle
) : ViewModel() {

    private val batchId: String = savedStateHandle.get<String>("batchId") ?: ""
    private val userRole: String = savedStateHandle.get<String>("userRole") ?: ""

    private val _uiState = MutableStateFlow(CertificatesUiState())
    val uiState: StateFlow<CertificatesUiState> = _uiState.asStateFlow()

    val canIssueCertificates: Boolean
        get() = userRole == "CERTIFIER" || userRole == "ADMIN"

    init {
        loadCertificates()
        if (canIssueCertificates) {
            checkAllEligibility()
        }
    }

    fun loadCertificates() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            try {
                val certificates = repository.getCertificates(
                    batchId = batchId,
                    validOnly = _uiState.value.showValidOnly
                )
                _uiState.update { it.copy(isLoading = false, certificates = certificates) }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        error = "Error al cargar certificados: ${e.message}"
                    )
                }
            }
        }
    }

    fun toggleValidOnly() {
        _uiState.update { it.copy(showValidOnly = !it.showValidOnly) }
        loadCertificates()
    }

    fun selectCertificate(certificate: QualityCertificate) {
        _uiState.update { it.copy(selectedCertificate = certificate, verification = null) }
        verifyCertificate(certificate)
    }

    fun clearSelectedCertificate() {
        _uiState.update { it.copy(selectedCertificate = null, verification = null) }
    }

    private fun verifyCertificate(certificate: QualityCertificate) {
        viewModelScope.launch {
            try {
                val verification = repository.verifyCertificate(certificate.id)
                _uiState.update { it.copy(verification = verification) }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(error = "Error al verificar certificado: ${e.message}")
                }
            }
        }
    }

    private fun checkAllEligibility() {
        viewModelScope.launch {
            val eligibilityMap = mutableMapOf<CertificateGrade, CertificateEligibility>()

            for (grade in CertificateGrade.values()) {
                try {
                    val eligibility = repository.checkEligibility(batchId, grade)
                    eligibilityMap[grade] = eligibility
                } catch (e: Exception) {
                    // Log error but continue checking other grades
                }
            }

            _uiState.update { it.copy(eligibility = eligibilityMap) }
        }
    }

    fun issueCertificate(
        grade: CertificateGrade,
        certifyingBody: String,
        validityDays: Int = 365
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(isIssuing = true, error = null, issueSuccess = false) }

            try {
                val request = IssueCertificateRequest(
                    grade = grade,
                    certifyingBody = certifyingBody,
                    validityDays = validityDays
                )
                val certificate = repository.issueCertificate(batchId, request)

                _uiState.update {
                    it.copy(
                        isIssuing = false,
                        issueSuccess = true,
                        certificates = listOf(certificate) + it.certificates
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isIssuing = false,
                        error = "Error al emitir certificado: ${e.message}"
                    )
                }
            }
        }
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }

    fun clearIssueSuccess() {
        _uiState.update { it.copy(issueSuccess = false) }
    }
}

/**
 * Repository interface for certificates
 */
interface CertificatesRepository {
    suspend fun getCertificates(batchId: String, validOnly: Boolean): List<QualityCertificate>
    suspend fun getCertificate(certificateId: String): QualityCertificate
    suspend fun checkEligibility(batchId: String, grade: CertificateGrade): CertificateEligibility
    suspend fun issueCertificate(batchId: String, request: IssueCertificateRequest): QualityCertificate
    suspend fun verifyCertificate(certificateId: String): CertificateVerification
}
