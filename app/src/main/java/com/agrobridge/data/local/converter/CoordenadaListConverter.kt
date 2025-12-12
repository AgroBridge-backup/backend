package com.agrobridge.data.local.converter

import androidx.room.TypeConverter
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

/**
 * Convertidor de Room para serializar/deserializar listas de coordenadas
 * Convierte List<Coordenada> a/desde String JSON
 */
class CoordenadaListConverter {

    private val gson = Gson()

    /**
     * Convierte una lista de coordenadas (en formato JSON String) a objeto Kotlin
     */
    @TypeConverter
    fun fromCoordenadaString(value: String?): List<CoordenadaEntity>? {
        if (value == null) return null
        return try {
            val type = object : TypeToken<List<CoordenadaEntity>>() {}.type
            gson.fromJson(value, type)
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Convierte una lista de coordenadas a JSON String para almacenar en DB
     */
    @TypeConverter
    fun toCoordenadaString(list: List<CoordenadaEntity>?): String? {
        return if (list == null) null else gson.toJson(list)
    }
}

/**
 * Entidad para coordenadas individuales (usada dentro de LoteEntity)
 */
data class CoordenadaEntity(
    val latitud: Double,
    val longitud: Double
)
