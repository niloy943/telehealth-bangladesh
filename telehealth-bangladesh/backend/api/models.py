from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone
from datetime import timedelta
from api.encryption import encrypt_value, decrypt_value

class User(AbstractUser):
    ROLE_CHOICES = (
        ('patient', 'Patient'),
        ('doctor', 'Doctor'),
        ('admin', 'Admin'),
    )
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='patient')
    phone = models.CharField(max_length=20, blank=True, null=True)
    nid = models.CharField(max_length=20, blank=True, null=True, help_text="National Identification Number (Bangladesh)")
    bmdc_reg = models.CharField(max_length=30, blank=True, null=True, help_text="Bangladesh Medical & Dental Council Registration No.")

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"

def default_doctor_schedule():
    return [
        {"day": "Saturday", "start_time": "10:00 AM", "end_time": "01:00 PM"},
        {"day": "Sunday", "start_time": "04:00 PM", "end_time": "08:00 PM"},
        {"day": "Tuesday", "start_time": "06:00 PM", "end_time": "09:00 PM"},
    ]

class DoctorProfile(models.Model):
    VERIFICATION_CHOICES = (
        ('pending', 'Pending Approval'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    )
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='doctor_profile')
    specialty = models.CharField(max_length=100)
    experience = models.IntegerField(default=1)
    hospital = models.CharField(max_length=150, blank=True, null=True)
    fees = models.DecimalField(max_digits=8, decimal_places=0, default=500, help_text="Consultation fee in BDT")
    schedule = models.JSONField(default=default_doctor_schedule, blank=True, help_text="Weekly consultation schedule slots")
    rating = models.FloatField(default=4.5)
    bio = models.TextField(blank=True, null=True)
    online = models.BooleanField(default=True)
    verification_status = models.CharField(max_length=20, choices=VERIFICATION_CHOICES, default='approved')
    rejection_reason = models.TextField(blank=True, null=True)
    verified_at = models.DateTimeField(blank=True, null=True)
    verified_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='verified_doctors')

    def __str__(self):
        return f"Dr. {self.user.first_name or self.user.username} - {self.specialty} ({self.verification_status})"

class PatientProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='patient_profile')
    date_of_birth = models.DateField(blank=True, null=True)
    blood_group = models.CharField(max_length=5, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    emergency_contact = models.CharField(max_length=50, blank=True, null=True)

    def __str__(self):
        return self.user.username

class Appointment(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending Approval'),
        ('approved', 'Approved'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    )
    patient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='patient_appointments')
    doctor = models.ForeignKey(User, on_delete=models.CASCADE, related_name='doctor_appointments')
    date = models.DateField()
    time = models.CharField(max_length=10)
    reason = models.TextField()
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='pending')
    is_anonymous = models.BooleanField(default=False, help_text="Whether patient identity is hidden from doctor")
    anonymous_session_id = models.CharField(max_length=64, blank=True, null=True, help_text="Unique non-sequential session token, e.g. A7F3K2")
    consultation_type = models.CharField(max_length=20, default='video', help_text="Consultation mode: video, audio, chat, phone")
    PAYMENT_STATUS_CHOICES = (
        ('unpaid', 'Unpaid'),
        ('pending', 'Payment Pending'),
        ('paid', 'Paid'),
        ('refunded', 'Refunded'),
    )
    payment_status = models.CharField(max_length=15, choices=PAYMENT_STATUS_CHOICES, default='unpaid')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.patient.username} with {self.doctor.username} on {self.date}"

