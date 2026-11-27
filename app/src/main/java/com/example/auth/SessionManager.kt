package com.example.auth

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.example.data.AuthSession
import com.example.data.UserProfile
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import org.json.JSONObject

private val Context.sessionDataStore: DataStore<Preferences> by preferencesDataStore(name = "kajer_manus_session")

class SessionManager(private val context: Context) {
    private val keyJwtToken = stringPreferencesKey("jwt_token")
    private val keyUserJson = stringPreferencesKey("user_json")

    val sessionFlow: Flow<AuthSession> = context.sessionDataStore.data.map { prefs ->
        val token = prefs[keyJwtToken].orEmpty()
        val rawUser = prefs[keyUserJson].orEmpty()
        val user = parseUserJson(rawUser)
        AuthSession(token = token, user = user)
    }

    suspend fun getToken(): String? {
        return context.sessionDataStore.data.first()[keyJwtToken]?.takeIf { it.isNotBlank() }
    }

    suspend fun saveSession(token: String, user: UserProfile) {
        val json = serializeUser(user).toString()
        context.sessionDataStore.edit { prefs ->
            prefs[keyJwtToken] = token
            prefs[keyUserJson] = json
        }
    }

    suspend fun updateUser(user: UserProfile) {
        val json = serializeUser(user).toString()
        context.sessionDataStore.edit { prefs ->
            prefs[keyUserJson] = json
        }
    }

    suspend fun clearSession() {
        context.sessionDataStore.edit { prefs ->
            prefs.remove(keyJwtToken)
            prefs.remove(keyUserJson)
        }
    }

    companion object {
        fun parseUserObject(obj: JSONObject): UserProfile {
            val id = obj.optString("id").ifBlank { obj.optString("userId") }
            val address = obj.optString("full_address").ifBlank { obj.optString("fullAddress") }
            val mobile = obj.optString("mobile_number").ifBlank { obj.optString("mobileNumber") }
            return UserProfile(
                id = id,
                userId = id,
                fullName = obj.optString("full_name").ifBlank { obj.optString("fullName") },
                email = obj.optString("email"),
                mobileNumber = mobile,
                fullAddress = address,
                accountRole = obj.optString("role").ifBlank { obj.optString("accountRole", "customer") },
                isVerified = obj.optBoolean("is_verified", true),
                languagePreference = obj.optString("language_preference")
                    .ifBlank { obj.optString("languagePreference", "bn") },
                bengaliNumerals = if (obj.has("bengali_numerals")) obj.optBoolean("bengali_numerals", true)
                else obj.optBoolean("bengaliNumerals", true),
                pushNotificationsEnabled = if (obj.has("push_notifications_enabled")) {
                    obj.optBoolean("push_notifications_enabled", true)
                } else {
                    obj.optBoolean("pushNotificationsEnabled", true)
                },
                emailNotificationsEnabled = if (obj.has("email_notifications_enabled")) {
                    obj.optBoolean("email_notifications_enabled", true)
                } else {
                    obj.optBoolean("emailNotificationsEnabled", true)
                },
                profileCompleted = mobile.isNotBlank() && address.isNotBlank(),
                createdAt = obj.optString("created_at")
            )
        }

        private fun parseUserJson(raw: String): UserProfile? {
            if (raw.isBlank()) return null
            return try {
                parseUserObject(JSONObject(raw))
            } catch (_: Exception) {
                null
            }
        }

        private fun serializeUser(u: UserProfile): JSONObject = JSONObject().apply {
            put("id", u.userId.ifBlank { u.id })
            put("full_name", u.fullName)
            put("email", u.email)
            put("mobile_number", u.mobileNumber)
            put("full_address", u.fullAddress)
            put("role", u.accountRole)
            put("is_verified", u.isVerified)
            put("language_preference", u.languagePreference)
            put("bengali_numerals", u.bengaliNumerals)
            put("push_notifications_enabled", u.pushNotificationsEnabled)
            put("email_notifications_enabled", u.emailNotificationsEnabled)
            put("created_at", u.createdAt)
        }
    }
}
