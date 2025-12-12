package com.agrobridge

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.core.view.WindowCompat
import com.agrobridge.presentation.navigation.AgroBridgeNavGraph
import com.agrobridge.presentation.theme.AgroBridgeTheme
import dagger.hilt.android.AndroidEntryPoint
import timber.log.Timber

/**
 * MainActivity - Actividad principal de AgroBridge
 * Configura edge-to-edge UI y el navigation host
 * Anotada con @AndroidEntryPoint para permitir inyección de Hilt
 */
@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Habilitar edge-to-edge (pantalla completa bajo status/nav bars)
        enableEdgeToEdge()
        WindowCompat.setDecorFitsSystemWindows(window, false)

        Timber.d("MainActivity onCreate")

        setContent {
            AgroBridgeTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    AgroBridgeNavGraph()
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        Timber.d("MainActivity onResume")
    }

    override fun onPause() {
        super.onPause()
        Timber.d("MainActivity onPause")
    }

    override fun onDestroy() {
        super.onDestroy()
        Timber.d("MainActivity onDestroy")
    }
}
