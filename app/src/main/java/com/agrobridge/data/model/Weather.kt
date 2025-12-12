package com.agrobridge.data.model

import com.google.gson.annotations.SerializedName

/**
 * Modelo de datos meteorológicos
 * Replica WeatherService.swift de iOS
 * Integrado con OpenWeather API
 */
data class WeatherData(
    @SerializedName("temperatura")
    val temperatura: Double, // En Celsius

    @SerializedName("temperaturaMin")
    val temperaturaMin: Double,

    @SerializedName("temperaturaMax")
    val temperaturaMax: Double,

    @SerializedName("sensacionTermica")
    val sensacionTermica: Double,

    @SerializedName("humedad")
    val humedad: Int, // Porcentaje 0-100

    @SerializedName("descripcion")
    val descripcion: String, // "Soleado", "Nublado", etc.

    @SerializedName("icono")
    val icono: String, // Código de icono de OpenWeather (ej: "01d")

    @SerializedName("velocidadViento")
    val velocidadViento: Double, // En m/s

    @SerializedName("direccionViento")
    val direccionViento: Int, // En grados (0-360)

    @SerializedName("presion")
    val presion: Int, // En hPa

    @SerializedName("visibilidad")
    val visibilidad: Int, // En metros

    @SerializedName("nubosidad")
    val nubosidad: Int, // Porcentaje 0-100

    @SerializedName("probabilidadLluvia")
    val probabilidadLluvia: Double? = null, // Porcentaje 0-1

    @SerializedName("timestamp")
    val timestamp: Long // Unix timestamp
) {
    /**
     * Emoji del clima basado en la descripción/icono
     */
    val weatherEmoji: String
        get() = when {
            icono.startsWith("01") -> "☀️" // Clear sky
            icono.startsWith("02") -> "⛅" // Few clouds
            icono.startsWith("03") -> "☁️" // Scattered clouds
            icono.startsWith("04") -> "☁️" // Broken clouds
            icono.startsWith("09") -> "🌧️" // Shower rain
            icono.startsWith("10") -> "🌦️" // Rain
            icono.startsWith("11") -> "⛈️" // Thunderstorm
            icono.startsWith("13") -> "🌨️" // Snow
            icono.startsWith("50") -> "🌫️" // Mist
            else -> "🌡️"
        }

    /**
     * Temperatura formateada
     */
    val temperaturaFormatted: String
        get() = "${temperatura.toInt()}°C"

    /**
     * Recomendación agrícola basada en el clima
     */
    val recomendacionAgricola: String
        get() = when {
            probabilidadLluvia != null && probabilidadLluvia > 0.7 ->
                "Alta probabilidad de lluvia. Evitar aplicación de fertilizantes."

            temperatura > 35 ->
                "Temperatura muy alta. Considerar riego adicional."

            temperatura < 5 ->
                "Temperatura baja. Riesgo de heladas."

            humedad > 85 ->
                "Humedad alta. Monitorear plagas y enfermedades fúngicas."

            humedad < 30 ->
                "Humedad baja. Incrementar riego si es necesario."

            velocidadViento > 10 ->
                "Viento fuerte. No recomendado aplicar fumigaciones."

            else ->
                "Condiciones favorables para labores agrícolas."
        }

    companion object {
        /**
         * Datos mock para testing
         */
        fun mock() = WeatherData(
            temperatura = 24.5,
            temperaturaMin = 18.0,
            temperaturaMax = 28.0,
            sensacionTermica = 25.0,
            humedad = 65,
            descripcion = "Parcialmente nublado",
            icono = "02d",
            velocidadViento = 3.5,
            direccionViento = 180,
            presion = 1013,
            visibilidad = 10000,
            nubosidad = 40,
            probabilidadLluvia = 0.15,
            timestamp = System.currentTimeMillis()
        )
    }
}

/**
 * Pronóstico del clima (forecast)
 */
data class WeatherForecast(
    @SerializedName("fecha")
    val fecha: Long, // Unix timestamp

    @SerializedName("temperaturaMin")
    val temperaturaMin: Double,

    @SerializedName("temperaturaMax")
    val temperaturaMax: Double,

    @SerializedName("descripcion")
    val descripcion: String,

    @SerializedName("icono")
    val icono: String,

    @SerializedName("probabilidadLluvia")
    val probabilidadLluvia: Double, // 0-1

    @SerializedName("humedad")
    val humedad: Int
) {
    /**
     * Día de la semana formateado
     */
    val diaFormatted: String
        get() {
            val dias = listOf("Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb")
            val calendar = java.util.Calendar.getInstance().apply {
                timeInMillis = fecha
            }
            return dias[calendar.get(java.util.Calendar.DAY_OF_WEEK) - 1]
        }

    companion object {
        /**
         * Lista mock de pronóstico para 5 días
         */
        fun mockForecast(): List<WeatherForecast> = List(5) { index ->
            WeatherForecast(
                fecha = System.currentTimeMillis() + (index * 24 * 60 * 60 * 1000),
                temperaturaMin = 18.0 + index,
                temperaturaMax = 26.0 + index,
                descripcion = if (index % 2 == 0) "Soleado" else "Nublado",
                icono = if (index % 2 == 0) "01d" else "03d",
                probabilidadLluvia = index * 0.15,
                humedad = 60 + (index * 5)
            )
        }
    }
}