class Consultation(models.Model):
    TYPE_CHOICES = (
        ('chat', 'Chat'),
        ('video', 'Video'),
        ('audio', 'Audio'),
        ('phone', 'Phone'),
    )
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('active', 'Active'),
        ('ended', 'Ended'),
    )
    appointment = models.OneToOneField(Appointment, on_delete=models.CASCADE, related_name='consultation')
    type = models.CharField(max_length=10, choices=TYPE_CHOICES, default='chat')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    is_anonymous = models.BooleanField(default=False)
    anonymous_session_id = models.CharField(max_length=64, blank=True, null=True, help_text="Unique anonymous identifier e.g. A7F3K2")
    audio_only = models.BooleanField(default=False, help_text="True if consultation is audio-only without video")
    started_at = models.DateTimeField(blank=True, null=True)
    ended_at = models.DateTimeField(blank=True, null=True)
    duration = models.PositiveIntegerField(default=0, help_text="Consultation duration in seconds")
    start_time = models.DateTimeField(blank=True, null=True)
    end_time = models.DateTimeField(blank=True, null=True)

    @property
    def effective_start_time(self):
        return self.started_at or self.start_time

    @property
    def expires_at(self):
        st = self.effective_start_time
        if st:
            return st + timedelta(minutes=45)
        return None

    @property
    def is_expired(self):
        if self.status in ['ended', 'completed']:
            return True
        exp = self.expires_at
        if exp and timezone.now() >= exp:
            return True
        return False

    @property
    def remaining_seconds(self):
        if self.status in ['ended', 'completed']:
            return 0
        exp = self.expires_at
        if exp:
            diff = int((exp - timezone.now()).total_seconds())
            return max(0, diff)
        return 45 * 60

    @property
    def anonymous_identifier(self):
        if self.anonymous_session_id:
            return f"Anonymous Patient #{self.anonymous_session_id}"
        return "Anonymous Patient"

    def __str__(self):
        anon_str = f" [Anonymous #{self.anonymous_session_id}]" if self.is_anonymous else ""
        return f"Consultation {self.id} ({self.type}){anon_str} for Appointment {self.appointment.id}"

class Prescription(models.Model):
    consultation = models.OneToOneField(Consultation, on_delete=models.CASCADE, related_name='prescription')
    doctor = models.ForeignKey(User, on_delete=models.CASCADE, related_name='written_prescriptions')
    patient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_prescriptions')
    date = models.DateField(auto_now_add=True)
    symptoms = models.TextField()
    diagnosis = models.TextField()
    medicines = models.TextField(help_text="JSON list of medications: drug name, dosage, timing")
    instructions = models.TextField(blank=True, null=True)
    share_token = models.CharField(max_length=100, blank=True, null=True, unique=True)
    shared_at = models.DateTimeField(blank=True, null=True)

    def __str__(self):
        return f"Prescription {self.id} for {self.patient.username}"

class ConsultationChatMessage(models.Model):
    consultation = models.ForeignKey(Consultation, on_delete=models.CASCADE, related_name='chat_messages')
    sender_username = models.CharField(max_length=150)
    ciphertext = models.TextField()
    iv = models.CharField(max_length=255)
    aad = models.JSONField(default=dict, blank=True)
    message_id = models.CharField(max_length=100, unique=True, db_index=True)
    status = models.CharField(max_length=20, default='sent') # 'sent', 'delivered', 'read'
    timestamp = models.CharField(max_length=50, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Msg {self.message_id} in Consultation {self.consultation_id} by {self.sender_username}"

class HealthRecord(models.Model):
    patient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='health_records')
    record_type = models.CharField(max_length=50, help_text="e.g., Blood report, Clinical notes")
    title = models.CharField(max_length=200, blank=True, default='')
    file_name = models.CharField(max_length=255, blank=True, null=True)
    file_size = models.BigIntegerField(default=0, help_text="File size in bytes")
    mime_type = models.CharField(max_length=100, blank=True, null=True)
    file_data = models.TextField(blank=True, null=True, help_text="Base64 or encrypted data of PDF / JPG / JPEG")
    shared_consultations = models.ManyToManyField('Consultation', blank=True, related_name='shared_records')
    encrypted_data = models.TextField(help_text="Encrypted JSON data representing health statistics/metrics")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Automatically handle at-rest encryption before writing/saving to DB
    def set_content(self, raw_text: str):
        self.encrypted_data = encrypt_value(raw_text)

    def get_content(self) -> str:
        return decrypt_value(self.encrypted_data)

    def __str__(self):
        return f"{self.title or self.record_type} for patient {self.patient.username}"

class Consent(models.Model):
    patient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='given_consents')
    doctor = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_consents')
    record_type = models.CharField(max_length=50, default='all', help_text="Specific record type or 'all'")
    granted = models.BooleanField(default=True)
    status = models.CharField(max_length=20, default='granted')  # 'pending', 'granted', 'revoked'
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        status = "Granted" if self.granted else "Revoked"
        return f"Consent {status} by {self.patient.username} to {self.doctor.username}"

