package com.example.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.AdminStats
import com.example.data.AdminTwoFactorSetup
import com.example.data.AdminTwoFactorStatus
import com.example.data.BookingStatus
import com.example.data.KajerManushRepository
import com.example.data.PaymentMethod
import com.example.data.PaymentStatus
import com.example.data.ProviderProfile
import com.example.data.RazorpayOrderPayload
import com.example.data.ServiceBooking
import com.example.data.ServiceOffering
import com.example.data.UserNotification
import com.example.data.UserProfile
import com.example.i18n.AppLanguage
import com.example.i18n.LanguagePreferencesStore
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface UiState<out T> {
    data object Loading : UiState<Nothing>
    data class Success<T>(val data: T) : UiState<T>
    data class Error(val message: String) : UiState<Nothing>
}

class KajerManushViewModel(
    private val repository: KajerManushRepository,
    private val prefsStore: LanguagePreferencesStore,
    val currentUserId: String,
    initialUser: UserProfile
) : ViewModel() {

    private val _userProfileState = MutableStateFlow<UiState<UserProfile?>>(UiState.Success(initialUser))
    val userProfileState: StateFlow<UiState<UserProfile?>> = _userProfileState.asStateFlow()

    private val _servicesState = MutableStateFlow<UiState<List<ServiceOffering>>>(UiState.Loading)
    val servicesState: StateFlow<UiState<List<ServiceOffering>>> = _servicesState.asStateFlow()

    private val _customerBookingsState = MutableStateFlow<UiState<List<ServiceBooking>>>(UiState.Loading)
    val customerBookingsState: StateFlow<UiState<List<ServiceBooking>>> = _customerBookingsState.asStateFlow()

    private val _providerBookingsState = MutableStateFlow<UiState<List<ServiceBooking>>>(UiState.Loading)
    val providerBookingsState: StateFlow<UiState<List<ServiceBooking>>> = _providerBookingsState.asStateFlow()

    private val _providerApproved = MutableStateFlow(false)
    val providerApproved: StateFlow<Boolean> = _providerApproved.asStateFlow()

    private val _providerProfile = MutableStateFlow<ProviderProfile?>(null)
    val providerProfile: StateFlow<ProviderProfile?> = _providerProfile.asStateFlow()

    private val _notificationsState = MutableStateFlow<UiState<List<UserNotification>>>(UiState.Loading)
    val notificationsState: StateFlow<UiState<List<UserNotification>>> = _notificationsState.asStateFlow()

    private val _isAdmin = MutableStateFlow(initialUser.accountRole == "admin")
    val isAdmin: StateFlow<Boolean> = _isAdmin.asStateFlow()

    private val _adminStats = MutableStateFlow(AdminStats())
    val adminStats: StateFlow<AdminStats> = _adminStats.asStateFlow()

    private val _adminProviders = MutableStateFlow<List<ProviderProfile>>(emptyList())
    val adminProviders: StateFlow<List<ProviderProfile>> = _adminProviders.asStateFlow()

    private val _adminServicesState = MutableStateFlow<List<ServiceOffering>>(emptyList())
    val adminServicesState: StateFlow<List<ServiceOffering>> = _adminServicesState.asStateFlow()

    private val _adminBookingsState = MutableStateFlow<List<ServiceBooking>>(emptyList())
    val adminBookingsState: StateFlow<List<ServiceBooking>> = _adminBookingsState.asStateFlow()

    private val _adminUsersState = MutableStateFlow<List<UserProfile>>(emptyList())
    val adminUsersState: StateFlow<List<UserProfile>> = _adminUsersState.asStateFlow()

    private val _admin2faStatus = MutableStateFlow(AdminTwoFactorStatus())
    val admin2faStatus: StateFlow<AdminTwoFactorStatus> = _admin2faStatus.asStateFlow()

    private val _admin2faSetup = MutableStateFlow<AdminTwoFactorSetup?>(null)
    val admin2faSetup: StateFlow<AdminTwoFactorSetup?> = _admin2faSetup.asStateFlow()

    private val _admin2faBackupCodes = MutableStateFlow<List<String>>(emptyList())
    val admin2faBackupCodes: StateFlow<List<String>> = _admin2faBackupCodes.asStateFlow()

    private val _pendingRazorpayOrder = MutableStateFlow<RazorpayOrderPayload?>(null)
    val pendingRazorpayOrder: StateFlow<RazorpayOrderPayload?> = _pendingRazorpayOrder.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _selectedCategoryKey = MutableStateFlow<String?>(null)
    val selectedCategoryKey: StateFlow<String?> = _selectedCategoryKey.asStateFlow()

    private val _actionMessage = MutableStateFlow<String?>(null)
    val actionMessage: StateFlow<String?> = _actionMessage.asStateFlow()

    private val _isMutating = MutableStateFlow(false)
    val isMutating: StateFlow<Boolean> = _isMutating.asStateFlow()

    init {
        refreshAll()
    }

    fun refreshAll() {
        viewModelScope.launch {
            repository.fetchMe().onSuccess { fresh ->
                _userProfileState.value = UiState.Success(fresh)
                _isAdmin.value = fresh.accountRole == "admin"
                prefsStore.saveLanguage(AppLanguage.fromCode(fresh.languagePreference))
                prefsStore.saveBengaliNumerals(fresh.bengaliNumerals)
            }
            loadServices()
            loadBookings()
            loadNotifications()
            if (_isAdmin.value) {
                loadAdminData()
            }
        }
    }

    fun loadServices() {
        viewModelScope.launch {
            repository.fetchActiveServices()
                .onSuccess { list ->
                    _servicesState.value = UiState.Success(list)
                    if (_isAdmin.value) {
                        _adminServicesState.value = list
                    }
                }
                .onFailure { err ->
                    _servicesState.value = UiState.Error(err.localizedMessage ?: "Failed to load services")
                }
        }
    }

    fun loadBookings() {
        viewModelScope.launch {
            repository.fetchMyBookings()
                .onSuccess { list -> _customerBookingsState.value = UiState.Success(list) }
                .onFailure { err ->
                    _customerBookingsState.value = UiState.Error(err.localizedMessage ?: "Failed to load bookings")
                }

            val role = (_userProfileState.value as? UiState.Success)?.data?.accountRole
            if (role == "provider" || role == "admin") {
                repository.fetchMyProviderProfile().onSuccess { _providerProfile.value = it }
                repository.fetchProviderBookings()
                    .onSuccess { (list, approved) ->
                        _providerApproved.value = approved
                        _providerBookingsState.value = UiState.Success(list)
                    }
                    .onFailure { err ->
                        _providerBookingsState.value = UiState.Error(err.localizedMessage ?: "Failed to load provider jobs")
                    }
            } else {
                _providerBookingsState.value = UiState.Success(emptyList())
            }
        }
    }

    fun loadNotifications() {
        viewModelScope.launch {
            repository.fetchNotifications()
                .onSuccess { list -> _notificationsState.value = UiState.Success(list) }
                .onFailure { err ->
                    _notificationsState.value = UiState.Error(err.localizedMessage ?: "Failed to load notifications")
                }
        }
    }

    fun loadAdminData() {
        if (!_isAdmin.value) return
        viewModelScope.launch {
            repository.fetchAdminStats().onSuccess { _adminStats.value = it }
            repository.fetchAdminProviders().onSuccess { _adminProviders.value = it }
            repository.fetchAdminBookings().onSuccess { _adminBookingsState.value = it }
            repository.fetchAdminUsers().onSuccess { _adminUsersState.value = it }
            repository.fetchActiveServices().onSuccess { _adminServicesState.value = it }
            repository.fetchAdmin2faStatus().onSuccess { _admin2faStatus.value = it }
        }
    }

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
        viewModelScope.launch {
            prefsStore.saveLanguage(language)
            repository.syncLanguagePreference(language, currentBengaliNumerals).onSuccess { updated ->
                _userProfileState.value = UiState.Success(updated)
            }
        }
    }

    fun toggleBengaliNumerals(enabled: Boolean, currentLanguage: AppLanguage) {
        viewModelScope.launch {
            prefsStore.saveBengaliNumerals(enabled)
            repository.syncLanguagePreference(currentLanguage, enabled).onSuccess { updated ->
                _userProfileState.value = UiState.Success(updated)
            }
        }
    }

    fun updateNotificationPrefs(pushEnabled: Boolean, emailEnabled: Boolean) {
        val current = (_userProfileState.value as? UiState.Success)?.data ?: return
        viewModelScope.launch {
            repository.saveProfileDetails(
                fullName = current.fullName,
                mobileNumber = current.mobileNumber,
                fullAddress = current.fullAddress,
                pushEnabled = pushEnabled,
                emailEnabled = emailEnabled
            ).onSuccess { updated ->
                _userProfileState.value = UiState.Success(updated)
            }
        }
    }

    fun updateProfile(
        fullName: String,
        mobile: String,
        address: String,
        successMsg: String,
        errorMsg: String
    ) {
        viewModelScope.launch {
            _isMutating.value = true
            val result = repository.saveProfileDetails(fullName, mobile, address)
            _isMutating.value = false
            result.onSuccess { updated ->
                _userProfileState.value = UiState.Success(updated)
                _actionMessage.value = successMsg
            }.onFailure { err ->
                _actionMessage.value = err.localizedMessage ?: errorMsg
            }
        }
    }

    fun applyProviderProfile(
        bioBn: String,
        bioEn: String,
        categories: List<String>,
        locationBn: String,
        locationEn: String,
        experienceYears: Int,
        successMsg: String,
        errorMsg: String,
        onSaved: () -> Unit
    ) {
        viewModelScope.launch {
            _isMutating.value = true
            val result = repository.applyProviderProfile(
                bioBn = bioBn,
                bioEn = bioEn,
                serviceCategories = categories,
                serviceLocationBn = locationBn,
                serviceLocationEn = locationEn,
                experienceYears = experienceYears,
                isAvailable = true
            )
            _isMutating.value = false
            result.onSuccess { prof ->
                _providerProfile.value = prof
                _providerApproved.value = prof.isApproved
                _actionMessage.value = successMsg
                loadBookings()
                onSaved()
            }.onFailure { err ->
                _actionMessage.value = err.localizedMessage ?: errorMsg
            }
        }
    }

    fun toggleProviderAvailability(available: Boolean) {
        viewModelScope.launch {
            repository.toggleProviderAvailability(available).onSuccess { prof ->
                _providerProfile.value = prof
            }
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
        paymentMethod: String = "cash",
        language: AppLanguage,
        successMsg: String,
        errorMsg: String,
        onBooked: () -> Unit
    ) {
        viewModelScope.launch {
            _isMutating.value = true
            val result = repository.createBooking(
                serviceId = service.id,
                customerName = customerName,
                customerPhone = customerPhone,
                serviceAddress = serviceAddress,
                scheduledDate = scheduledDate,
                scheduledSlot = scheduledSlot,
                notes = notes,
                paymentMethod = paymentMethod,
                language = language
            )
            _isMutating.value = false
            result.onSuccess { createdBooking ->
                loadBookings()
                loadNotifications()
                onBooked()
                if (paymentMethod == "razorpay") {
                    startRazorpayPayment(createdBooking.id, errorMsg)
                } else {
                    _actionMessage.value = successMsg
                }
            }.onFailure { err ->
                _actionMessage.value = err.localizedMessage ?: errorMsg
            }
        }
    }

    fun startRazorpayPayment(bookingId: String, errorMsg: String) {
        viewModelScope.launch {
            _isMutating.value = true
            val orderResult = repository.createRazorpayOrder(bookingId)
            _isMutating.value = false
            orderResult.onSuccess { order ->
                _pendingRazorpayOrder.value = order
            }.onFailure { err ->
                _actionMessage.value = err.localizedMessage ?: errorMsg
            }
        }
    }

    fun verifyRazorpayPayment(
        bookingId: String,
        orderId: String,
        paymentId: String,
        signature: String,
        successMsg: String,
        errorMsg: String
    ) {
        _pendingRazorpayOrder.value = null
        viewModelScope.launch {
            _isMutating.value = true
            val res = repository.verifyRazorpayPayment(bookingId, orderId, paymentId, signature)
            _isMutating.value = false
            res.onSuccess {
                _actionMessage.value = successMsg
                loadBookings()
                loadNotifications()
                if (_isAdmin.value) loadAdminData()
            }.onFailure { err ->
                _actionMessage.value = err.localizedMessage ?: errorMsg
                loadBookings()
            }
        }
    }

    fun dismissRazorpayDialog(message: String? = null) {
        _pendingRazorpayOrder.value = null
        if (!message.isNullOrBlank()) {
            _actionMessage.value = message
        }
        loadBookings()
    }

    fun updateBookingStatus(
        booking: ServiceBooking,
        newStatus: BookingStatus,
        successMsg: String,
        errorMsg: String
    ) {
        viewModelScope.launch {
            _isMutating.value = true
            val result = repository.updateBookingStatus(booking.id, newStatus)
            _isMutating.value = false
            if (result.isSuccess) {
                _actionMessage.value = successMsg
                loadBookings()
                loadNotifications()
                if (_isAdmin.value) loadAdminData()
            } else {
                _actionMessage.value = result.exceptionOrNull()?.localizedMessage ?: errorMsg
            }
        }
    }

    fun submitReview(
        bookingId: String,
        rating: Int,
        comment: String,
        successMsg: String,
        errorMsg: String,
        onDone: () -> Unit
    ) {
        viewModelScope.launch {
            _isMutating.value = true
            val result = repository.submitReview(bookingId, rating, comment)
            _isMutating.value = false
            if (result.isSuccess) {
                _actionMessage.value = successMsg
                loadBookings()
                loadServices()
                onDone()
            } else {
                _actionMessage.value = result.exceptionOrNull()?.localizedMessage ?: errorMsg
            }
        }
    }

    fun markNotificationRead(notificationId: String) {
        viewModelScope.launch {
            repository.markNotificationRead(notificationId).onSuccess {
                loadNotifications()
            }
        }
    }

    fun approveProviderAdmin(
        providerProfileId: String,
        decision: String,
        successMsg: String,
        errorMsg: String
    ) {
        viewModelScope.launch {
            _isMutating.value = true
            val result = repository.approveProviderAdmin(providerProfileId, decision)
            _isMutating.value = false
            if (result.isSuccess) {
                _actionMessage.value = successMsg
                loadAdminData()
            } else {
                _actionMessage.value = result.exceptionOrNull()?.localizedMessage ?: errorMsg
            }
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
                loadServices()
                loadAdminData()
                onSaved()
            } else {
                _actionMessage.value = result.exceptionOrNull()?.localizedMessage ?: errorMsg
            }
        }
    }

    fun updateUserAdmin(
        userId: String,
        fullName: String,
        email: String,
        mobileNumber: String,
        fullAddress: String,
        role: String,
        isVerified: Boolean,
        newPassword: String?,
        successMsg: String,
        errorMsg: String,
        onUpdated: () -> Unit
    ) {
        viewModelScope.launch {
            _isMutating.value = true
            val result = repository.updateUserAdmin(
                userId = userId,
                fullName = fullName,
                email = email,
                mobileNumber = mobileNumber,
                fullAddress = fullAddress,
                role = role,
                isVerified = isVerified,
                newPassword = newPassword
            )
            _isMutating.value = false
            result.onSuccess {
                _actionMessage.value = successMsg
                loadAdminData()
                onUpdated()
            }.onFailure { err ->
                _actionMessage.value = err.localizedMessage ?: errorMsg
            }
        }
    }

    fun deleteUserAdmin(
        userId: String,
        successMsg: String,
        errorMsg: String,
        onDeleted: () -> Unit
    ) {
        viewModelScope.launch {
            _isMutating.value = true
            val result = repository.deleteUserAdmin(userId)
            _isMutating.value = false
            result.onSuccess {
                _actionMessage.value = successMsg
                loadAdminData()
                onDeleted()
            }.onFailure { err ->
                _actionMessage.value = err.localizedMessage ?: errorMsg
            }
        }
    }

    fun updateBookingPaymentAdmin(
        bookingId: String,
        paymentStatus: PaymentStatus,
        paymentMethod: PaymentMethod? = null,
        successMsg: String,
        errorMsg: String
    ) {
        viewModelScope.launch {
            _isMutating.value = true
            val result = repository.updateBookingPaymentAdmin(bookingId, paymentStatus, paymentMethod)
            _isMutating.value = false
            result.onSuccess {
                _actionMessage.value = successMsg
                loadAdminData()
                loadBookings()
            }.onFailure { err ->
                _actionMessage.value = err.localizedMessage ?: errorMsg
            }
        }
    }

    fun startAdmin2faSetup(errorMsg: String) {
        viewModelScope.launch {
            _isMutating.value = true
            val result = repository.startAdmin2faSetup()
            _isMutating.value = false
            result.onSuccess { setup ->
                _admin2faSetup.value = setup
                _admin2faBackupCodes.value = emptyList()
            }.onFailure { err ->
                _actionMessage.value = err.localizedMessage ?: errorMsg
            }
        }
    }

    fun confirmAdmin2fa(code: String, successMsg: String, errorMsg: String) {
        viewModelScope.launch {
            _isMutating.value = true
            val result = repository.confirmAdmin2fa(code)
            _isMutating.value = false
            result.onSuccess { codes ->
                _admin2faSetup.value = null
                _admin2faBackupCodes.value = codes
                _actionMessage.value = successMsg
                loadAdminData()
            }.onFailure { err ->
                _actionMessage.value = err.localizedMessage ?: errorMsg
            }
        }
    }

    fun disableAdmin2fa(password: String, code: String, successMsg: String, errorMsg: String, onDone: () -> Unit) {
        viewModelScope.launch {
            _isMutating.value = true
            val result = repository.disableAdmin2fa(password, code)
            _isMutating.value = false
            result.onSuccess {
                _admin2faBackupCodes.value = emptyList()
                _admin2faSetup.value = null
                _actionMessage.value = successMsg
                loadAdminData()
                onDone()
            }.onFailure { err ->
                _actionMessage.value = err.localizedMessage ?: errorMsg
            }
        }
    }

    fun clearAdmin2faBackupCodes() {
        _admin2faBackupCodes.value = emptyList()
    }

    fun submitSupportTicket(
        subject: String,
        message: String,
        language: AppLanguage,
        successMsg: String,
        errorMsg: String,
        onSubmitted: () -> Unit
    ) {
        val current = (_userProfileState.value as? UiState.Success)?.data
        viewModelScope.launch {
            _isMutating.value = true
            val result = repository.submitSupportTicket(
                name = current?.fullName.orEmpty(),
                email = current?.email.orEmpty(),
                subject = subject,
                message = message,
                language = language
            )
            _isMutating.value = false
            if (result.isSuccess) {
                _actionMessage.value = successMsg
                onSubmitted()
            } else {
                _actionMessage.value = result.exceptionOrNull()?.localizedMessage ?: errorMsg
            }
        }
    }

    fun signOut() {
        viewModelScope.launch {
            repository.logout()
        }
    }
}
