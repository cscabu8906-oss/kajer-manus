package com.example.i18n

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import org.json.JSONObject
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

enum class AppLanguage(val code: String, val nativeLabel: String) {
    BN("bn", "বাংলা"),
    EN("en", "English");

    companion object {
        fun fromCode(code: String?): AppLanguage =
            entries.firstOrNull { it.code.equals(code, ignoreCase = true) } ?: BN
    }
}

class I18nCatalog(
    private val bnMap: Map<String, String>,
    private val enMap: Map<String, String>
) {
    fun translate(key: String, language: AppLanguage): String {
        val primary = if (language == AppLanguage.BN) bnMap else enMap
        val fallback = if (language == AppLanguage.BN) enMap else bnMap
        return primary[key] ?: fallback[key] ?: key.substringAfterLast('.')
    }

    companion object {
        fun loadFromAssets(context: Context): I18nCatalog {
            val bn = parseJsonAsset(context, "locales/bn/translation.json")
            val en = parseJsonAsset(context, "locales/en/translation.json")
            return I18nCatalog(bn, en)
        }

        private fun parseJsonAsset(context: Context, assetPath: String): Map<String, String> {
            return try {
                val raw = context.assets.open(assetPath).bufferedReader().use { it.readText() }
                val root = JSONObject(raw)
                val flat = mutableMapOf<String, String>()
                flattenJson("", root, flat)
                flat
            } catch (_: Exception) {
                emptyMap()
            }
        }

        private fun flattenJson(prefix: String, obj: JSONObject, out: MutableMap<String, String>) {
            val keys = obj.keys()
            while (keys.hasNext()) {
                val k = keys.next()
                val fullKey = if (prefix.isEmpty()) k else "$prefix.$k"
                val value = obj.get(k)
                if (value is JSONObject) {
                    flattenJson(fullKey, value, out)
                } else {
                    out[fullKey] = value.toString()
                }
            }
        }
    }
}

data class BilingualConfig(
    val language: AppLanguage = AppLanguage.BN,
    val bengaliNumerals: Boolean = true,
    val catalog: I18nCatalog? = null
) {
    fun t(key: String): String = catalog?.translate(key, language) ?: key.substringAfterLast('.')

    fun formatDigits(input: String): String {
        if (language != AppLanguage.BN || !bengaliNumerals) return input
        val bnDigits = charArrayOf('০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯')
        val sb = StringBuilder(input.length)
        for (ch in input) {
            if (ch in '0'..'9') {
                sb.append(bnDigits[ch - '0'])
            } else {
                sb.append(ch)
            }
        }
        return sb.toString()
    }

    fun formatCurrencyInr(amount: Long): String {
        val locale = Locale.Builder().setLanguage("en").setRegion("IN").build()
        val formatter = NumberFormat.getNumberInstance(locale)
        val formatted = "₹${formatter.format(amount)}"
        return formatDigits(formatted)
    }

    fun formatNumber(value: Number): String {
        val raw = value.toString()
        return formatDigits(raw)
    }

    fun formatTimestamp(isoTimestamp: String?): String {
        val date = parseIsoDate(isoTimestamp) ?: Date()
        val locale = if (language == AppLanguage.BN) {
            Locale.Builder().setLanguage("bn").setRegion("IN").build()
        } else {
            Locale.Builder().setLanguage("en").setRegion("IN").build()
        }
        val pattern = "dd MMM yyyy, hh:mm a"
        val formatted = SimpleDateFormat(pattern, locale).format(date)
        return formatDigits(formatted)
    }

    private fun parseIsoDate(raw: String?): Date? {
        if (raw.isNullOrBlank()) return null
        val patterns = listOf(
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
            "yyyy-MM-dd'T'HH:mm:ss'Z'",
            "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
            "yyyy-MM-dd'T'HH:mm:ssXXX",
            "yyyy-MM-dd HH:mm:ss"
        )
        for (pattern in patterns) {
            try {
                val sdf = SimpleDateFormat(pattern, Locale.US)
                sdf.timeZone = TimeZone.getTimeZone("UTC")
                val parsed = sdf.parse(raw)
                if (parsed != null) return parsed
            } catch (_: Exception) {
            }
        }
        return null
    }
}

val LocalBilingualConfig = staticCompositionLocalOf { BilingualConfig() }

@Composable
@ReadOnlyComposable
fun t(key: String): String = LocalBilingualConfig.current.t(key)