class ConsentRequest(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending Patient Review'),
        ('approved', 'Approved by Patient'),
        ('rejected', 'Rejected by Patient'),
        ('expired', 'Request Expired'),
        ('revoked', 'Access Revoked')
    )
    patient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_consent_requests')
    doctor = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_consent_requests')
    consultation = models.ForeignKey('Consultation', on_delete=models.SET_NULL, null=True, blank=True, related_name='consent_requests')
    requested_records = models.ManyToManyField('HealthRecord', blank=True, related_name='requested_in_consents')
    requested_categories = models.JSONField(default=list, blank=True, help_text="e.g. ['Prescriptions', 'Lab Reports', 'Clinical Notes']")
    access_purpose = models.TextField(help_text="Clinical justification / medical purpose for requesting record access")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    rejection_reason = models.TextField(blank=True, null=True)
    requested_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Consent Request #{self.id}: Dr. {self.doctor.username} -> Patient {self.patient.username} ({self.status})"

class PatientConsent(models.Model):
    STATUS_CHOICES = (
        ('active', 'Active Authorized'),
        ('expired', 'Expired'),
        ('revoked', 'Revoked by Patient')
    )
    DURATION_CHOICES = (
        ('consultation_only', 'Consultation Session Only'),
        ('24_hours', '24 Hours Window'),
        ('7_days', '7 Days Window'),
        ('custom', 'Custom Expiration')
    )
    patient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='patient_consents')
    doctor = models.ForeignKey(User, on_delete=models.CASCADE, related_name='doctor_consents')
    consultation = models.ForeignKey('Consultation', on_delete=models.SET_NULL, null=True, blank=True, related_name='active_consents')
    request = models.ForeignKey('ConsentRequest', on_delete=models.SET_NULL, null=True, blank=True, related_name='resulting_consents')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    duration_type = models.CharField(max_length=30, choices=DURATION_CHOICES, default='24_hours')
    valid_until = models.DateTimeField(help_text="Exact timestamp when this consent expires")
    can_view_prescriptions = models.BooleanField(default=True)
    can_view_lab_reports = models.BooleanField(default=True)
    can_view_clinical_notes = models.BooleanField(default=True)
    approved_at = models.DateTimeField(auto_now_add=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    revocation_reason = models.TextField(blank=True, null=True)

    @property
    def is_valid(self):
        return self.status == 'active' and self.valid_until > timezone.now()

    def __str__(self):
        return f"PatientConsent #{self.id}: Patient {self.patient.username} -> Dr. {self.doctor.username} ({self.status})"

class ConsentPermission(models.Model):
    consent = models.ForeignKey('PatientConsent', on_delete=models.CASCADE, related_name='permissions')
    record = models.ForeignKey('HealthRecord', on_delete=models.CASCADE, null=True, blank=True, related_name='consent_permissions')
    record_category = models.CharField(max_length=50, default='all', help_text="e.g. Lab Report, Clinical notes, Prescriptions")
    is_allowed = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Perm #{self.id} for Consent #{self.consent_id}: Category={self.record_category}, Allowed={self.is_allowed}"

class ConsentHistory(models.Model):
    ACTION_CHOICES = (
        ('REQUESTED', 'Access Requested by Doctor'),
        ('APPROVED', 'Access Approved by Patient'),
        ('REJECTED', 'Access Rejected by Patient'),
        ('REVOKED', 'Access Revoked by Patient'),
        ('MODIFIED', 'Consent Window Modified by Patient'),
        ('EXPIRED', 'Consent Window Expired'),
        ('EMERGENCY_ACCESS', 'Emergency Break-Glass Access Invoked')
    )
    consent = models.ForeignKey('PatientConsent', on_delete=models.SET_NULL, null=True, blank=True, related_name='history')
    request = models.ForeignKey('ConsentRequest', on_delete=models.SET_NULL, null=True, blank=True, related_name='history')
    patient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='consent_history_events')
    doctor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='doctor_consent_history_events')
    action = models.CharField(max_length=50, choices=ACTION_CHOICES)
    performed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='performed_consent_actions')
    details = models.TextField(blank=True, default='')
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.action} by {self.performed_by.username if self.performed_by else 'System'} at {self.timestamp}"

class RecordAccessLog(models.Model):
    ACCESS_TYPES = (
        ('VIEW', 'Viewed Record Metadata'),
        ('PREVIEW', 'Previewed Decrypted Record'),
        ('DOWNLOAD', 'Downloaded Decrypted Document'),
        ('DECRYPT', 'Decrypted AES-256 Payload')
    )
    STATUS_CHOICES = (
        ('AUTHORIZED', 'Authorized under Active Patient Consent'),
        ('DENIED', 'Access Denied - No Valid Consent'),
        ('EMERGENCY_OVERRIDE', 'Authorized under Emergency Break-Glass')
    )
    patient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='record_access_logs')
    doctor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='doctor_record_access_logs')
    record = models.ForeignKey('HealthRecord', on_delete=models.SET_NULL, null=True, blank=True, related_name='access_logs')
    consultation = models.ForeignKey('Consultation', on_delete=models.SET_NULL, null=True, blank=True)
    access_type = models.CharField(max_length=50, choices=ACCESS_TYPES, default='VIEW')
    permission_status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='AUTHORIZED')
    reason = models.TextField(blank=True, null=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.access_type} on Record #{self.record_id} by Dr. {self.doctor.username if self.doctor else 'Unknown'} - {self.permission_status}"

