package com.example.ui

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.BookingStatus
import com.example.data.KajerManushRepository
import com.example.data.ServiceBooking
import com.example.data.ServiceOffering
import com.example.data.UserNotification
import com.example.data.UserProfile
import com.example.i18n.AppLanguage
import com.example.i18n.LanguagePreferencesStore
import com.google.firebase.firestore.FirebaseFirestoreException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

sealed interface UiState<out T> {
    data object Loading : UiState<Nothing>
    data class Success<T>(val data: T) : UiState<T>
    data class Error(val message: String) : UiState<Nothing>
}

@OptIn(ExperimentalCoroutinesApi::class)
class KajerManushViewModel(
    private val repository: KajerManushRepository,
    private val prefsStore: LanguagePreferencesStore,
    val currentUserId: String,
    private val initialDisplayName: String,
    private val initialEmail: String,
    initialLanguage: AppLanguage,
    initialBengaliNumerals: Boolean,
    private val pendingSignUpDraft: com.example.data.PendingSignUpDraft? = null,
    private val onSignUpDraftConsumed: () -> Unit = {}
) : ViewModel() {

    private var hasSyncedInitialServerLanguage = false

    private val _isAdmin = MutableStateFlow(false)
    val isAdmin: StateFlow<Boolean> = _isAdmin.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _selectedCategoryKey = MutableStateFlow<String?>(null)
    val selectedCategoryKey: StateFlow<String?> = _selectedCategoryKey.asStateFlow()

    private val _actionMessage = MutableStateFlow<String?>(null)
    val actionMessage: StateFlow<String?> = _actionMessage.asStateFlow()

    private val _isMutating = MutableStateFlow(false)
    val isMutating: StateFlow<Boolean> = _isMutating.asStateFlow()

    init {
        viewModelScope.launch {
            _isAdmin.value = repository.checkIsAdmin(currentUserId)
            repository.ensureUserProfile(
                uid = currentUserId,
                displayName = initialDisplayName,
                email = initialEmail,
                preferredLanguage = initialLanguage,
                bengaliNumerals = initialBengaliNumerals,
                signUpDraft = pendingSignUpDraft
            )
            if (pendingSignUpDraft != null) {
                onSignUpDraftConsumed()
            }
        }
    }

    val userProfileState: StateFlow<UiState<UserProfile?>> = repository.observeUserProfile(currentUserId)
        .onEach { profile ->
            if (profile != null && !hasSyncedInitialServerLanguage) {
                hasSyncedInitialServerLanguage = true
                val serverLang = AppLanguage.fromCode(profile.languagePreference)
                prefsStore.saveLanguage(serverLang)
                prefsStore.saveBengaliNumerals(profile.bengaliNumerals)
            }
        }
        .map<UserProfile?, UiState<UserProfile?>> { UiState.Success(it) }
        .catch { error ->
            val fsErr = generateSequence(error) { it.cause }
                .filterIsInstance<FirebaseFirestoreException>()
                .firstOrNull()
            if (fsErr == null && error is CancellationException) throw error
            val root = fsErr ?: error
            Log.w(TAG, "Error observing profile", root)
            emit(UiState.Error(root.message ?: "Failed to load profile"))
        }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(STOP_TIMEOUT_MILLIS),
            initialValue = UiState.Loading
        )

    val servicesState: StateFlow<UiState<List<ServiceOffering>>> = repository.observeActiveServices()
        .map<List<ServiceOffering>, UiState<List<ServiceOffering>>> { UiState.Success(it) }
        .catch { error ->
            val fsErr = generateSequence(error) { it.cause }
                .filterIsInstance<FirebaseFirestoreException>()
                .firstOrNull()
            if (fsErr == null && error is CancellationException) throw error
            val root = fsErr ?: error
            Log.w(TAG, "Error observing services", root)
            emit(UiState.Error(root.message ?: "Failed to load services"))
        }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(STOP_TIMEOUT_MILLIS),
            initialValue = UiState.Loading
        )

    val customerBookingsState: StateFlow<UiState<List<ServiceBooking>>> = repository.observeCustomerBookings(currentUserId)
        .map<List<ServiceBooking>, UiState<List<ServiceBooking>>> { UiState.Success(it) }
        .catch { error ->
            val fsErr = generateSequence(error) { it.cause }
                .filterIsInstance<FirebaseFirestoreException>()
                .firstOrNull()
            if (fsErr == null && error is CancellationException) throw error
            val root = fsErr ?: error
            Log.w(TAG, "Error observing customer bookings", root)
            emit(UiState.Error(root.message ?: "Failed to load bookings"))
        }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(STOP_TIMEOUT_MILLIS),
            initialValue = UiState.Loading
        )

    val providerBookingsState: StateFlow<UiState<List<ServiceBooking>>> = repository.observeProviderBookings(currentUserId)
        .map<List<ServiceBooking>, UiState<List<ServiceBooking>>> { UiState.Success(it) }
        .catch { error ->
            val fsErr = generateSequence(error) { it.cause }
                .filterIsInstance<FirebaseFirestoreException>()
                .firstOrNull()
            if (fsErr == null && error is CancellationException) throw error
            val root = fsErr ?: error
            Log.w(TAG, "Error observing provider bookings", root)
            emit(UiState.Error(root.message ?: "Failed to load provider bookings"))
        }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(STOP_TIMEOUT_MILLIS),
            initialValue = UiState.Loading
        )

    val notificationsState: StateFlow<UiState<List<UserNotification>>> = repository.observeNotifications(currentUserId)
        .map<List<UserNotification>, UiState<List<UserNotification>>> { UiState.Success(it) }
        .catch { error ->
            val fsErr = generateSequence(error) { it.cause }
                .filterIsInstance<FirebaseFirestoreException>()
                .firstOrNull()
            if (fsErr == null && error is CancellationException) throw error
            val root = fsErr ?: error
            Log.w(TAG, "Error observing notifications", root)
            emit(UiState.Error(root.message ?: "Failed to load notifications"))
        }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(STOP_TIMEOUT_MILLIS),
            initialValue = UiState.Loading
        )

    val adminServicesState: StateFlow<List<ServiceOffering>> = _isAdmin
        .flatMapLatest { admin ->
            if (admin) repository.observeAllServicesAdmin() else flowOf(emptyList())
        }
        .catch { error ->
            if (error is CancellationException) throw error
            emit(emptyList())
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(STOP_TIMEOUT_MILLIS), emptyList())

    val adminBookingsState: StateFlow<List<ServiceBooking>> = _isAdmin
        .flatMapLatest { admin ->
            if (admin) repository.observeAllBookingsAdmin() else flowOf(emptyList())
        }
        .catch { error ->
            if (error is CancellationException) throw error
            emit(emptyList())
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(STOP_TIMEOUT_MILLIS), emptyList())

    val adminUsersState: StateFlow<List<UserProfile>> = _isAdmin
        .flatMapLatest { admin ->
            if (admin) repository.observeAllUsersAdmin() else flowOf(emptyList())
        }
        .catch { error ->
            if (error is CancellationException) throw error
            emit(emptyList())
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(STOP_TIMEOUT_MILLIS), emptyList())

    fun setSearchQuery(query: String) {
        _searchQuery.value = query
    }

    fun selectCategory(categoryKey: String?) {
        _selectedCategoryKey.value = categoryKey
    }

    fun clearActionMessage() {
        _actionMessage.value = null
    }

    fun switchLanguage(language: AppLanguage, currentBengaliNumerals: Boolean) {
        hasSyncedInitialServerLanguage = true
        viewModelScope.launch {
            prefsStore.saveLanguage(language)
            repository.syncLanguagePreference(currentUserId, language, currentBengaliNumerals)
        }
    }

    fun toggleBengaliNumerals(enabled: Boolean, currentLanguage: AppLanguage) {
        hasSyncedInitialServerLanguage = true
        viewModelScope.launch {
            prefsStore.saveBengaliNumerals(enabled)
            repository.syncLanguagePreference(currentUserId, currentLanguage, enabled)
        }
    }

    fun updateNotificationPrefs(pushEnabled: Boolean, emailEnabled: Boolean) {
        viewModelScope.launch {
            repository.updateNotificationPreferences(currentUserId, pushEnabled, emailEnabled)
        }
    }

    fun completeRegistration(
        fullName: String,
        mobile: String,
        address: String,
        accountRole: String,
        successMsg: String,
        errorMsg: String
    ) {
        viewModelScope.launch {
            _isMutating.value = true
            val result = repository.saveProfileDetails(currentUserId, fullName, mobile, address, accountRole)
            _isMutating.value = false
            _actionMessage.value = if (result.isSuccess) successMsg else (result.exceptionOrNull()?.localizedMessage ?: errorMsg)
        }
    }

    fun createBooking(
        service: ServiceOffering,
        customerName: String,
        customerPhone: String,
        serviceAddress: String,
        scheduledDate: String,
        scheduledSlot: String,
        notes: String,
        language: AppLanguage,
        assignSelfAsDemoProvider: Boolean,
        successMsg: String,
        errorMsg: String,
        onBooked: () -> Unit
    ) {
        viewModelScope.launch {
            _isMutating.value = true
            val result = repository.createBooking(
                service = service,
                customerName = customerName,
                customerPhone = customerPhone,
                serviceAddress = serviceAddress,
                scheduledDate = scheduledDate,
                scheduledSlot = scheduledSlot,
                notes = notes,
                language = language,
                assignSelfAsDemoProvider = assignSelfAsDemoProvider
            )
            _isMutating.value = false
            if (result.isSuccess) {
                _actionMessage.value = successMsg
                onBooked()
            } else {
                _actionMessage.value = result.exceptionOrNull()?.localizedMessage ?: errorMsg
            }
        }
    }

    fun updateBookingStatus(
        booking: ServiceBooking,
        newStatus: BookingStatus,
        notifyLanguage: AppLanguage,
        successMsg: String,
        errorMsg: String
    ) {
        viewModelScope.launch {
            _isMutating.value = true
            val result = repository.updateBookingStatus(booking, newStatus, notifyLanguage)
            _isMutating.value = false
            _actionMessage.value = if (result.isSuccess) successMsg else (result.exceptionOrNull()?.localizedMessage ?: errorMsg)
        }
    }

    fun markNotificationRead(notificationId: String) {
        viewModelScope.launch {
            repository.markNotificationRead(currentUserId, notificationId)
        }
    }

    fun saveServiceAdmin(
        service: ServiceOffering,
        isNew: Boolean,
        successMsg: String,
        errorMsg: String,
        onSaved: () -> Unit
    ) {
        viewModelScope.launch {
            _isMutating.value = true
            val result = repository.saveServiceAdmin(service, isNew)
            _isMutating.value = false
            if (result.isSuccess) {
                _actionMessage.value = successMsg
                onSaved()
            } else {
                _actionMessage.value = result.exceptionOrNull()?.localizedMessage ?: errorMsg
            }
        }
    }

    fun seedDefaultServicesAdmin(successMsg: String, errorMsg: String) {
        viewModelScope.launch {
            _isMutating.value = true
            val result = repository.seedDefaultServicesAdmin()
            _isMutating.value = false
            _actionMessage.value = if (result.isSuccess) successMsg else (result.exceptionOrNull()?.localizedMessage ?: errorMsg)
        }
    }

    fun submitSupportTicket(
        subject: String,
        message: String,
        language: AppLanguage,
        successMsg: String,
        errorMsg: String,
        onSubmitted: () -> Unit
    ) {
        viewModelScope.launch {
            _isMutating.value = true
            val result = repository.submitSupportTicket(currentUserId, subject, message, language)
            _isMutating.value = false
            if (result.isSuccess) {
                _actionMessage.value = successMsg
                onSubmitted()
            } else {
                _actionMessage.value = result.exceptionOrNull()?.localizedMessage ?: errorMsg
            }
        }
    }

    private companion object {
        const val TAG = "KajerManushVM"
        const val STOP_TIMEOUT_MILLIS = 5000L
    }
}
