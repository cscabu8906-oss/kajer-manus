package com.example.data

import com.example.auth.SessionManager
import com.example.i18n.AppLanguage
import kotlinx.coroutines.CancellationException
import org.json.JSONArray
import org.json.JSONObject

class KajerManushRepository(
    private val sessionManager: SessionManager,
    private val api: ApiClient = ApiClient()
) {
    private suspend fun requireToken(): String {
        return sessionManager.getToken()
            ?: throw IllegalStateException("Please sign in to continue.")
    }

    // ---------- Authentication & Forgot Password OTP ----------

    suspend fun login(identifier: String, password: String): Result<LoginOutcome> = runCatchingRest {
        val body = JSONObject().apply {
            put("identifier", identifier.trim())
            put("password", password)
        }
        val res = api.request("POST", "/auth/login", body = body)
        if (res.optBoolean("requires2fa", false)) {
            val tempToken = res.getString("tempToken")
            val email = res.optJSONObject("user")?.optString("email").orEmpty()
            LoginOutcome.TwoFactorRequired(tempToken = tempToken, email = email)
        } else {
            val token = res.getString("token")
            val user = SessionManager.parseUserObject(res.getJSONObject("user"))
            sessionManager.saveSession(token, user)
            LoginOutcome.Authenticated(user)
        }
    }

    suspend fun verifyAdmin2faLogin(tempToken: String, code: String): Result<UserProfile> = runCatchingRest {
        val body = JSONObject().apply {
            put("tempToken", tempToken)
            put("code", code.trim())
        }
        val res = api.request("POST", "/auth/admin/2fa/verify-login", body = body)
        val token = res.getString("token")
        val user = SessionManager.parseUserObject(res.getJSONObject("user"))
        sessionManager.saveSession(token, user)
        user
    }

    suspend fun register(
        fullName: String,
        email: String,
        mobileNumber: String,
        fullAddress: String,
        password: String,
        accountRole: String,
        languagePreference: AppLanguage,
        bengaliNumerals: Boolean
    ): Result<UserProfile> = runCatchingRest {
        val body = JSONObject().apply {
            put("fullName", fullName.trim())
            put("email", email.trim())
            put("mobileNumber", mobileNumber.trim())
            put("fullAddress", fullAddress.trim())
            put("password", password)
            put("accountRole", if (accountRole == "provider") "provider" else "customer")
            put("languagePreference", languagePreference.code)
            put("bengaliNumerals", bengaliNumerals)
        }
        val res = api.request("POST", "/auth/register", body = body)
        val token = res.getString("token")
        val user = SessionManager.parseUserObject(res.getJSONObject("user"))
        sessionManager.saveSession(token, user)
        user
    }

    suspend fun resendOtp(
        email: String,
        purpose: String = "password_reset",
        languagePreference: AppLanguage
    ): Result<String> = runCatchingRest {
        val body = JSONObject().apply {
            put("email", email.trim())
            put("purpose", purpose)
            put("languagePreference", languagePreference.code)
        }
        val res = api.request("POST", "/auth/resend-otp", body = body)
        res.optString("message", "OTP sent")
    }

    suspend fun forgotPassword(email: String, languagePreference: AppLanguage): Result<String> = runCatchingRest {
        val body = JSONObject().apply {
            put("email", email.trim())
            put("languagePreference", languagePreference.code)
        }
        val res = api.request("POST", "/auth/forgot-password", body = body)
        res.optString("message", "Reset OTP sent")
    }

    suspend fun resetPassword(email: String, otp: String, newPassword: String): Result<String> = runCatchingRest {
        val body = JSONObject().apply {
            put("email", email.trim())
            put("otp", otp.trim())
            put("newPassword", newPassword)
        }
        val res = api.request("POST", "/auth/reset-password", body = body)
        res.optString("message", "Password reset successful")
    }

    suspend fun logout() {
        try {
            val token = sessionManager.getToken()
            if (!token.isNullOrBlank()) {
                api.request("POST", "/auth/logout", token = token)
            }
        } catch (_: Exception) {
        } finally {
            sessionManager.clearSession()
        }
    }

    // ---------- User Profile, Preferences & Notifications ----------

    suspend fun fetchMe(): Result<UserProfile> = runCatchingRest {
        val token = requireToken()
        val res = api.request("GET", "/users/me", token = token)
        val user = SessionManager.parseUserObject(res.getJSONObject("user"))
        sessionManager.updateUser(user)
        user
    }

    suspend fun saveProfileDetails(
        fullName: String,
        mobileNumber: String,
        fullAddress: String,
        pushEnabled: Boolean? = null,
        emailEnabled: Boolean? = null
    ): Result<UserProfile> = runCatchingRest {
        val token = requireToken()
        val body = JSONObject().apply {
            put("fullName", fullName.trim().take(120))
            put("mobileNumber", mobileNumber.trim().take(20))
            put("fullAddress", fullAddress.trim().take(400))
            if (pushEnabled != null) put("pushNotificationsEnabled", pushEnabled)
            if (emailEnabled != null) put("emailNotificationsEnabled", emailEnabled)
        }
        val res = api.request("PATCH", "/users/me", token = token, body = body)
        val user = SessionManager.parseUserObject(res.getJSONObject("user"))
        sessionManager.updateUser(user)
        user
    }

    suspend fun syncLanguagePreference(
        language: AppLanguage,
        bengaliNumerals: Boolean
    ): Result<UserProfile> = runCatchingRest {
        val token = requireToken()
        val body = JSONObject().apply {
            put("languagePreference", language.code)
            put("bengaliNumerals", bengaliNumerals)
        }
        val res = api.request("PATCH", "/users/me/language", token = token, body = body)
        val user = SessionManager.parseUserObject(res.getJSONObject("user"))
        sessionManager.updateUser(user)
        user
    }

    suspend fun registerFcmToken(fcmToken: String): Result<Unit> = runCatchingRest {
        val token = requireToken()
        val body = JSONObject().apply {
            put("fcmToken", fcmToken)
            put("platform", "android")
        }
        api.request("POST", "/users/me/fcm-token", token = token, body = body)
    }

    suspend fun fetchNotifications(): Result<List<UserNotification>> = runCatchingRest {
        val token = requireToken()
        val res = api.request("GET", "/users/notifications", token = token)
        val arr = res.optJSONArray("notifications") ?: JSONArray()
        (0 until arr.length()).map { parseNotification(arr.getJSONObject(it)) }
    }

    suspend fun markNotificationRead(notificationId: String): Result<Unit> = runCatchingRest {
        val token = requireToken()
        api.request("PATCH", "/users/notifications/$notificationId/read", token = token)
    }

    // ---------- Services & Provider Profile ----------

    suspend fun fetchActiveServices(category: String? = null, query: String? = null): Result<List<ServiceOffering>> =
        runCatchingRest {
            val params = buildMap {
                if (!category.isNullOrBlank()) put("category", category)
                if (!query.isNullOrBlank()) put("q", query)
            }
            val res = api.request("GET", "/services", queryParams = params)
            val arr = res.optJSONArray("services") ?: JSONArray()
            (0 until arr.length()).map { parseService(arr.getJSONObject(it)) }
        }

    suspend fun fetchMyProviderProfile(): Result<ProviderProfile?> = runCatchingRest {
        val token = requireToken()
        val res = api.request("GET", "/provider/me", token = token)
        val obj = res.optJSONObject("profile")
        if (obj == null || res.isNull("profile")) null else parseProvider(obj)
    }

    suspend fun applyProviderProfile(
        bioBn: String,
        bioEn: String,
        serviceCategories: List<String>,
        serviceLocationBn: String,
        serviceLocationEn: String,
        experienceYears: Int,
        isAvailable: Boolean
    ): Result<ProviderProfile> = runCatchingRest {
        val token = requireToken()
        val body = JSONObject().apply {
            put("bioBn", bioBn.trim())
            put("bioEn", bioEn.trim())
            put("photoUrl", "")
            put("serviceCategories", JSONArray(serviceCategories))
            put("serviceLocationBn", serviceLocationBn.trim())
            put("serviceLocationEn", serviceLocationEn.trim())
            put("experienceYears", experienceYears.coerceIn(0, 60))
            put("isAvailable", isAvailable)
        }
        val res = api.request("POST", "/provider/apply", token = token, body = body)
        parseProvider(res.getJSONObject("profile"))
    }

    suspend fun toggleProviderAvailability(isAvailable: Boolean): Result<ProviderProfile> = runCatchingRest {
        val token = requireToken()
        val body = JSONObject().apply { put("isAvailable", isAvailable) }
        val res = api.request("PATCH", "/provider/me/availability", token = token, body = body)
        parseProvider(res.getJSONObject("profile"))
    }

    // ---------- Bookings, Reviews & Support ----------

    suspend fun createBooking(
        serviceId: String,
        customerName: String,
        customerPhone: String,
        serviceAddress: String,
        scheduledDate: String,
        scheduledSlot: String,
        notes: String,
        paymentMethod: String = "cash",
        language: AppLanguage
    ): Result<ServiceBooking> = runCatchingRest {
        val token = requireToken()
        val body = JSONObject().apply {
            put("serviceId", serviceId)
            put("customerName", customerName.trim())
            put("customerPhone", customerPhone.trim())
            put("serviceAddress", serviceAddress.trim())
            put("preferredDate", scheduledDate.trim())
            put("preferredTime", scheduledSlot.trim())
            put("instructions", notes.trim())
            put("paymentMethod", if (paymentMethod == "razorpay") "razorpay" else "cash")
            put("languageAtBooking", language.code)
        }
        val res = api.request("POST", "/bookings", token = token, body = body)
        parseBooking(res.getJSONObject("booking"))
    }

    suspend fun createRazorpayOrder(bookingId: String): Result<RazorpayOrderPayload> = runCatchingRest {
        val token = requireToken()
        val body = JSONObject().apply { put("bookingId", bookingId) }
        val res = api.request("POST", "/payments/razorpay/order", token = token, body = body)
        val prefill = res.optJSONObject("prefill") ?: JSONObject()
        RazorpayOrderPayload(
            bookingId = res.optString("bookingId", bookingId),
            orderId = res.getString("orderId"),
            amountPaise = res.getLong("amount"),
            currency = res.optString("currency", "INR"),
            keyId = res.getString("keyId"),
            serviceTitle = res.optString("serviceName", "Kajer Manus Service"),
            prefillName = prefill.optString("name"),
            prefillEmail = prefill.optString("email"),
            prefillContact = prefill.optString("contact")
        )
    }

    suspend fun verifyRazorpayPayment(
        bookingId: String,
        razorpayOrderId: String,
        razorpayPaymentId: String,
        razorpaySignature: String
    ): Result<ServiceBooking> = runCatchingRest {
        val token = requireToken()
        val body = JSONObject().apply {
            put("bookingId", bookingId)
            put("razorpayOrderId", razorpayOrderId)
            put("razorpayPaymentId", razorpayPaymentId)
            put("razorpaySignature", razorpaySignature)
        }
        val res = api.request("POST", "/payments/razorpay/verify", token = token, body = body)
        parseBooking(res.getJSONObject("booking"))
    }

    suspend fun fetchMyBookings(): Result<List<ServiceBooking>> = runCatchingRest {
        val token = requireToken()
        val res = api.request("GET", "/bookings/me", token = token)
        val arr = res.optJSONArray("bookings") ?: JSONArray()
        (0 until arr.length()).map { parseBooking(arr.getJSONObject(it)) }
    }

    suspend fun fetchProviderBookings(): Result<Pair<List<ServiceBooking>, Boolean>> = runCatchingRest {
        val token = requireToken()
        val res = api.request("GET", "/bookings/provider", token = token)
        val approved = res.optBoolean("approved", false)
        val arr = res.optJSONArray("bookings") ?: JSONArray()
        val list = (0 until arr.length()).map { parseBooking(arr.getJSONObject(it)) }
        list to approved
    }

    suspend fun updateBookingStatus(
        bookingId: String,
        newStatus: BookingStatus
    ): Result<ServiceBooking> = runCatchingRest {
        val token = requireToken()
        val body = JSONObject().apply { put("status", newStatus.key) }
        val res = api.request("PATCH", "/bookings/$bookingId/status", token = token, body = body)
        parseBooking(res.getJSONObject("booking"))
    }

    suspend fun submitReview(
        bookingId: String,
        rating: Int,
        comment: String
    ): Result<Unit> = runCatchingRest {
        val token = requireToken()
        val body = JSONObject().apply {
            put("bookingId", bookingId)
            put("rating", rating.coerceIn(1, 5))
            put("comment", comment.trim())
        }
        api.request("POST", "/reviews", token = token, body = body)
    }

    suspend fun submitSupportTicket(
        name: String,
        email: String,
        subject: String,
        message: String,
        language: AppLanguage
    ): Result<Unit> = runCatchingRest {
        val token = sessionManager.getToken()
        val body = JSONObject().apply {
            if (name.isNotBlank()) put("name", name.trim())
            if (email.isNotBlank()) put("email", email.trim())
            put("subject", subject.trim())
            put("message", message.trim())
            put("languageCode", language.code)
        }
        api.request("POST", "/support/contact", token = token, body = body)
    }

    // ---------- Admin Endpoints ----------

    suspend fun fetchAdminStats(): Result<AdminStats> = runCatchingRest {
        val token = requireToken()
        val res = api.request("GET", "/admin/stats", token = token)
        val s = res.getJSONObject("stats")
        AdminStats(
            totalUsers = s.optInt("totalUsers"),
            pendingProviders = s.optInt("pendingProviders"),
            totalBookings = s.optInt("totalBookings"),
            pendingBookings = s.optInt("pendingBookings"),
            paidBookings = s.optInt("paidBookings"),
            paidRevenueInr = s.optLong("paidRevenueInr"),
            totalCategories = s.optInt("totalCategories", 12),
            openComplaints = s.optInt("openComplaints")
        )
    }

    suspend fun fetchAdmin2faStatus(): Result<AdminTwoFactorStatus> = runCatchingRest {
        val token = requireToken()
        val res = api.request("GET", "/admin/2fa/status", token = token)
        AdminTwoFactorStatus(
            enabled = res.optBoolean("enabled", false),
            backupCodesRemaining = res.optInt("backupCodesRemaining", 0)
        )
    }

    suspend fun startAdmin2faSetup(): Result<AdminTwoFactorSetup> = runCatchingRest {
        val token = requireToken()
        val res = api.request("POST", "/admin/2fa/setup", token = token)
        AdminTwoFactorSetup(
            secretBase32 = res.getString("secretBase32"),
            otpauthUrl = res.getString("otpauthUrl")
        )
    }

    suspend fun confirmAdmin2fa(code: String): Result<List<String>> = runCatchingRest {
        val token = requireToken()
        val body = JSONObject().apply { put("code", code.trim()) }
        val res = api.request("POST", "/admin/2fa/confirm", token = token, body = body)
        val arr = res.optJSONArray("backupCodes") ?: JSONArray()
        (0 until arr.length()).map { arr.optString(it) }.filter { it.isNotBlank() }
    }

    suspend fun disableAdmin2fa(password: String, code: String): Result<Unit> = runCatchingRest {
        val token = requireToken()
        val body = JSONObject().apply {
            put("password", password)
            put("code", code.trim())
        }
        api.request("POST", "/admin/2fa/disable", token = token, body = body)
    }

    suspend fun fetchAdminProviders(): Result<List<ProviderProfile>> = runCatchingRest {
        val token = requireToken()
        val res = api.request("GET", "/admin/providers", token = token)
        val arr = res.optJSONArray("providers") ?: JSONArray()
        (0 until arr.length()).map { parseProvider(arr.getJSONObject(it)) }
    }

    suspend fun approveProviderAdmin(providerProfileId: String, decision: String): Result<Unit> = runCatchingRest {
        val token = requireToken()
        val body = JSONObject().apply { put("decision", decision) }
        api.request("PATCH", "/admin/providers/$providerProfileId/approve", token = token, body = body)
    }

    suspend fun fetchAdminBookings(): Result<List<ServiceBooking>> = runCatchingRest {
        val token = requireToken()
        val res = api.request("GET", "/admin/bookings", token = token)
        val arr = res.optJSONArray("bookings") ?: JSONArray()
        (0 until arr.length()).map { parseBooking(arr.getJSONObject(it)) }
    }

    suspend fun updateBookingPaymentAdmin(
        bookingId: String,
        paymentStatus: PaymentStatus,
        paymentMethod: PaymentMethod? = null
    ): Result<ServiceBooking> = runCatchingRest {
        val token = requireToken()
        val body = JSONObject().apply {
            put("paymentStatus", paymentStatus.key)
            if (paymentMethod != null) put("paymentMethod", paymentMethod.key)
        }
        val res = api.request("PATCH", "/admin/bookings/$bookingId/payment", token = token, body = body)
        parseBooking(res.getJSONObject("booking"))
    }

    suspend fun fetchAdminUsers(): Result<List<UserProfile>> = runCatchingRest {
        val token = requireToken()
        val res = api.request("GET", "/admin/users", token = token)
        val arr = res.optJSONArray("users") ?: JSONArray()
        (0 until arr.length()).map { SessionManager.parseUserObject(arr.getJSONObject(it)) }
    }

    suspend fun updateUserAdmin(
        userId: String,
        fullName: String,
        email: String,
        mobileNumber: String,
        fullAddress: String,
        role: String,
        isVerified: Boolean,
        newPassword: String? = null
    ): Result<UserProfile> = runCatchingRest {
        val token = requireToken()
        val body = JSONObject().apply {
            put("fullName", fullName.trim())
            put("email", email.trim())
            put("mobileNumber", mobileNumber.trim())
            put("fullAddress", fullAddress.trim())
            put("role", role)
            put("isVerified", isVerified)
            if (!newPassword.isNullOrBlank()) put("newPassword", newPassword)
        }
        val res = api.request("PATCH", "/admin/users/$userId", token = token, body = body)
        SessionManager.parseUserObject(res.getJSONObject("user"))
    }

    suspend fun deleteUserAdmin(userId: String): Result<Unit> = runCatchingRest {
        val token = requireToken()
        api.request("DELETE", "/admin/users/$userId", token = token)
    }

    suspend fun saveServiceAdmin(service: ServiceOffering, isNew: Boolean): Result<ServiceOffering> =
        runCatchingRest {
            val token = requireToken()
            val body = JSONObject().apply {
                if (!isNew && service.id.isNotBlank()) put("id", service.id)
                put("categorySlug", service.categoryKey)
                put("titleBn", service.titleBn.trim())
                put("titleEn", service.titleEn.trim())
                put("descriptionBn", service.descriptionBn.trim())
                put("descriptionEn", service.descriptionEn.trim())
                put("providerNameBn", service.providerNameBn.ifBlank { "কাজের মানুষ কর্মী" })
                put("providerNameEn", service.providerNameEn.ifBlank { "Kajer Manus Pro" })
                put("areaBn", service.providerAreaBn.ifBlank { "কলকাতা" })
                put("areaEn", service.providerAreaEn.ifBlank { "Kolkata" })
                put("basePriceInr", service.basePriceInr.coerceAtLeast(0L))
                put("durationMinutes", service.durationMinutes.coerceAtLeast(15L))
                put("isActive", service.active)
            }
            val res = api.request("POST", "/admin/services", token = token, body = body)
            parseService(res.getJSONObject("service"))
        }

    // ---------- JSON Parsers & Helper ----------

    private suspend fun <T> runCatchingRest(block: suspend () -> T): Result<T> {
        return try {
            Result.success(block())
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private fun parseService(o: JSONObject): ServiceOffering = ServiceOffering(
        id = o.optString("id"),
        categoryKey = o.optString("category_slug", "electrician"),
        titleBn = o.optString("title_bn"),
        titleEn = o.optString("title_en"),
        descriptionBn = o.optString("description_bn"),
        descriptionEn = o.optString("description_en"),
        providerNameBn = o.optString("provider_name_bn"),
        providerNameEn = o.optString("provider_name_en"),
        providerAreaBn = o.optString("area_bn"),
        providerAreaEn = o.optString("area_en"),
        providerId = o.optString("provider_user_id"),
        basePriceInr = o.optLong("base_price_inr"),
        durationMinutes = o.optLong("duration_minutes", 60L),
        rating = o.optDouble("rating", 4.8),
        active = o.optBoolean("is_active", true)
    )

    private fun parseBooking(o: JSONObject): ServiceBooking = ServiceBooking(
        id = o.optString("id"),
        customerId = o.optString("customer_id"),
        customerName = o.optString("customer_name"),
        customerPhone = o.optString("customer_phone"),
        serviceAddress = o.optString("service_address"),
        serviceId = o.optString("service_id"),
        serviceTitleBn = o.optString("service_title_bn"),
        serviceTitleEn = o.optString("service_title_en"),
        categoryKey = o.optString("category_slug", "electrician"),
        providerId = o.optString("provider_id"),
        providerNameBn = o.optString("provider_name_bn"),
        providerNameEn = o.optString("provider_name_en"),
        scheduledDate = o.optString("preferred_date"),
        scheduledSlot = o.optString("preferred_time"),
        amountInr = o.optLong("amount_inr"),
        paymentMethod = o.optString("payment_method", "cash"),
        paymentStatus = o.optString("payment_status", "unpaid"),
        razorpayOrderId = o.optString("razorpay_order_id"),
        razorpayPaymentId = o.optString("razorpay_payment_id"),
        paidAt = o.optString("paid_at"),
        notes = o.optString("instructions"),
        status = o.optString("status", "pending"),
        languageAtBooking = o.optString("language_at_booking", "bn"),
        hasReview = o.optBoolean("has_review", false),
        createdAt = o.optString("created_at")
    )

    private fun parseNotification(o: JSONObject): UserNotification = UserNotification(
        id = o.optString("id"),
        userId = o.optString("user_id"),
        titleBn = o.optString("title_bn"),
        titleEn = o.optString("title_en"),
        bodyBn = o.optString("body_bn"),
        bodyEn = o.optString("body_en"),
        bookingId = o.optString("booking_id"),
        type = o.optString("type", "system"),
        readFlag = o.optBoolean("is_read", false),
        languageCode = o.optString("language_code", "bn"),
        createdAt = o.optString("created_at")
    )

    private fun parseProvider(o: JSONObject): ProviderProfile {
        val catsArr = o.optJSONArray("service_categories") ?: JSONArray()
        val cats = (0 until catsArr.length()).map { catsArr.optString(it) }.filter { it.isNotBlank() }
        return ProviderProfile(
            id = o.optString("id"),
            userId = o.optString("user_id"),
            fullName = o.optString("full_name"),
            email = o.optString("email"),
            mobileNumber = o.optString("mobile_number"),
            bioBn = o.optString("bio_bn"),
            bioEn = o.optString("bio_en"),
            photoUrl = o.optString("photo_url"),
            serviceCategories = cats,
            serviceLocationBn = o.optString("service_location_bn"),
            serviceLocationEn = o.optString("service_location_en"),
            experienceYears = o.optInt("experience_years", 1),
            isAvailable = o.optBoolean("is_available", true),
            isApproved = o.optBoolean("is_approved", false),
            approvalStatus = o.optString("approval_status", "pending"),
            ratingAvg = o.optDouble("rating_avg", 5.0),
            reviewsCount = o.optInt("reviews_count", 0),
            completedJobs = o.optInt("completed_jobs", 0)
        )
    }
}