class EmergencyAccessSetting(models.Model):
    patient = models.OneToOneField(User, on_delete=models.CASCADE, related_name='emergency_access_setting')
    allow_emergency_break_glass = models.BooleanField(default=True, help_text="Allow doctors to break-glass access records in life-threatening emergencies")
    require_immediate_sms = models.BooleanField(default=True)
    require_immediate_email = models.BooleanField(default=True)
    auto_revoke_hours = models.IntegerField(default=2, help_text="Emergency access auto-expires after N hours")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Emergency Setting for {self.patient.username}: Allowed={self.allow_emergency_break_glass}"

class EmergencyAccessLog(models.Model):
    patient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='emergency_access_logs')
    doctor = models.ForeignKey(User, on_delete=models.CASCADE, related_name='emergency_doctor_access_logs')
    consultation = models.ForeignKey('Consultation', on_delete=models.SET_NULL, null=True, blank=True)
    justification = models.TextField(help_text="Detailed medical emergency clinical justification")
    duration_minutes = models.IntegerField(default=120)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    notified_patient = models.BooleanField(default=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"Emergency Break-Glass by Dr. {self.doctor.username} on Patient {self.patient.username} at {self.timestamp}"

class AuditLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='audit_logs')
    action = models.CharField(max_length=100, help_text="e.g., VIEW_HEALTH_RECORD, UPDATE_PRESCRIPTION")
    details = models.TextField()
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username if self.user else 'System'} - {self.action} at {self.timestamp}"

class Medicine(models.Model):
    name = models.CharField(max_length=150)
    category = models.CharField(max_length=100, default='General')
    price = models.DecimalField(max_digits=8, decimal_places=2, default=50.00)
    stock_quantity = models.IntegerField(default=100)
    description = models.TextField(blank=True, null=True)
    image_url = models.CharField(max_length=255, blank=True, null=True)

    def __str__(self):
        return f"{self.name} (BDT {self.price})"

class MedicineOrder(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending Confirmation'),
        ('confirmed', 'Confirmed'),
        ('packing', 'Packing'),
        ('shipping', 'In Transit'),
        ('out_for_delivery', 'Out for Delivery'),
        ('delivered', 'Delivered'),
        ('cancelled', 'Cancelled'),
    )
    patient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='medicine_orders')
    prescription = models.ForeignKey(Prescription, on_delete=models.SET_NULL, null=True, blank=True)
    delivery_address = models.TextField()
    items_breakdown = models.JSONField(default=list, help_text="List of items: [{medicine_id, name, price, quantity}]")
    delivery_fee = models.DecimalField(max_digits=8, decimal_places=2, default=50.00)
    total_price = models.DecimalField(max_digits=8, decimal_places=2, default=0.00)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Order {self.id} for {self.patient.username} - {self.status}"

class PatientImageProfile(models.Model):
    patient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='image_profiles')
    image_name = models.CharField(max_length=100)
    image_file = models.TextField(blank=True, null=True, help_text="Stored Base64 string of legacy image")
    previous_data = models.JSONField(default=dict, help_text="Stores vision extraction and metadata")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['patient']),
        ]

    def __str__(self):
        return f"Image profile for {self.patient.username} - {self.image_name}"

class OTPCode(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='otp_codes')
    code_hash = models.CharField(max_length=255)
    purpose = models.CharField(max_length=50, default='mfa')  # 'mfa', 'password_reset'
    expiry_time = models.DateTimeField()
    retry_attempts = models.IntegerField(default=0)
    is_used = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"OTP ({self.purpose}) for {self.user.username}"

class LoginAttempt(models.Model):
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    username = models.CharField(max_length=150)
    failed_count = models.IntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)
    last_attempt = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"LoginAttempt {self.username} ({self.failed_count} failures)"

