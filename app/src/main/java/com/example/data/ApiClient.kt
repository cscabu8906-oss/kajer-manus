package com.example.data

import com.example.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.BufferedReader
import java.io.IOException
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.ConnectException
import java.net.HttpURLConnection
import java.net.SocketTimeoutException
import java.net.URL
import java.net.URLEncoder
import java.net.UnknownHostException
import javax.net.ssl.SSLException

class ApiException(
    val statusCode: Int,
    override val message: String,
    val errorCode: String = "",
    val emailHint: String = ""
) : Exception(message)

class ApiClient(
    private val baseUrlProvider: () -> String = { BuildConfig.API_BASE_URL }
) {
    suspend fun request(
        method: String,
        path: String,
        token: String? = null,
        body: JSONObject? = null,
        queryParams: Map<String, String> = emptyMap()
    ): JSONObject = withContext(Dispatchers.IO) {
        val base = baseUrlProvider().trimEnd('/')
        val cleanPath = if (path.startsWith("/")) path else "/$path"
        val querySuffix = if (queryParams.isEmpty()) {
            ""
        } else {
            queryParams.entries
                .filter { it.value.isNotBlank() }
                .joinToString(prefix = "?", separator = "&") { (k, v) ->
                    "${URLEncoder.encode(k, "UTF-8")}=${URLEncoder.encode(v, "UTF-8")}"
                }
        }

        val url = URL("$base$cleanPath$querySuffix")
        val conn = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 15_000
            readTimeout = 20_000
            setRequestProperty("Accept", "application/json")
            if (!token.isNullOrBlank()) {
                setRequestProperty("Authorization", "Bearer $token")
            }
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=UTF-8")
            }
        }

        try {
            if (body != null) {
                OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { writer ->
                    writer.write(body.toString())
                    writer.flush()
                }
            }

            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            val rawResponse = if (stream != null) {
                BufferedReader(InputStreamReader(stream, Charsets.UTF_8)).use { it.readText() }
            } else {
                "{}"
            }

            val parsed = try {
                if (rawResponse.isBlank()) JSONObject() else JSONObject(rawResponse)
            } catch (_: Exception) {
                JSONObject().put("raw", rawResponse)
            }

            if (code !in 200..299) {
                val msg = parsed.optString("error")
                    .ifBlank { parsed.optString("message") }
                    .ifBlank { "HTTP $code" }
                throw ApiException(
                    statusCode = code,
                    message = msg,
                    errorCode = parsed.optString("code"),
                    emailHint = parsed.optString("email")
                )
            }

            parsed
        } catch (e: ApiException) {
            throw e
        } catch (e: SSLException) {
            val detail = e.message.orEmpty()
            val friendly = if (detail.contains("UNRECOGNIZED_NAME", ignoreCase = true)) {
                "SSL certificate for ${url.host} is not active on the server yet (TLS SNI unrecognized name). Configure Nginx + Certbot SSL for ${url.host} on your Hostinger VPS."
            } else {
                "Secure SSL connection to ${url.host} failed. Please verify the server SSL certificate."
            }
            throw ApiException(statusCode = 0, message = friendly, errorCode = "SSL_ERROR")
        } catch (_: UnknownHostException) {
            throw ApiException(
                statusCode = 0,
                message = "Cannot reach ${url.host}. Check internet connection and DNS A record.",
                errorCode = "DNS_ERROR"
            )
        } catch (_: ConnectException) {
            throw ApiException(
                statusCode = 0,
                message = "Connection refused by ${url.host}. Ensure the backend API and Nginx are running.",
                errorCode = "CONNECT_ERROR"
            )
        } catch (_: SocketTimeoutException) {
            throw ApiException(
                statusCode = 0,
                message = "Server request timed out. Please try again.",
                errorCode = "TIMEOUT_ERROR"
            )
        } catch (e: IOException) {
            throw ApiException(
                statusCode = 0,
                message = e.localizedMessage ?: "Network error while connecting to ${url.host}.",
                errorCode = "NETWORK_ERROR"
            )
        } finally {
            conn.disconnect()
        }
    }
}
