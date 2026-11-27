package com.example.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Email
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.Phone
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.example.data.UserProfile
import com.example.i18n.AppLanguage
import com.example.i18n.t
import com.example.ui.components.LanguageTogglePill

@Composable
fun ProfileCompletionScreen(
    profile: UserProfile,
    currentLanguage: AppLanguage,
    isSaving: Boolean,
    onSelectLanguage: (AppLanguage) -> Unit,
    onSaveRegistration: (fullName: String, mobile: String, address: String) -> Unit
) {
    var fullName by rememberSaveable(profile.userId) { mutableStateOf(profile.fullName) }
    var mobile by rememberSaveable(profile.userId) { mutableStateOf(profile.mobileNumber) }
    var address by rememberSaveable(profile.userId) { mutableStateOf(profile.fullAddress) }
    var validationErrorKey by rememberSaveable { mutableStateOf<String?>(null) }

    Scaffold(
        contentWindowInsets = WindowInsets.safeDrawing
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
            contentAlignment = Alignment.TopCenter
        ) {
            Column(
                modifier = Modifier
                    .widthIn(max = 600.dp)
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = t("app.name"),
                        style = MaterialTheme.typography.titleLarge,
                        color = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.Bold
                    )
                    LanguageTogglePill(
                        currentLanguage = currentLanguage,
                        onSelectLanguage = onSelectLanguage
                    )
                }

                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        text = t("auth.complete_profile_title"),
                        style = MaterialTheme.typography.headlineSmall
                    )
                    Text(
                        text = t("auth.complete_profile_subtitle"),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                OutlinedTextField(
                    value = fullName,
                    onValueChange = { fullName = it; validationErrorKey = null },
                    label = { Text(t("auth.full_name")) },
                    leadingIcon = { Icon(Icons.Rounded.Person, contentDescription = null) },
                    singleLine = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("register_full_name_input")
                )

                OutlinedTextField(
                    value = profile.email,
                    onValueChange = {},
                    readOnly = true,
                    enabled = false,
                    label = { Text(t("auth.email")) },
                    leadingIcon = { Icon(Icons.Rounded.Email, contentDescription = null) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = mobile,
                    onValueChange = { mobile = it.filter { ch -> ch.isDigit() || ch == '+' }.take(14); validationErrorKey = null },
                    label = { Text(t("auth.mobile")) },
                    leadingIcon = { Icon(Icons.Rounded.Phone, contentDescription = null) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                    singleLine = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("register_mobile_input")
                )

                OutlinedTextField(
                    value = address,
                    onValueChange = { address = it; validationErrorKey = null },
                    label = { Text(t("auth.address")) },
                    leadingIcon = { Icon(Icons.Rounded.Home, contentDescription = null) },
                    minLines = 2,
                    maxLines = 4,
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("register_address_input")
                )

                validationErrorKey?.let { key ->
                    Text(
                        text = t(key),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error
                    )
                }

                Spacer(modifier = Modifier.height(6.dp))

                Button(
                    onClick = {
                        when {
                            fullName.trim().length < 2 -> validationErrorKey = "auth.err_name_required"
                            mobile.filter { it.isDigit() }.length < 10 -> validationErrorKey = "auth.err_mobile_invalid"
                            address.trim().length < 4 -> validationErrorKey = "auth.err_address_required"
                            else -> onSaveRegistration(fullName, mobile, address)
                        }
                    },
                    enabled = !isSaving,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(54.dp)
                        .testTag("complete_registration_button"),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    if (isSaving) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            color = MaterialTheme.colorScheme.onPrimary,
                            strokeWidth = 2.dp
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                    }
                    Text(text = t("auth.save_continue"), style = MaterialTheme.typography.labelLarge)
                }
            }
        }
    }
}
