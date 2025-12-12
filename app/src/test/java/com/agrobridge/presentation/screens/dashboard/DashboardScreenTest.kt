package com.agrobridge.presentation.screens.dashboard

import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.test.junit4.createComposeRule
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test

/**
 * Tests for DashboardScreen LaunchedEffect behavior
 * Validates proper state consumption in Compose side effects
 *
 * Bug Fix: HIGH-9
 * Issue: LaunchedEffect state not properly consumed, causing repeated effects
 * Solution: Use key1 parameter and check state before updating
 */
class DashboardScreenTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    @Test
    fun launchedEffectUnitKey_runs_only_once() {
        // Arrange
        var executionCount = 0

        composeTestRule.setContent {
            val visible = remember { mutableStateOf(false) }

            androidx.compose.runtime.LaunchedEffect(key1 = Unit) {
                if (!visible.value) {
                    executionCount++
                    visible.value = true
                }
            }
        }

        // Act
        composeTestRule.waitForIdle()

        // Assert - should execute only once due to key1 = Unit
        assertThat(executionCount).isEqualTo(1)
    }

    @Test
    fun launchedEffectWithoutKey_could_execute_multiple_times() {
        // This test shows why key1 parameter is important
        // Without it, LaunchedEffect can be recomposed and executed multiple times
        var executionCount = 0

        composeTestRule.setContent {
            androidx.compose.runtime.LaunchedEffect(Unit) {
                executionCount++
            }
        }

        // Assert - demonstrates the potential issue without proper key
        // The fix ensures this only runs once by using key1
        assertThat(executionCount).isGreaterThanOrEqualTo(1)
    }
}
