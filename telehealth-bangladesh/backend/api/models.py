from django.db import models
from django.contrib.auth.models import AbstractUser
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

class DoctorProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='doctor_profile')
    specialty = models.CharField(max_length=100)
    experience = models.IntegerField(default=1)
    hospital = models.CharField(max_length=150, blank=True, null=True)
    fees = models.DecimalField(max_digits=8, decimal_places=0, default=500, help_text="Consultation fee in BDT")
    rating = models.FloatField(default=4.5)
    bio = models.TextField(blank=True, null=True)
    online = models.BooleanField(default=True)

    def __str__(self):
        return f"Dr. {self.user.first_name or self.user.username} - {self.specialty}"

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
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.patient.username} with {self.doctor.username} on {self.date}"

class Consultation(models.Model):
    TYPE_CHOICES = (
        ('chat', 'Chat'),
        ('video', 'Video'),
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
    start_time = models.DateTimeField(blank=True, null=True)
    end_time = models.DateTimeField(blank=True, null=True)

    def __str__(self):
        return f"Consultation {self.id} ({self.type}) for Appointment {self.appointment.id}"

class Prescription(models.Model):
    consultation = models.OneToOneField(Consultation, on_delete=models.CASCADE, related_name='prescription')
    doctor = models.ForeignKey(User, on_delete=models.CASCADE, related_name='written_prescriptions')
    patient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_prescriptions')
    date = models.DateField(auto_now_add=True)
    symptoms = models.TextField()
    diagnosis = models.TextField()
    medicines = models.TextField(help_text="JSON list of medications: drug name, dosage, timing")
    instructions = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"Prescription {self.id} for {self.patient.username}"

class HealthRecord(models.Model):
    patient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='health_records')
    record_type = models.CharField(max_length=50, help_text="e.g., Blood report, Clinical notes")
    encrypted_data = models.TextField(help_text="Encrypted JSON data representing health statistics/metrics")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Automatically handle at-rest encryption before writing/saving to DB
    def set_content(self, raw_text: str):
        self.encrypted_data = encrypt_value(raw_text)

    def get_content(self) -> str:
        return decrypt_value(self.encrypted_data)

    def __str__(self):
        return f"{self.record_type} for patient {self.patient.username}"

class Consent(models.Model):
    patient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='given_consents')
    doctor = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_consents')
    record_type = models.CharField(max_length=50, default='all', help_text="Specific record type or 'all'")
    granted = models.BooleanField(default=True)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        status = "Granted" if self.granted else "Revoked"
        return f"Consent {status} by {self.patient.username} to {self.doctor.username}"

class AuditLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='audit_logs')
    action = models.CharField(max_length=100, help_text="e.g., VIEW_HEALTH_RECORD, UPDATE_PRESCRIPTION")
    details = models.TextField()
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username if self.user else 'System'} - {self.action} at {self.timestamp}"

class MedicineOrder(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending Confirmation'),
        ('packing', 'Packing'),
        ('shipping', 'In Transit'),
        ('delivered', 'Delivered'),
    )
    patient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='medicine_orders')
    prescription = models.ForeignKey(Prescription, on_delete=models.SET_NULL, null=True, blank=True)
    delivery_address = models.TextField()
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='pending')
    total_price = models.DecimalField(max_digits=8, decimal_places=0, default=0)
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
