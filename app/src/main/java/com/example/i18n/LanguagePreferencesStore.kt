package com.example.i18n

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.languageDataStore by preferencesDataStore(name = "kajer_manush_prefs")

class LanguagePreferencesStore(private val context: Context) {
    private object Keys {
        val LANGUAGE_CODE = stringPreferencesKey("language_preference")
        val BENGALI_NUMERALS = booleanPreferencesKey("bengali_numerals")
    }

    val languageFlow: Flow<AppLanguage> = context.languageDataStore.data.map { prefs ->
        AppLanguage.fromCode(prefs[Keys.LANGUAGE_CODE])
    }

    val bengaliNumeralsFlow: Flow<Boolean> = context.languageDataStore.data.map { prefs ->
        prefs[Keys.BENGALI_NUMERALS] ?: true
    }

    suspend fun saveLanguage(language: AppLanguage) {
        context.languageDataStore.edit { prefs ->
            prefs[Keys.LANGUAGE_CODE] = language.code
        }
    }

    suspend fun saveBengaliNumerals(enabled: Boolean) {
        context.languageDataStore.edit { prefs ->
            prefs[Keys.BENGALI_NUMERALS] = enabled
        }
    }
}
