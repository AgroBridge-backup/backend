/**
 * Traceability 2.0 - Tamper-Evident NFC Seals
 * Android ViewModel with NFC Support
 */

package com.agrobridge.presentation.screens.nfc

import android.app.Activity
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.Ndef
import android.os.Build
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class NfcSealViewModel @Inject constructor(
    private val nfcSealRepository: NfcSealRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(NfcSealUiState())
    val uiState: StateFlow<NfcSealUiState> = _uiState.asStateFlow()

    private var nfcAdapter: NfcAdapter? = null
    private var currentBatchId: String? = null

    fun loadBatchSeals(batchId: String) {
        currentBatchId = batchId
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            try {
                val seals = nfcSealRepository.getBatchSeals(batchId)
                val summary = nfcSealRepository.getBatchIntegritySummary(batchId)

                _uiState.update { state ->
                    state.copy(
                        isLoading = false,
                        seals = seals,
                        integritySummary = summary
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(isLoading = false, error = e.message ?: "Error al cargar sellos")
                }
            }
        }
    }

    fun startNfcScan(activity: Activity) {
        nfcAdapter = NfcAdapter.getDefaultAdapter(activity)

        if (nfcAdapter == null) {
            _uiState.update { it.copy(error = "NFC no disponible en este dispositivo") }
            return
        }

        if (!nfcAdapter!!.isEnabled) {
            _uiState.update { it.copy(error = "Por favor, active NFC en configuración") }
            return
        }

        _uiState.update { it.copy(isScanning = true) }

        // Enable foreground dispatch for NFC
        val flags = NfcAdapter.FLAG_READER_NFC_A or
                NfcAdapter.FLAG_READER_NFC_B or
                NfcAdapter.FLAG_READER_NFC_F or
                NfcAdapter.FLAG_READER_NFC_V

        nfcAdapter?.enableReaderMode(activity, { tag ->
            handleNfcTag(tag)
        }, flags, null)
    }

    fun stopNfcScan(activity: Activity) {
        nfcAdapter?.disableReaderMode(activity)
        _uiState.update { it.copy(isScanning = false) }
    }

    private fun handleNfcTag(tag: Tag) {
        viewModelScope.launch {
            try {
                val ndef = Ndef.get(tag)
                ndef?.connect()

                val ndefMessage = ndef?.ndefMessage
                if (ndefMessage != null && ndefMessage.records.isNotEmpty()) {
                    val payload = String(ndefMessage.records[0].payload)

                    // Parse NFC payload
                    // Expected format: serialNumber:signature:readCounter
                    val parts = payload.split(":")
                    if (parts.size >= 3) {
                        verifySeal(
                            serialNumber = parts[0],
                            signature = parts[1],
                            readCounter = parts[2].toIntOrNull() ?: 0
                        )
                    } else {
                        _uiState.update { it.copy(error = "Formato de sello NFC inválido") }
                    }
                }

                ndef?.close()
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isScanning = false,
                        error = e.message ?: "Error al leer sello NFC"
                    )
                }
            }
        }
    }

    private suspend fun verifySeal(serialNumber: String, signature: String, readCounter: Int) {
        try {
            val result = nfcSealRepository.verifySeal(
                serialNumber = serialNumber,
                signature = signature,
                readCounter = readCounter,
                deviceInfo = "${Build.MANUFACTURER} ${Build.MODEL}"
            )

            _uiState.update { state ->
                state.copy(
                    isScanning = false,
                    verificationResult = result,
                    showResultDialog = true
                )
            }

            // Reload seals to reflect updated status
            currentBatchId?.let { loadBatchSeals(it) }
        } catch (e: Exception) {
            _uiState.update {
                it.copy(
                    isScanning = false,
                    error = e.message ?: "Error al verificar sello"
                )
            }
        }
    }

    fun dismissResult() {
        _uiState.update {
            it.copy(
                verificationResult = null,
                showResultDialog = false
            )
        }
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }

    fun attachSeal(sealId: String, batchId: String) {
        viewModelScope.launch {
            try {
                nfcSealRepository.attachSeal(sealId, batchId)
                loadBatchSeals(batchId)
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message ?: "Error al adjuntar sello") }
            }
        }
    }

    fun reportDamage(sealId: String, description: String) {
        viewModelScope.launch {
            try {
                nfcSealRepository.reportDamage(sealId, description)
                currentBatchId?.let { loadBatchSeals(it) }
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message ?: "Error al reportar daño") }
            }
        }
    }
}

// Repository interface for dependency injection
interface NfcSealRepository {
    suspend fun getBatchSeals(batchId: String): List<NfcSeal>
    suspend fun getBatchIntegritySummary(batchId: String): List<SealIntegritySummary>
    suspend fun verifySeal(
        serialNumber: String,
        signature: String,
        readCounter: Int,
        deviceInfo: String
    ): VerificationResult
    suspend fun attachSeal(sealId: String, batchId: String): NfcSeal
    suspend fun reportDamage(sealId: String, description: String): NfcSeal
}