class PaymentTransaction(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
        ('expired', 'Expired'),
    )
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='payment_transactions')
    order = models.ForeignKey(MedicineOrder, on_delete=models.CASCADE, null=True, blank=True, related_name='transactions')
    appointment = models.ForeignKey(Appointment, on_delete=models.CASCADE, null=True, blank=True, related_name='transactions')
    transaction_ref = models.CharField(max_length=100, unique=True, db_index=True)
    payment_method = models.CharField(max_length=50, default='sslcommerz') # 'sslcommerz', 'bkash', 'nagad', 'visa', 'mastercard'
    gateway = models.CharField(max_length=50, default='sslcommerz')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=10, default='BDT')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True)
    val_id = models.CharField(max_length=100, blank=True, null=True, db_index=True)
    bank_tran_id = models.CharField(max_length=100, blank=True, null=True)
    card_type = models.CharField(max_length=100, blank=True, null=True)
    card_brand = models.CharField(max_length=50, blank=True, null=True)
    failure_reason = models.TextField(blank=True, null=True)
    gateway_response = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Txn {self.transaction_ref} ({self.gateway}/{self.payment_method}) - {self.status}"

class BlockchainRecord(models.Model):
    record_type = models.CharField(max_length=50)  # 'health_record', 'prescription', 'audit_log', etc.
    record_id = models.IntegerField()
    data_hash = models.CharField(max_length=64)  # SHA-256
    prev_hash = models.CharField(max_length=64)
    block_number = models.IntegerField()
    timestamp = models.DateTimeField(auto_now_add=True)
    
    # Real Ethereum Sepolia Integration columns
    blockchain_network = models.CharField(max_length=50, default='Sepolia Sim')
    contract_address = models.CharField(max_length=66, blank=True, null=True)
    transaction_hash = models.CharField(max_length=66, blank=True, null=True)
    blockchain_block = models.IntegerField(blank=True, null=True)
    blockchain_record_id = models.IntegerField(blank=True, null=True)
    blockchain_status = models.CharField(max_length=20, default='BLOCKCHAIN_PENDING') # PENDING, CONFIRMED, FAILED
    anchored_at = models.DateTimeField(blank=True, null=True)

    def __str__(self):
        return f"Block #{self.block_number} - {self.record_type} #{self.record_id} ({self.blockchain_status})"

class TelephonyCall(models.Model):
    STATUS_CHOICES = (
        ('queued', 'Queued'),
        ('ringing', 'Ringing'),
        ('in-progress', 'In Progress'),
        ('completed', 'Completed'),
        ('busy', 'Busy'),
        ('failed', 'Failed'),
        ('no-answer', 'No Answer'),
        ('canceled', 'Canceled'),
    )
    MODE_CHOICES = (
        ('live', 'Live Twilio Voice PSTN'),
        ('mock', 'Sandbox Simulation'),
    )
    caller = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='telephony_calls')
    recipient_phone = models.CharField(max_length=30, help_text="E.164 formatted recipient phone number")
    from_phone = models.CharField(max_length=30, blank=True, null=True, help_text="Verified Twilio caller number")
    twilio_call_sid = models.CharField(max_length=64, unique=True, db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='queued')
    mode = models.CharField(max_length=10, choices=MODE_CHOICES, default='mock')
    consultation = models.ForeignKey(Consultation, on_delete=models.SET_NULL, null=True, blank=True, related_name='telephony_calls')
    started_at = models.DateTimeField(blank=True, null=True)
    ended_at = models.DateTimeField(blank=True, null=True)
    duration = models.IntegerField(default=0, help_text="Call duration in seconds")
    error_message = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"TelephonyCall {self.twilio_call_sid} to {self.recipient_phone} ({self.status} - {self.mode})"


class AIConversation(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='ai_conversations')
    conversation_id = models.CharField(max_length=64, unique=True, db_index=True)
    title = models.CharField(max_length=200, default='Health Assistant Consultation')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f"AIConversation {self.conversation_id} ({self.user.username})"


class AIMessage(models.Model):
    ROLE_CHOICES = (
        ('user', 'User'),
        ('assistant', 'Assistant'),
    )
    SAFETY_CHOICES = (
        ('normal', 'Normal'),
        ('emergency', 'Emergency Alert'),
    )
    conversation = models.ForeignKey(AIConversation, on_delete=models.CASCADE, related_name='messages')
    role = models.CharField(max_length=15, choices=ROLE_CHOICES)
    content = models.TextField()
    safety_level = models.CharField(max_length=20, choices=SAFETY_CHOICES, default='normal')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"AIMessage ({self.role}) in {self.conversation.conversation_id} at {self.created_at}"




