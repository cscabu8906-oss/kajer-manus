package com.example.data

import android.content.Context
import com.example.R
import com.example.i18n.AppLanguage
import com.google.firebase.Firebase
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.auth
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FirebaseFirestoreException
import com.google.firebase.firestore.snapshots
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.emitAll
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.tasks.await

class KajerManushRepository(
    private val db: FirebaseFirestore,
    private val auth: FirebaseAuth = Firebase.auth
) {
    constructor(context: Context) : this(
        FirebaseFirestore.getInstance(
            context.applicationContext.getString(R.string.firestore_database_id)
        )
    )

    private fun requireUserId(): String {
        return auth.currentUser?.uid
            ?: throw IllegalStateException("User must be signed in with Google before accessing Firestore.")
    }

    suspend fun checkIsAdmin(uid: String): Boolean {
        val currentEmail = auth.currentUser?.email
        val emailVerified = auth.currentUser?.isEmailVerified == true
        if (emailVerified && currentEmail.equals("cscabu8906@gmail.com", ignoreCase = true)) {
            return true
        }
        return try {
            val doc = db.collection("admins").document(uid).get().await()
            doc.exists()
        } catch (e: CancellationException) {
            throw e
        } catch (_: Exception) {
            false
        }
    }

    fun observeUserProfile(userId: String): Flow<UserProfile?> = flow {
        val uid = requireUserId()
        check(uid == userId) { "User ID mismatch" }
        val docRef = db.collection("users").document(uid)
        emitAll(
            docRef.snapshots()
                .map { snapshot ->
                    if (snapshot.exists()) {
                        snapshot.toObject(UserProfile::class.java, DocumentSnapshot.ServerTimestampBehavior.ESTIMATE)
                    } else null
                }
                .catch { error ->
                    val fsErr = generateSequence(error) { it.cause }
                        .filterIsInstance<FirebaseFirestoreException>()
                        .firstOrNull()
                    if (fsErr == null && error is CancellationException) throw error
                    val toLog = fsErr ?: (error as? Exception)
                    if (toLog != null && auth.currentUser?.uid == uid) {
                        handleFirestoreError(toLog, OperationType.GET, docRef.path)
                    }
                    throw error
                }
        )
    }

    suspend fun ensureUserProfile(
        uid: String,
        displayName: String,
        email: String,
        preferredLanguage: AppLanguage,
        bengaliNumerals: Boolean,
        signUpDraft: PendingSignUpDraft? = null
    ): Result<UserProfile> {
        val docPath = "users/$uid"
        return try {
            val currentUid = requireUserId()
            check(currentUid == uid) { "Signed-in user mismatch" }
            val docRef = db.collection("users").document(uid)
            val existingSnap = docRef.get().await()
            if (existingSnap.exists()) {
                val profile = existingSnap.toObject(
                    UserProfile::class.java,
                    DocumentSnapshot.ServerTimestampBehavior.ESTIMATE
                ) ?: UserProfile(userId = uid, fullName = displayName, email = email)
                if (signUpDraft != null && !profile.profileCompleted) {
                    val safeRole = if (signUpDraft.accountRole == "provider") "provider" else "customer"
                    val resolvedName = signUpDraft.fullName.trim().ifBlank { profile.fullName }.take(80)
                    docRef.update(
                        mapOf(
                            "fullName" to resolvedName,
                            "mobileNumber" to signUpDraft.mobileNumber.trim().take(20),
                            "fullAddress" to signUpDraft.fullAddress.trim().take(250),
                            "accountRole" to safeRole,
                            "languagePreference" to preferredLanguage.code,
                            "bengaliNumerals" to bengaliNumerals,
                            "profileCompleted" to true,
                            "updatedAt" to FieldValue.serverTimestamp()
                        )
                    ).await()
                    Result.success(
                        profile.copy(
                            fullName = resolvedName,
                            mobileNumber = signUpDraft.mobileNumber.trim().take(20),
                            fullAddress = signUpDraft.fullAddress.trim().take(250),
                            accountRole = safeRole,
                            languagePreference = preferredLanguage.code,
                            bengaliNumerals = bengaliNumerals,
                            profileCompleted = true
                        )
                    )
                } else {
                    Result.success(profile)
                }
            } else {
                val safeName = (signUpDraft?.fullName?.trim()?.takeIf { it.isNotBlank() } ?: displayName.trim())
                    .ifBlank { "Kajer Manush User" }.take(80)
                val safeEmail = email.trim()
                    .ifBlank { signUpDraft?.email?.trim().orEmpty() }
                    .ifBlank { "user@kajermanus.in" }.take(120)
                val safeMobile = signUpDraft?.mobileNumber?.trim().orEmpty().take(20)
                val safeAddress = signUpDraft?.fullAddress?.trim().orEmpty().take(250)
                val safeRole = if (signUpDraft?.accountRole == "provider") "provider" else "customer"
                val completed = signUpDraft != null &&
                    safeMobile.filter(Char::isDigit).length >= 5 &&
                    safeAddress.length >= 3
                val payload = mapOf(
                    "userId" to uid,
                    "fullName" to safeName,
                    "email" to safeEmail,
                    "mobileNumber" to safeMobile,
                    "fullAddress" to safeAddress,
                    "accountRole" to safeRole,
                    "languagePreference" to preferredLanguage.code,
                    "bengaliNumerals" to bengaliNumerals,
                    "pushNotificationsEnabled" to true,
                    "emailNotificationsEnabled" to true,
                    "profileCompleted" to completed,
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
                docRef.set(payload).await()
                Result.success(
                    UserProfile(
                        id = uid,
                        userId = uid,
                        fullName = safeName,
                        email = safeEmail,
                        mobileNumber = safeMobile,
                        fullAddress = safeAddress,
                        accountRole = safeRole,
                        languagePreference = preferredLanguage.code,
                        bengaliNumerals = bengaliNumerals,
                        profileCompleted = completed
                    )
                )
            }
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.WRITE, docPath)
            Result.failure(e)
        }
    }

    suspend fun saveProfileDetails(
        uid: String,
        fullName: String,
        mobileNumber: String,
        fullAddress: String,
        accountRole: String
    ): Result<Unit> {
        val docPath = "users/$uid"
        return try {
            val currentUid = requireUserId()
            check(currentUid == uid) { "Signed-in user mismatch" }
            val safeRole = if (accountRole == "provider") "provider" else "customer"
            db.collection("users").document(uid).update(
                mapOf(
                    "fullName" to fullName.trim().take(80),
                    "mobileNumber" to mobileNumber.trim().take(20),
                    "fullAddress" to fullAddress.trim().take(250),
                    "accountRole" to safeRole,
                    "profileCompleted" to true,
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            ).await()
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, docPath)
            Result.failure(e)
        }
    }

    suspend fun syncLanguagePreference(
        uid: String,
        language: AppLanguage,
        bengaliNumerals: Boolean
    ): Result<Unit> {
        val docPath = "users/$uid"
        return try {
            val currentUid = requireUserId()
            check(currentUid == uid)
            db.collection("users").document(uid).update(
                mapOf(
                    "languagePreference" to language.code,
                    "bengaliNumerals" to bengaliNumerals,
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            ).await()
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, docPath)
            Result.failure(e)
        }
    }

    suspend fun updateNotificationPreferences(
        uid: String,
        pushEnabled: Boolean,
        emailEnabled: Boolean
    ): Result<Unit> {
        val docPath = "users/$uid"
        return try {
            val currentUid = requireUserId()
            check(currentUid == uid)
            db.collection("users").document(uid).update(
                mapOf(
                    "pushNotificationsEnabled" to pushEnabled,
                    "emailNotificationsEnabled" to emailEnabled,
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            ).await()
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, docPath)
            Result.failure(e)
        }
    }

    fun observeActiveServices(): Flow<List<ServiceOffering>> = flow {
        requireUserId()
        val query = db.collection("services").whereEqualTo("active", true)
        emitAll(
            query.snapshots()
                .map { snap ->
                    val cloudItems = snap.toObjects(
                        ServiceOffering::class.java,
                        DocumentSnapshot.ServerTimestampBehavior.ESTIMATE
                    )
                    if (cloudItems.isEmpty()) DefaultServiceCatalog.items else cloudItems
                }
                .catch { error ->
                    val fsErr = generateSequence(error) { it.cause }
                        .filterIsInstance<FirebaseFirestoreException>()
                        .firstOrNull()
                    if (fsErr == null && error is CancellationException) throw error
                    val toLog = fsErr ?: (error as? Exception)
                    if (toLog != null && auth.currentUser != null) {
                        handleFirestoreError(toLog, OperationType.LIST, "services")
                    }
                    throw error
                }
        )
    }

    fun observeAllServicesAdmin(): Flow<List<ServiceOffering>> = flow {
        requireUserId()
        val query = db.collection("services")
        emitAll(
            query.snapshots()
                .map { snap ->
                    snap.toObjects(
                        ServiceOffering::class.java,
                        DocumentSnapshot.ServerTimestampBehavior.ESTIMATE
                    )
                }
                .catch { error ->
                    val fsErr = generateSequence(error) { it.cause }
                        .filterIsInstance<FirebaseFirestoreException>()
                        .firstOrNull()
                    if (fsErr == null && error is CancellationException) throw error
                    val toLog = fsErr ?: (error as? Exception)
                    if (toLog != null && auth.currentUser != null) {
                        handleFirestoreError(toLog, OperationType.LIST, "services")
                    }
                    throw error
                }
        )
    }

    suspend fun saveServiceAdmin(service: ServiceOffering, isNew: Boolean): Result<Unit> {
        val docRef = if (isNew || service.id.isBlank()) {
            db.collection("services").document()
        } else {
            db.collection("services").document(service.id)
        }
        return try {
            requireUserId()
            if (isNew || service.id.isBlank()) {
                val payload = mapOf(
                    "categoryKey" to service.categoryKey,
                    "titleBn" to service.titleBn.trim().take(100),
                    "titleEn" to service.titleEn.trim().take(100),
                    "descriptionBn" to service.descriptionBn.trim().take(500),
                    "descriptionEn" to service.descriptionEn.trim().take(500),
                    "providerNameBn" to service.providerNameBn.trim().ifBlank { "কাজের মানুষ কর্মী" }.take(80),
                    "providerNameEn" to service.providerNameEn.trim().ifBlank { "Kajer Manush Pro" }.take(80),
                    "providerAreaBn" to service.providerAreaBn.trim().ifBlank { "কলকাতা" }.take(80),
                    "providerAreaEn" to service.providerAreaEn.trim().ifBlank { "Kolkata" }.take(80),
                    "providerId" to service.providerId.ifBlank { "demo_provider" }.take(128),
                    "basePriceInr" to service.basePriceInr.coerceIn(0L, 100000L),
                    "durationMinutes" to service.durationMinutes.coerceIn(15L, 720L),
                    "rating" to service.rating.coerceIn(0.0, 5.0),
                    "active" to service.active,
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
                docRef.set(payload).await()
            } else {
                docRef.update(
                    mapOf(
                        "categoryKey" to service.categoryKey,
                        "titleBn" to service.titleBn.trim().take(100),
                        "titleEn" to service.titleEn.trim().take(100),
                        "descriptionBn" to service.descriptionBn.trim().take(500),
                        "descriptionEn" to service.descriptionEn.trim().take(500),
                        "providerNameBn" to service.providerNameBn.trim().take(80),
                        "providerNameEn" to service.providerNameEn.trim().take(80),
                        "providerAreaBn" to service.providerAreaBn.trim().take(80),
                        "providerAreaEn" to service.providerAreaEn.trim().take(80),
                        "basePriceInr" to service.basePriceInr.coerceIn(0L, 100000L),
                        "durationMinutes" to service.durationMinutes.coerceIn(15L, 720L),
                        "active" to service.active,
                        "updatedAt" to FieldValue.serverTimestamp()
                    )
                ).await()
            }
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.WRITE, docRef.path)
            Result.failure(e)
        }
    }

    suspend fun seedDefaultServicesAdmin(): Result<Unit> {
        return try {
            requireUserId()
            val batch = db.batch()
            for (item in DefaultServiceCatalog.items) {
                val docRef = db.collection("services").document(item.id)
                val payload = mapOf(
                    "categoryKey" to item.categoryKey,
                    "titleBn" to item.titleBn,
                    "titleEn" to item.titleEn,
                    "descriptionBn" to item.descriptionBn,
                    "descriptionEn" to item.descriptionEn,
                    "providerNameBn" to item.providerNameBn,
                    "providerNameEn" to item.providerNameEn,
                    "providerAreaBn" to item.providerAreaBn,
                    "providerAreaEn" to item.providerAreaEn,
                    "providerId" to item.providerId,
                    "basePriceInr" to item.basePriceInr,
                    "durationMinutes" to item.durationMinutes,
                    "rating" to item.rating,
                    "active" to item.active,
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
                batch.set(docRef, payload)
            }
            batch.commit().await()
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.WRITE, "services")
            Result.failure(e)
        }
    }

    fun observeCustomerBookings(customerId: String): Flow<List<ServiceBooking>> = flow {
        val uid = requireUserId()
        check(uid == customerId)
        val query = db.collection("bookings").whereEqualTo("customerId", uid)
        emitAll(
            query.snapshots()
                .map { snap ->
                    snap.toObjects(
                        ServiceBooking::class.java,
                        DocumentSnapshot.ServerTimestampBehavior.ESTIMATE
                    ).sortedByDescending { it.createdAt }
                }
                .catch { error ->
                    val fsErr = generateSequence(error) { it.cause }
                        .filterIsInstance<FirebaseFirestoreException>()
                        .firstOrNull()
                    if (fsErr == null && error is CancellationException) throw error
                    val toLog = fsErr ?: (error as? Exception)
                    if (toLog != null && auth.currentUser?.uid == uid) {
                        handleFirestoreError(toLog, OperationType.LIST, "bookings")
                    }
                    throw error
                }
        )
    }

    fun observeProviderBookings(providerId: String): Flow<List<ServiceBooking>> = flow {
        val uid = requireUserId()
        check(uid == providerId)
        val query = db.collection("bookings").whereEqualTo("providerId", uid)
        emitAll(
            query.snapshots()
                .map { snap ->
                    snap.toObjects(
                        ServiceBooking::class.java,
                        DocumentSnapshot.ServerTimestampBehavior.ESTIMATE
                    ).sortedByDescending { it.createdAt }
                }
                .catch { error ->
                    val fsErr = generateSequence(error) { it.cause }
                        .filterIsInstance<FirebaseFirestoreException>()
                        .firstOrNull()
                    if (fsErr == null && error is CancellationException) throw error
                    val toLog = fsErr ?: (error as? Exception)
                    if (toLog != null && auth.currentUser?.uid == uid) {
                        handleFirestoreError(toLog, OperationType.LIST, "bookings")
                    }
                    throw error
                }
        )
    }

    fun observeAllBookingsAdmin(): Flow<List<ServiceBooking>> = flow {
        requireUserId()
        emitAll(
            db.collection("bookings").snapshots()
                .map { snap ->
                    snap.toObjects(
                        ServiceBooking::class.java,
                        DocumentSnapshot.ServerTimestampBehavior.ESTIMATE
                    ).sortedByDescending { it.createdAt }
                }
                .catch { error ->
                    val fsErr = generateSequence(error) { it.cause }
                        .filterIsInstance<FirebaseFirestoreException>()
                        .firstOrNull()
                    if (fsErr == null && error is CancellationException) throw error
                    val toLog = fsErr ?: (error as? Exception)
                    if (toLog != null && auth.currentUser != null) {
                        handleFirestoreError(toLog, OperationType.LIST, "bookings")
                    }
                    throw error
                }
        )
    }

    fun observeAllUsersAdmin(): Flow<List<UserProfile>> = flow {
        requireUserId()
        emitAll(
            db.collection("users").snapshots()
                .map { snap ->
                    snap.toObjects(
                        UserProfile::class.java,
                        DocumentSnapshot.ServerTimestampBehavior.ESTIMATE
                    )
                }
                .catch { error ->
                    val fsErr = generateSequence(error) { it.cause }
                        .filterIsInstance<FirebaseFirestoreException>()
                        .firstOrNull()
                    if (fsErr == null && error is CancellationException) throw error
                    val toLog = fsErr ?: (error as? Exception)
                    if (toLog != null && auth.currentUser != null) {
                        handleFirestoreError(toLog, OperationType.LIST, "users")
                    }
                    throw error
                }
        )
    }

    suspend fun createBooking(
        service: ServiceOffering,
        customerName: String,
        customerPhone: String,
        serviceAddress: String,
        scheduledDate: String,
        scheduledSlot: String,
        notes: String,
        language: AppLanguage,
        assignSelfAsDemoProvider: Boolean
    ): Result<String> {
        var docPath = "bookings"
        return try {
            val uid = requireUserId()
            val docRef = db.collection("bookings").document()
            docPath = docRef.path
            val resolvedProviderId = if (assignSelfAsDemoProvider) uid else service.providerId.ifBlank { uid }
            val payload = mapOf(
                "customerId" to uid,
                "customerName" to customerName.trim().ifBlank { "Customer" }.take(80),
                "customerPhone" to customerPhone.trim().ifBlank { "9830000000" }.take(20),
                "serviceAddress" to serviceAddress.trim().ifBlank { "Kolkata" }.take(250),
                "serviceId" to service.id.ifBlank { "svc_custom" }.take(128),
                "serviceTitleBn" to service.titleBn.ifBlank { service.titleEn }.take(120),
                "serviceTitleEn" to service.titleEn.ifBlank { service.titleBn }.take(120),
                "categoryKey" to service.categoryKey.take(40),
                "providerId" to resolvedProviderId.take(128),
                "providerNameBn" to service.providerNameBn.ifBlank { service.providerNameEn }.take(80),
                "providerNameEn" to service.providerNameEn.ifBlank { service.providerNameBn }.take(80),
                "scheduledDate" to scheduledDate.trim().take(40),
                "scheduledSlot" to scheduledSlot.trim().take(60),
                "amountInr" to service.basePriceInr.coerceIn(0L, 100000L),
                "notes" to notes.trim().take(400),
                "status" to "pending",
                "languageAtBooking" to language.code,
                "createdAt" to FieldValue.serverTimestamp(),
                "updatedAt" to FieldValue.serverTimestamp()
            )
            docRef.set(payload).await()

            // Create language-aware notification in user's notifications subcollection
            val notifRef = db.collection("users").document(uid).collection("notifications").document()
            notifRef.set(
                mapOf(
                    "userId" to uid,
                    "titleBn" to "বুকিং জমা হয়েছে: ${service.titleBn}".take(140),
                    "titleEn" to "Booking Submitted: ${service.titleEn}".take(140),
                    "bodyBn" to "আপনার ${service.titleBn} বুকিংটি এখন অপেক্ষমান অবস্থায় আছে।".take(400),
                    "bodyEn" to "Your ${service.titleEn} booking is currently pending confirmation.".take(400),
                    "bookingId" to docRef.id,
                    "type" to "booking_created",
                    "readFlag" to false,
                    "languageCode" to language.code,
                    "createdAt" to FieldValue.serverTimestamp()
                )
            ).await()

            Result.success(docRef.id)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.CREATE, docPath)
            Result.failure(e)
        }
    }

    suspend fun updateBookingStatus(
        booking: ServiceBooking,
        newStatus: BookingStatus,
        notifyLanguage: AppLanguage
    ): Result<Unit> {
        val docPath = "bookings/${booking.id}"
        return try {
            val uid = requireUserId()
            require(booking.id.isNotBlank())
            db.collection("bookings").document(booking.id).update(
                mapOf(
                    "status" to newStatus.key,
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            ).await()

            // Generate bilingual status notification on customer's feed if current user owns it
            if (booking.customerId == uid) {
                val (bnMsg, enMsg) = when (newStatus) {
                    BookingStatus.ACCEPTED -> "আপনার বুকিং গ্রহণ করা হয়েছে।" to "Your booking has been accepted."
                    BookingStatus.REJECTED -> "আপনার বুকিং প্রত্যাখ্যান করা হয়েছে।" to "Your booking was declined by the provider."
                    BookingStatus.IN_PROGRESS -> "আপনার সেবার কাজ শুরু হয়েছে।" to "Work on your booking is now in progress."
                    BookingStatus.COMPLETED -> "আপনার সেবার কাজ সম্পন্ন হয়েছে।" to "Your service booking has been completed."
                    BookingStatus.CANCELLED -> "আপনার বুকিং বাতিল করা হয়েছে।" to "Your booking has been cancelled."
                    BookingStatus.PENDING -> "আপনার বুকিং অপেক্ষমান আছে।" to "Your booking is pending."
                }
                val notifRef = db.collection("users").document(uid).collection("notifications").document()
                notifRef.set(
                    mapOf(
                        "userId" to uid,
                        "titleBn" to booking.serviceTitleBn.take(140),
                        "titleEn" to booking.serviceTitleEn.take(140),
                        "bodyBn" to bnMsg,
                        "bodyEn" to enMsg,
                        "bookingId" to booking.id,
                        "type" to "booking_status",
                        "readFlag" to false,
                        "languageCode" to notifyLanguage.code,
                        "createdAt" to FieldValue.serverTimestamp()
                    )
                ).await()
            }

            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, docPath)
            Result.failure(e)
        }
    }

    fun observeNotifications(userId: String): Flow<List<UserNotification>> = flow {
        val uid = requireUserId()
        check(uid == userId)
        val colRef = db.collection("users").document(uid).collection("notifications")
        emitAll(
            colRef.snapshots()
                .map { snap ->
                    snap.toObjects(
                        UserNotification::class.java,
                        DocumentSnapshot.ServerTimestampBehavior.ESTIMATE
                    ).sortedByDescending { it.createdAt }
                }
                .catch { error ->
                    val fsErr = generateSequence(error) { it.cause }
                        .filterIsInstance<FirebaseFirestoreException>()
                        .firstOrNull()
                    if (fsErr == null && error is CancellationException) throw error
                    val toLog = fsErr ?: (error as? Exception)
                    if (toLog != null && auth.currentUser?.uid == uid) {
                        handleFirestoreError(toLog, OperationType.LIST, colRef.path)
                    }
                    throw error
                }
        )
    }

    suspend fun markNotificationRead(userId: String, notificationId: String): Result<Unit> {
        val docPath = "users/$userId/notifications/$notificationId"
        return try {
            val uid = requireUserId()
            check(uid == userId)
            db.collection("users").document(uid)
                .collection("notifications").document(notificationId)
                .update(mapOf("readFlag" to true))
                .await()
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, docPath)
            Result.failure(e)
        }
    }

    suspend fun submitSupportTicket(
        userId: String,
        subject: String,
        message: String,
        language: AppLanguage
    ): Result<Unit> {
        val docRef = db.collection("users").document(userId).collection("support_tickets").document()
        return try {
            val uid = requireUserId()
            check(uid == userId)
            docRef.set(
                mapOf(
                    "userId" to uid,
                    "subject" to subject.trim().take(120),
                    "message" to message.trim().take(1000),
                    "languageCode" to language.code,
                    "status" to "open",
                    "createdAt" to FieldValue.serverTimestamp()
                )
            ).await()
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.CREATE, docRef.path)
            Result.failure(e)
        }
    }
}
