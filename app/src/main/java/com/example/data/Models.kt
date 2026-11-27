package com.example.data

import com.example.i18n.AppLanguage

enum class ServiceCategory(val key: String, val i18nKey: String) {
    ELECTRICIAN("electrician", "categories.electrician"),
    PLUMBER("plumber", "categories.plumber"),
    AC_REPAIR("ac_repair", "categories.ac_repair"),
    HOME_CLEANING("home_cleaning", "categories.home_cleaning"),
    CARPENTER("carpenter", "categories.carpenter"),
    PAINTER("painter", "categories.painter"),
    APPLIANCE_REPAIR("appliance_repair", "categories.appliance_repair"),
    INTERNET_TECHNICIAN("internet_technician", "categories.internet_technician"),
    CONSTRUCTION_WORKER("construction_worker", "categories.construction_worker"),
    DRIVER("driver", "categories.driver"),
    GARDENING("gardening", "categories.gardening"),
    OTHER_SERVICES("other_services", "categories.other_services");

    companion object {
        fun fromKey(raw: String?): ServiceCategory =
            entries.firstOrNull { it.key == raw } ?: ELECTRICIAN
    }
}

enum class BookingStatus(val key: String, val i18nKey: String) {
    PENDING("pending", "booking.pending"),
    ACCEPTED("accepted", "booking.accepted"),
    REJECTED("rejected", "booking.rejected"),
    IN_PROGRESS("in_progress", "booking.in_progress"),
    COMPLETED("completed", "booking.completed"),
    CANCELLED("cancelled", "booking.cancelled");

    companion object {
        fun fromKey(raw: String?): BookingStatus =
            entries.firstOrNull { it.key == raw } ?: PENDING
    }
}

data class UserProfile(
    val id: String = "",
    val userId: String = "",
    val fullName: String = "",
    val email: String = "",
    val mobileNumber: String = "",
    val fullAddress: String = "",
    val accountRole: String = "customer",
    val isVerified: Boolean = true,
    val languagePreference: String = "bn",
    val bengaliNumerals: Boolean = true,
    val pushNotificationsEnabled: Boolean = true,
    val emailNotificationsEnabled: Boolean = true,
    val profileCompleted: Boolean = true,
    val createdAt: String = ""
)

data class ProviderProfile(
    val id: String = "",
    val userId: String = "",
    val fullName: String = "",
    val email: String = "",
    val mobileNumber: String = "",
    val bioBn: String = "",
    val bioEn: String = "",
    val photoUrl: String = "",
    val serviceCategories: List<String> = emptyList(),
    val serviceLocationBn: String = "",
    val serviceLocationEn: String = "",
    val experienceYears: Int = 1,
    val isAvailable: Boolean = true,
    val isApproved: Boolean = false,
    val approvalStatus: String = "pending",
    val ratingAvg: Double = 5.0,
    val reviewsCount: Int = 0,
    val completedJobs: Int = 0
)

data class ServiceOffering(
    val id: String = "",
    val categoryKey: String = "electrician",
    val titleBn: String = "",
    val titleEn: String = "",
    val descriptionBn: String = "",
    val descriptionEn: String = "",
    val providerNameBn: String = "",
    val providerNameEn: String = "",
    val providerAreaBn: String = "",
    val providerAreaEn: String = "",
    val providerId: String = "",
    val basePriceInr: Long = 0L,
    val durationMinutes: Long = 60L,
    val rating: Double = 4.8,
    val active: Boolean = true
) {
    fun localizedTitle(lang: AppLanguage): String =
        if (lang == AppLanguage.BN) titleBn.ifBlank { titleEn } else titleEn.ifBlank { titleBn }

    fun localizedDescription(lang: AppLanguage): String =
        if (lang == AppLanguage.BN) descriptionBn.ifBlank { descriptionEn } else descriptionEn.ifBlank { descriptionBn }

    fun localizedProviderName(lang: AppLanguage): String =
        if (lang == AppLanguage.BN) providerNameBn.ifBlank { providerNameEn } else providerNameEn.ifBlank { providerNameBn }

    fun localizedArea(lang: AppLanguage): String =
        if (lang == AppLanguage.BN) providerAreaBn.ifBlank { providerAreaEn } else providerAreaEn.ifBlank { providerAreaBn }
}

data class ServiceBooking(
    val id: String = "",
    val customerId: String = "",
    val customerName: String = "",
    val customerPhone: String = "",
    val serviceAddress: String = "",
    val serviceId: String = "",
    val serviceTitleBn: String = "",
    val serviceTitleEn: String = "",
    val categoryKey: String = "electrician",
    val providerId: String = "",
    val providerNameBn: String = "",
    val providerNameEn: String = "",
    val scheduledDate: String = "",
    val scheduledSlot: String = "",
    val amountInr: Long = 0L,
    val notes: String = "",
    val status: String = "pending",
    val languageAtBooking: String = "bn",
    val hasReview: Boolean = false,
    val createdAt: String = ""
) {
    fun localizedServiceTitle(lang: AppLanguage): String =
        if (lang == AppLanguage.BN) serviceTitleBn.ifBlank { serviceTitleEn } else serviceTitleEn.ifBlank { serviceTitleBn }

    fun localizedProviderName(lang: AppLanguage): String =
        if (lang == AppLanguage.BN) providerNameBn.ifBlank { providerNameEn } else providerNameEn.ifBlank { providerNameBn }

    val statusEnum: BookingStatus
        get() = BookingStatus.fromKey(status)
}

data class UserNotification(
    val id: String = "",
    val userId: String = "",
    val titleBn: String = "",
    val titleEn: String = "",
    val bodyBn: String = "",
    val bodyEn: String = "",
    val bookingId: String = "",
    val type: String = "booking_status",
    val readFlag: Boolean = false,
    val languageCode: String = "bn",
    val createdAt: String = ""
) {
    fun localizedTitle(lang: AppLanguage): String =
        if (lang == AppLanguage.BN) titleBn.ifBlank { titleEn } else titleEn.ifBlank { titleBn }

    fun localizedBody(lang: AppLanguage): String =
        if (lang == AppLanguage.BN) bodyBn.ifBlank { bodyEn } else bodyEn.ifBlank { bodyBn }
}

data class AdminStats(
    val totalUsers: Int = 0,
    val pendingProviders: Int = 0,
    val totalBookings: Int = 0,
    val pendingBookings: Int = 0,
    val totalCategories: Int = 12,
    val openComplaints: Int = 0
)

data class AuthSession(
    val token: String = "",
    val user: UserProfile? = null
) {
    val isAuthenticated: Boolean
        get() = token.isNotBlank() && user != null && user.userId.isNotBlank()
}
