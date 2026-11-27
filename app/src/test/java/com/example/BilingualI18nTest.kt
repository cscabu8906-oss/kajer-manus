package com.example

import com.example.i18n.AppLanguage
import com.example.i18n.BilingualConfig
import com.example.i18n.I18nCatalog
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class BilingualI18nTest {

    private fun extractLeafKeys(json: String): Set<String> {
        val keys = mutableSetOf<String>()
        val path = mutableListOf<String>()
        var i = 0
        fun skipWs() {
            while (i < json.length && json[i].isWhitespace()) i++
        }
        fun readString(): String {
            i++ // skip opening quote
            val sb = StringBuilder()
            while (i < json.length) {
                val c = json[i++]
                if (c == '\\' && i < json.length) {
                    sb.append(json[i++])
                } else if (c == '"') {
                    break
                } else {
                    sb.append(c)
                }
            }
            return sb.toString()
        }
        fun parseValue() {
            skipWs()
            if (i >= json.length) return
            when (json[i]) {
                '{' -> {
                    i++ // {
                    while (i < json.length) {
                        skipWs()
                        if (json[i] == '}') {
                            i++
                            break
                        }
                        if (json[i] == ',') {
                            i++
                            skipWs()
                        }
                        if (json[i] == '"') {
                            val key = readString()
                            skipWs()
                            if (i < json.length && json[i] == ':') i++
                            path.add(key)
                            parseValue()
                            path.removeAt(path.lastIndex)
                        } else {
                            i++
                        }
                    }
                }
                '"' -> {
                    readString()
                    if (path.isNotEmpty()) keys.add(path.joinToString("."))
                }
                else -> {
                    while (i < json.length && json[i] != ',' && json[i] != '}') i++
                    if (path.isNotEmpty()) keys.add(path.joinToString("."))
                }
            }
        }
        parseValue()
        return keys
    }

    private fun loadKeys(path: String): Set<String> {
        val file = listOf(File(path), File("app/$path")).first { it.exists() }
        return extractLeafKeys(file.readText())
    }

    @Test
    fun translationDictionariesHaveFullKeyParity() {
        val bnKeys = loadKeys("src/main/assets/locales/bn/translation.json")
        val enKeys = loadKeys("src/main/assets/locales/en/translation.json")

        val missingInEn = bnKeys - enKeys
        val missingInBn = enKeys - bnKeys

        assertTrue("Missing keys in en: $missingInEn", missingInEn.isEmpty())
        assertTrue("Missing keys in bn: $missingInBn", missingInBn.isEmpty())
        assertTrue("Should contain comprehensive keys", bnKeys.size >= 80)
    }

    @Test
    fun bengaliNumeralsAndCurrencyFormatCorrectly() {
        val bnWithNumerals = BilingualConfig(language = AppLanguage.BN, bengaliNumerals = true)
        assertEquals("₹২৯৯", bnWithNumerals.formatCurrencyInr(299L))

        val bnWesternNumerals = BilingualConfig(language = AppLanguage.BN, bengaliNumerals = false)
        assertEquals("₹299", bnWesternNumerals.formatCurrencyInr(299L))

        val enConfig = BilingualConfig(language = AppLanguage.EN, bengaliNumerals = true)
        assertEquals("₹299", enConfig.formatCurrencyInr(299L))
    }

    @Test
    fun i18nCatalogFallbackNeverReturnsRawNestedKey() {
        val catalog = I18nCatalog(
            bnMap = mapOf("auth.login" to "লগইন"),
            enMap = mapOf("auth.login" to "Login", "auth.only_en" to "Only English")
        )
        assertEquals("লগইন", catalog.translate("auth.login", AppLanguage.BN))
        assertEquals("Login", catalog.translate("auth.login", AppLanguage.EN))
        assertEquals("Only English", catalog.translate("auth.only_en", AppLanguage.BN))
    }
}
