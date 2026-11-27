package com.example.data

import androidx.annotation.Keep
import com.example.i18n.AppLanguage
import com.google.firebase.Timestamp
import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.IgnoreExtraProperties
import com.google.firebase.firestore.ServerTimestamp

enum class ServiceCategory(val key: String, val i18nKey: String) {
    ELECTRICIAN("electrician", "categories.electrician"),
    PLUMBER("plumber", "categories.plumber"),
    AC_REPAIR("ac_repair", "categories.ac_repair"),
    HOME_CLEANING("home_cleaning", "categories.home_cleaning"),
    CARPENTER("carpenter", "categories.carpenter"),
    PAINTER("painter", "categories.painter"),
    APPLIANCE_REPAIR("appliance_repair", "categories.appliance_repair"),
    GARDENING("gardening", "categories.gardening");

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

data class PendingSignUpDraft(
    val fullName: String = "",
    val email: String = "",
    val mobileNumber: String = "",
    val fullAddress: String = "",
    val accountRole: String = "customer"
)

@Keep
@IgnoreExtraProperties
data class UserProfile(
    @DocumentId val id: String = "",
    val userId: String = "",
    val fullName: String = "",
    val email: String = "",
    val mobileNumber: String = "",
    val fullAddress: String = "",
    val accountRole: String = "customer",
    val languagePreference: String = "bn",
    val bengaliNumerals: Boolean = true,
    val pushNotificationsEnabled: Boolean = true,
    val emailNotificationsEnabled: Boolean = true,
    val profileCompleted: Boolean = false,
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
)

@Keep
@IgnoreExtraProperties
data class ServiceOffering(
    @DocumentId val id: String = "",
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
    val active: Boolean = true,
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
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

@Keep
@IgnoreExtraProperties
data class ServiceBooking(
    @DocumentId val id: String = "",
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
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
) {
    fun localizedServiceTitle(lang: AppLanguage): String =
        if (lang == AppLanguage.BN) serviceTitleBn.ifBlank { serviceTitleEn } else serviceTitleEn.ifBlank { serviceTitleBn }

    fun localizedProviderName(lang: AppLanguage): String =
        if (lang == AppLanguage.BN) providerNameBn.ifBlank { providerNameEn } else providerNameEn.ifBlank { providerNameBn }

    val statusEnum: BookingStatus
        get() = BookingStatus.fromKey(status)
}

@Keep
@IgnoreExtraProperties
data class UserNotification(
    @DocumentId val id: String = "",
    val userId: String = "",
    val titleBn: String = "",
    val titleEn: String = "",
    val bodyBn: String = "",
    val bodyEn: String = "",
    val bookingId: String = "",
    val type: String = "booking_status",
    val readFlag: Boolean = false,
    val languageCode: String = "bn",
    @ServerTimestamp val createdAt: Timestamp? = null
) {
    fun localizedTitle(lang: AppLanguage): String =
        if (lang == AppLanguage.BN) titleBn.ifBlank { titleEn } else titleEn.ifBlank { titleBn }

    fun localizedBody(lang: AppLanguage): String =
        if (lang == AppLanguage.BN) bodyBn.ifBlank { bodyEn } else bodyEn.ifBlank { bodyBn }
}

object DefaultServiceCatalog {
    val items: List<ServiceOffering> = listOf(
        ServiceOffering(
            id = "svc_electrician_1",
            categoryKey = "electrician",
            titleBn = "বাড়ির ওয়্যারিং, এমসিবি ও ফ্যান মেরামত",
            titleEn = "Home Wiring, MCB & Fan Repair",
            descriptionBn = "দক্ষ ইলেকট্রিশিয়ান দ্বারা সুইচবোর্ড, সিলিং ফ্যান, ইনভার্টার এবং নিরাপদ ওয়্যারিং পরীক্ষা ও মেরামত।",
            descriptionEn = "Certified electrician for switchboards, ceiling fans, inverter wiring, and circuit safety checks.",
            providerNameBn = "সুমন দত্ত",
            providerNameEn = "Suman Dutta",
            providerAreaBn = "সল্টলেক ও নিউটাউন, কলকাতা",
            providerAreaEn = "Salt Lake & New Town, Kolkata",
            providerId = "demo_provider_elec",
            basePriceInr = 249L,
            durationMinutes = 45L,
            rating = 4.9,
            active = true
        ),
        ServiceOffering(
            id = "svc_plumber_1",
            categoryKey = "plumber",
            titleBn = "জলের কল, পাইপ লিকেজ ও বেসিন মেরামত",
            titleEn = "Tap, Pipe Leakage & Basin Repair",
            descriptionBn = "বাথরুম ও রান্নাঘরের পাইপ লিকেজ বন্ধ, নতুন কল লাগানো ও ওভারহেড ট্যাঙ্ক পরিষ্কার ও ফিটিং।",
            descriptionEn = "Bathroom and kitchen leak repair, tap installation, drainage unclogging, and tank fitting.",
            providerNameBn = "তাপস মণ্ডল",
            providerNameEn = "Tapas Mondal",
            providerAreaBn = "যাদবপুর ও গড়িয়া, কলকাতা",
            providerAreaEn = "Jadavpur & Garia, Kolkata",
            providerId = "demo_provider_plumb",
            basePriceInr = 299L,
            durationMinutes = 60L,
            rating = 4.8,
            active = true
        ),
        ServiceOffering(
            id = "svc_ac_repair_1",
            categoryKey = "ac_repair",
            titleBn = "স্প্লিট ও উইন্ডো এসি সার্ভিসিং ও গ্যাস রিফিল",
            titleEn = "Split & Window AC Servicing & Gas Refill",
            descriptionBn = "ফোম জেট ক্লিনিং, কুলিং কয়েল পরিষ্কার, গ্যাস চেকআপ ও সম্পূর্ণ এসি রক্ষণাবেক্ষণ সেবা।",
            descriptionEn = "Foam-jet deep cleaning, cooling coil maintenance, gas pressure check, and complete AC repair.",
            providerNameBn = "অরিজিৎ সেন",
            providerNameEn = "Arijit Sen",
            providerAreaBn = "বেহালা ও টালিগঞ্জ, কলকাতা",
            providerAreaEn = "Behala & Tollygunge, Kolkata",
            providerId = "demo_provider_ac",
            basePriceInr = 549L,
            durationMinutes = 75L,
            rating = 4.9,
            active = true
        ),
        ServiceOffering(
            id = "svc_cleaning_1",
            categoryKey = "home_cleaning",
            titleBn = "সম্পূর্ণ বাড়ি ও রান্নাঘর ডিপ ক্লিনিং",
            titleEn = "Full Home & Kitchen Deep Cleaning",
            descriptionBn = "পরিবেশ-বান্ধব জীবাণুনাশক ব্যবহার করে মেঝে, বাথরুম, জানালা ও রান্নাঘরের তেলকালি পরিষ্কার।",
            descriptionEn = "Deep sanitization of floors, bathrooms, windows, and kitchen grease using eco-safe cleaners.",
            providerNameBn = "মৌসুমী বিশ্বাস",
            providerNameEn = "Mousumi Biswas",
            providerAreaBn = "বালিগঞ্জ ও ভবানীপুর, কলকাতা",
            providerAreaEn = "Ballygunge & Bhawanipur, Kolkata",
            providerId = "demo_provider_clean",
            basePriceInr = 999L,
            durationMinutes = 180L,
            rating = 4.9,
            active = true
        ),
        ServiceOffering(
            id = "svc_carpenter_1",
            categoryKey = "carpenter",
            titleBn = "দরজা, আলমারি ও আসবাব মেরামত",
            titleEn = "Door, Wardrobe & Furniture Repair",
            descriptionBn = "দরজার কব্জা, তালা, কাঠের আলমারি, ড্রয়ার চ্যানেল এবং কাস্টম আসবাব তৈরির কাজ।",
            descriptionEn = "Door hinges, locks, wardrobe channels, wooden furniture restoration, and custom woodwork.",
            providerNameBn = "রতন কর্মকার",
            providerNameEn = "Ratan Karmakar",
            providerAreaBn = "হাওড়া ও শ্যামবাজার",
            providerAreaEn = "Howrah & Shyambazar",
            providerId = "demo_provider_carp",
            basePriceInr = 349L,
            durationMinutes = 90L,
            rating = 4.7,
            active = true
        ),
        ServiceOffering(
            id = "svc_painter_1",
            categoryKey = "painter",
            titleBn = "ঘরের দেয়াল রং ও ড্যাম্প প্রুফিং",
            titleEn = "Interior Wall Painting & Damp Proofing",
            descriptionBn = "পুট্টি, প্রাইমার এবং ড্যাম্প-প্রুফ ইমালশন পেইন্টের মাধ্যমে ঘরের দেয়াল নতুন করে সাজান।",
            descriptionEn = "Wall putty, primer, damp-proofing treatment, and smooth emulsion painting by trained painters.",
            providerNameBn = "বিপ্লব পাল",
            providerNameEn = "Biplab Pal",
            providerAreaBn = "দমদম ও বারাসাত",
            providerAreaEn = "Dum Dum & Barasat",
            providerId = "demo_provider_paint",
            basePriceInr = 1499L,
            durationMinutes = 240L,
            rating = 4.8,
            active = true
        ),
        ServiceOffering(
            id = "svc_appliance_1",
            categoryKey = "appliance_repair",
            titleBn = "ফ্রিজ, ওয়াশিং মেশিন ও মাইক্রোওয়েভ মেরামত",
            titleEn = "Fridge, Washing Machine & Microwave Repair",
            descriptionBn = "সকল ব্র্যান্ডের রেফ্রিজারেটর, অটোমেটিক ওয়াশিং মেশিন এবং মাইক্রোওয়েভ ওভেন দ্রুত মেরামত।",
            descriptionEn = "Expert diagnostics and repair for refrigerators, automatic washing machines, and microwaves.",
            providerNameBn = "সৌরভ বসু",
            providerNameEn = "Sourav Bose",
            providerAreaBn = "পার্ক স্ট্রিট ও কসবা, কলকাতা",
            providerAreaEn = "Park Street & Kasba, Kolkata",
            providerId = "demo_provider_app",
            basePriceInr = 399L,
            durationMinutes = 60L,
            rating = 4.8,
            active = true
        ),
        ServiceOffering(
            id = "svc_gardening_1",
            categoryKey = "gardening",
            titleBn = "ছাদবাগান ও ঘরের গাছ পরিচর্যা",
            titleEn = "Terrace Garden & Plant Maintenance",
            descriptionBn = "টবের মাটি পরিবর্তন, জৈব সার প্রয়োগ, গাছ ছাঁটাই এবং নতুন ছাদবাগান তৈরি ও দেখভাল।",
            descriptionEn = "Soil repotting, organic fertilizing, pruning, and full rooftop garden setup & care.",
            providerNameBn = "প্রদীপ মালিক",
            providerNameEn = "Pradip Malik",
            providerAreaBn = "রাজারহাট ও চন্দননগর",
            providerAreaEn = "Rajarhat & Chandannagar",
            providerId = "demo_provider_garden",
            basePriceInr = 449L,
            durationMinutes = 90L,
            rating = 4.9,
            active = true
        )
    )
}
