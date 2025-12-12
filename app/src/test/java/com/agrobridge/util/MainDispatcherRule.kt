package com.agrobridge.util

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.test.TestDispatcher
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.rules.TestWatcher
import org.junit.runner.Description
import timber.log.Timber

/**
 * Rule para configurar el dispatcher principal de coroutines en tests
 *
 * Uso:
 * @get:Rule val mainDispatcherRule = MainDispatcherRule()
 *
 * ¿Por qué es necesario?
 * - Los ViewModels usan viewModelScope que usa Dispatchers.Main
 * - En tests, no hay Main thread disponible
 * - Esta rule reemplaza Main con un TestDispatcher que es determinístico
 * - Permite testear operaciones asincrónicas de forma controlada
 *
 * ¿Cómo funciona?
 * - starting(): Antes del test, establece el TestDispatcher como Main
 * - finished(): Después del test, restaura el dispatcher original
 *
 * FIXED: Added exception handling in finished() to prevent cascade failures
 * If resetMain() fails, it won't break subsequent tests
 */
class MainDispatcherRule(
    private val testDispatcher: TestDispatcher = UnconfinedTestDispatcher()
) : TestWatcher() {

    override fun starting(description: Description) {
        super.starting(description)
        Dispatchers.setMain(testDispatcher)
    }

    override fun finished(description: Description) {
        super.finished(description)
        try {
            Dispatchers.resetMain()
        } catch (e: Exception) {
            // If resetMain fails, log it but don't cascade the exception
            // This prevents one test's cleanup from breaking subsequent tests
            Timber.e(e, "Failed to reset main dispatcher after test: ${description.methodName}")
        }
    }
}
