import json
from datetime import date, timedelta
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.conf import settings
from api.models import (
    DoctorProfile, PatientProfile, Appointment, 
    Consultation, Prescription, HealthRecord, 
    Consent, Medicine, MedicineOrder, AuditLog,
    BlockchainRecord, PaymentTransaction
)

User = get_user_model()

class Command(BaseCommand):
    help = "Purges old data safely and seeds database with fresh realistic HealNsightmock data"

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Forces database reset and purges old data',
        )

    def handle(self, *args, **options):
        self.stdout.write("\n========================================================")
        self.stdout.write("        HealNsightDATABASE INITIALIZER & SEEDER      ")
        self.stdout.write("========================================================\n")

        # Safe Mode check
        if not settings.DEBUG and not options.get('reset', False):
            self.stdout.write(self.style.ERROR(
                "CRITICAL WARNING: System is running in PRODUCTION/SAFE mode.\n"
                "To force reset database records, you must explicitly run:\n"
                "python manage.py seed_data --reset"
            ))
            return

        self.stdout.write("Safe Reset: Purging old telemedicine records...")
        
        # Safe deletion in correct dependency order to prevent FK errors
        PaymentTransaction.objects.all().delete()
        MedicineOrder.objects.all().delete()
        Medicine.objects.all().delete()
        BlockchainRecord.objects.all().delete()
        Consent.objects.all().delete()
        HealthRecord.objects.all().delete()
        Prescription.objects.all().delete()
        Consultation.objects.all().delete()
        Appointment.objects.all().delete()
        DoctorProfile.objects.all().delete()
        PatientProfile.objects.all().delete()
        AuditLog.objects.all().delete()
        
        # Purge all accounts
        User.objects.all().delete()
        
        self.stdout.write("Purging completed successfully.\n")

        # 1. Create Admins
        self.stdout.write("Seeding Admin Users...")
        admin_users = []
        for username in ['admin1', 'admin2']:
            admin_user = User.objects.create(
                username=username,
                email=f'{username}@healnsight.com.bd',
                first_name='System',
                last_name=username.capitalize(),
                role='admin',
                is_staff=True,
                is_superuser=True
            )
            admin_user.set_password('password123')
            admin_user.save()
            admin_users.append(admin_user)
            self.stdout.write(f"Admin Account: {username} / password123")

        # 2. Create Doctors
        self.stdout.write("\nSeeding Doctors...")
        doctors_data = [
            {
                'username': 'sarah',
                'first_name': 'Sarah',
                'last_name': 'Jenkins',
                'email': 'sarah@healnsight.com.bd',
                'phone': '+8801822223344',
                'bmdc_reg': 'BMDC/A-22334',
                'specialty': 'General Medicine',
                'experience': 10,
                'hospital': 'Dhaka Medical College Hospital',
                'fees': 500,
                'rating': 4.8,
                'bio': 'Consultant in General Medicine. Focused on E2EE diagnostics, family medicine, and seasonal health management.',
                'verification': 'approved'
            },
            {
                'username': 'zara',
                'first_name': 'Zara',
                'last_name': 'Ahmed',
                'email': 'zara@healnsight.com.bd',
                'phone': '+8801711112233',
                'bmdc_reg': 'BMDC/A-11223',
                'specialty': 'Cardiology',
                'experience': 14,
                'hospital': 'National Heart Foundation, Dhaka',
                'fees': 800,
                'rating': 4.9,
                'bio': 'Cardiology consultant. MBBS, MD (Cardiology). Specializes in coronary care, heart failure management, and ECG diagnostics.',
                'verification': 'approved'
            },
            {
                'username': 'kamal',
                'first_name': 'Kamal',
                'last_name': 'Islam',
                'email': 'kamal@healnsight.com.bd',
                'phone': '+8801988889900',
                'bmdc_reg': 'BMDC/A-88990',
                'specialty': 'ENT',
                'experience': 13,
                'hospital': 'Bangladesh ENT Hospital, Dhaka',
                'fees': 700,
                'rating': 4.7,
                'bio': 'ENT Specialist. MBBS, DLO. Specializes in treating chronic ear infections, nasal allergies, sinus management, and voice disorders.',
                'verification': 'approved'
            },
            {
                'username': 'sukarna',
                'first_name': 'Sukarna',
                'last_name': 'Roy',
                'email': 'sukarna@healnsight.com.bd',
                'phone': '+8801777777777',
                'bmdc_reg': 'BMDC/A-99999',
                'specialty': 'Medicine',
                'experience': 13,
                'hospital': 'Dhaka Medical College, Dhaka',
                'fees': 1000,
                'rating': 4.9,
                'bio': 'Medicine Specialist. MBBS, MD. Specializes in treating chronic diseases, infections, and providing comprehensive medical care.',
                'verification': 'pending'  # Set to pending so Admin can test approving
            }
        ]

        doctors_map = {}
        for d in doctors_data:
            user = User.objects.create(
                username=d['username'],
                first_name=d['first_name'],
                last_name=d['last_name'],
                email=d['email'],
                phone=d['phone'],
                role='doctor',
                bmdc_reg=d['bmdc_reg']
            )
            user.set_password('password123')
            user.save()

            profile = DoctorProfile.objects.create(
                user=user,
                specialty=d['specialty'],
                experience=d['experience'],
                hospital=d['hospital'],
                fees=d['fees'],
                rating=d['rating'],
                bio=d['bio'],
                online=True,
                verification_status=d['verification']
            )
            doctors_map[d['username']] = user
            self.stdout.write(f"Dr. {d['first_name']} {d['last_name']} ({d['specialty']}) - Email: {d['email']} [Status: {d['verification']}]")

        # 3. Create Patients
        self.stdout.write("\nSeeding Patients...")
        patients_data = [
            {
                'username': 'sadia',
                'first_name': 'Sadia',
                'last_name': 'Kader',
                'email': 'sadia@healnsight.com.bd',
                'phone': '+8801611002233',
                'nid': '1995447788990011',
                'dob': date(1995, 8, 20),
                'blood': 'O+',
                'address': 'Sector 4, Uttara, Dhaka',
                'emergency': 'Yeasmin Ara (+8801811000002)',
                'notes': 'Diagnosed with Type-2 diabetes. Takes metformin daily.'
            },
            {
                'username': 'niloy',
                'first_name': 'Niloy',
                'last_name': 'Hasan',
                'email': 'niloy@healnsight.com.bd',
                'phone': '+8801511001122',
                'nid': '1990442233112233',
                'dob': date(1990, 4, 15),
                'blood': 'A+',
                'address': 'House 12, Road 5, Dhanmondi, Dhaka',
                'emergency': 'Kazi Tariq (+8801711000001)',
                'notes': 'Mild hypertension under control. Regular blood pressure checkups.'
            },
            {
                'username': 'rakib',
                'first_name': 'Rakib',
                'last_name': 'Hasan',
                'email': 'rakib@healnsight.com.bd',
                'phone': '+8801711003344',
                'nid': '1988447788990022',
                'dob': date(1988, 12, 10),
                'blood': 'B+',
                'address': 'Block C, Mirpur-2, Dhaka',
                'emergency': 'Laila Bari (+8801911000003)',
                'notes': 'Prone to allergic skin rashes. Allergic to seafood.'
            },
            {
                'username': 'farhan',
                'first_name': 'Farhan',
                'last_name': 'Yeasmin',
                'email': 'farhan@healnsight.com.bd',
                'phone': '+8801811004455',
                'nid': '1992447788990033',
                'dob': date(1992, 3, 5),
                'blood': 'AB+',
                'address': 'Road 2, Banani, Dhaka',
                'emergency': 'Nasrin Ara (+8801511000004)',
                'notes': 'First pregnancy (2nd trimester). Regular maternity consults.'
            },
            {
                'username': 'nasir',
                'first_name': 'Kazi',
                'last_name': 'Nasir',
                'email': 'nasir@healnsight.com.bd',
                'phone': '+8801911005566',
                'nid': '1985447788990044',
                'dob': date(1985, 6, 25),
                'blood': 'O-',
                'address': 'Road 45, Gulshan-2, Dhaka',
                'emergency': 'Kamrul Islam (+8801611000005)',
                'notes': 'Chronic migraines triggered by sleep deprivation and stress.'
            }
        ]

        patients_map = {}
        for p in patients_data:
            user = User.objects.create(
                username=p['username'],
                first_name=p['first_name'],
                last_name=p['last_name'],
                email=p['email'],
                phone=p['phone'],
                role='patient',
                nid=p['nid']
            )
            user.set_password('password123')
            user.save()

            profile = PatientProfile.objects.create(
                user=user,
                date_of_birth=p['dob'],
                blood_group=p['blood'],
                address=p['address'],
                emergency_contact=p['emergency']
            )
            patients_map[p['username']] = user
            self.stdout.write(f"Patient {p['first_name']} {p['last_name']} - Email: {p['email']}")

        # 4. Seed Medicines
        self.stdout.write("\nSeeding Medicine Catalog...")
        medicines = [
            Medicine.objects.create(name="Napa Extend 665mg", category="Antipyretic / Painkiller", price=35.00, stock_quantity=500, description="Paracetamol 665mg extended release for fever and body ache."),
            Medicine.objects.create(name="Fexo 120mg", category="Antihistamine", price=120.00, stock_quantity=300, description="Fexofenadine HCI 120mg for allergic rhinitis and skin rashes."),
            Medicine.objects.create(name="Seclo 20mg", category="Gastric / PPI", price=85.00, stock_quantity=450, description="Omeprazole 20mg capsule for acid peptic disease."),
            Medicine.objects.create(name="Metformin 500mg", category="Antidiabetic", price=45.00, stock_quantity=400, description="Metformin hydrochloride 500mg for glucose regulation."),
            Medicine.objects.create(name="Amodis 400mg", category="Antibacterial", price=60.00, stock_quantity=250, description="Metronidazole 400mg tablet for bacterial and protozoal infections."),
            Medicine.objects.create(name="Azithrocin 500mg", category="Antibiotic", price=210.00, stock_quantity=200, description="Azithromycin 500mg tablet for respiratory infections.")
        ]
        for m in medicines:
            self.stdout.write(f"Medicine Seeded: {m.name} - BDT {m.price}")

        # 5. Seed Medical Health Records (Encrypted at rest)
        self.stdout.write("\nSeeding Hashed & Encrypted Medical Records...")
        records_data = [
            ('niloy', 'Blood Pressure Log', "Systolic: 132 mmHg, Diastolic: 84 mmHg, Pulse: 72 bpm. Logged after morning walk. Popular Diagnostic Center, Dhanmondi."),
            ('sadia', 'Glucose Log', "Fasting Blood Sugar: 7.2 mmol/L (Elevated), HbA1c: 6.9%. Post-prandial Sugar: 9.8 mmol/L. Ibn Sina Lab, Uttara."),
            ('rakib', 'Allergy Diagnosis Scan', "Slight dermatitis patch observed on upper forearm. Non-contagious. Avoid shrimp, crabs, and dust. Lazz Pharma Consultation notes."),
            ('farhan', 'Ultrasound Report', "Normal single live fetus. Gestational age: 24 weeks 3 days. Heartbeat: 145 bpm. Amniotic fluid index normal. Mitford Diagnostic."),
            ('nasir', 'Audiometry Report', "Decibel hearing response threshold within normal limits (20dB). No eardrum rupture. Minor inflammation resolved. CTG General Hospital.")
        ]

        for p_user, r_type, content in records_data:
            rec = HealthRecord(patient=patients_map[p_user], record_type=r_type)
            rec.set_content(content)  # Hashing and encrypting before saving
            rec.save()
            self.stdout.write(f"Record Encrypted: '{r_type}' bound for {p_user}")

        # 6. Seed Consent Tokens
        self.stdout.write("\nSeeding Clinical Security Consent Delegations...")
        consents_data = [
            ('niloy', 'zara', 48),  # Niloy grants Zara (Cardiologist) 48h access
            ('sadia', 'sarah', 24), # Sadia grants Sarah (General Med) 24h
            ('rakib', 'sarah', 12),  # Rakib grants Sarah 12h
            ('farhan', 'sarah', 24),  # Farhan grants Sarah 24h
            ('nasir', 'kamal', 24)   # Nasir grants Kamal (ENT) 24h
        ]

        for p_user, d_user, hours in consents_data:
            Consent.objects.create(
                patient=patients_map[p_user],
                doctor=doctors_map[d_user],
                record_type='all',
                granted=True,
                expires_at=timezone.now() + timedelta(hours=hours)
            )
            self.stdout.write(f"Consent Token Active: {p_user} -> Dr. {doctors_map[d_user].last_name} ({hours} hours)")

        # 7. Seed Telemedicine Activity (Appointments, Consultations, Prescriptions, Orders)
        self.stdout.write("\nSeeding Connected Consultations and Appointments...")
        
        # Scenario A: Completed checkup (Sadia and Dr. Sarah - Fever)
        appt_a = Appointment.objects.create(
            patient=patients_map['sadia'],
            doctor=doctors_map['sarah'],
            date=timezone.now().date() - timedelta(days=2),
            time="10:30 AM",
            reason="High fever (102 F) for 2 days with severe headache and joint pain.",
            status="completed"
        )
        consult_a = Consultation.objects.create(
            appointment=appt_a,
            type='chat',
            status='ended',
            start_time=timezone.now() - timedelta(days=2, hours=1),
            end_time=timezone.now() - timedelta(days=2)
        )
        presc_a = Prescription.objects.create(
            consultation=consult_a,
            doctor=doctors_map['sarah'],
            patient=patients_map['sadia'],
            symptoms="High fever (102°F), joint pain, loss of appetite, mild body ache.",
            diagnosis="Seasonal Viral Fever",
            medicines=json.dumps([
                {"name": "Napa Extend 665mg", "dosage": "1 tablet", "timing": "Three times daily after meals"},
                {"name": "Fexo 120mg", "dosage": "1 tablet", "timing": "Once daily at night"}
            ]),
            instructions="Drink plenty of warm saline. Cold damp towel compress on forehead. Complete rest for 3 days."
        )
        # Seed medicine order for this prescription
        order_a = MedicineOrder.objects.create(
            patient=patients_map['sadia'],
            prescription=presc_a,
            delivery_address="Sector 4, Uttara, Dhaka",
            items_breakdown=[
                {"medicine_id": 1, "name": "Napa Extend 665mg", "price": 35.0, "quantity": 2},
                {"medicine_id": 2, "name": "Fexo 120mg", "price": 120.0, "quantity": 1}
            ],
            delivery_fee=50.0,
            total_price=240.0,
            status="delivered"
        )
        PaymentTransaction.objects.create(
            order=order_a,
            transaction_ref="TXN-BKASH-889911",
            payment_method="bkash",
            amount=240.0,
            status="completed"
        )

        # Scenario B: Approved active consultation (Niloy and Dr. Zara - Hypertension)
        appt_b = Appointment.objects.create(
            patient=patients_map['niloy'],
            doctor=doctors_map['zara'],
            date=timezone.now().date(),
            time="09:00 AM",
            reason="Palpitations and fluctuating blood pressure readings in the morning.",
            status="approved"
        )
        Consultation.objects.create(
            appointment=appt_b,
            type='video',
            status='active',
            start_time=timezone.now() - timedelta(minutes=10)
        )

        # Scenario C: Pending Appointment (Sadia and Dr. Sarah - Diabetes)
        appt_c = Appointment.objects.create(
            patient=patients_map['sadia'],
            doctor=doctors_map['sarah'],
            date=timezone.now().date() + timedelta(days=1),
            time="02:30 PM",
            reason="Fasting blood sugar monitoring results review and drug dosage readjustment.",
            status="pending"
        )
        Consultation.objects.create(
            appointment=appt_c,
            type='chat',
            status='pending'
        )

        # Scenario E: Cancelled checkup (Rakib and Dr. Sarah - Skin Rash)
        Appointment.objects.create(
            patient=patients_map['rakib'],
            doctor=doctors_map['sarah'],
            date=timezone.now().date() - timedelta(days=1),
            time="04:00 PM",
            reason="Itchy red rashes spreading across hands and shoulders.",
            status="cancelled"
        )

        self.stdout.write("Appointments and linked E2EE sessions initialized.")

        # 8. Seed Blockchain Ledger
        self.stdout.write("\nSeeding Blockchain Integrity Records...")
        BlockchainRecord.objects.create(
            record_type="prescription",
            record_id=presc_a.id,
            data_hash="a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e",
            prev_hash="0000000000000000000000000000000000000000000000000000000000000000",
            block_number=1
        )
        self.stdout.write("Blockchain Genesis Block & Prescription integrity proof created.")

        # 9. Seed Audit Logs (compliance audit trail records)
        self.stdout.write("\nSeeding GDPR & HIPAA Audited Compliance Logs...")
        audit_records = [
            (admin_users[0], "USER_LOGIN", "Admin logged in from workstation. Compliance ledger verified.", "192.168.1.1"),
            (doctors_map['zara'], "KEY_ROTATION_SUCCESS", "Dr. Zara Ahmed rotated DH session keys. Active videolink secured.", "103.145.152.12"),
            (doctors_map['sarah'], "DECRYPT_PATIENT_RECORD", "Dr. Sarah Jenkins applied consent-key to view Sadia Chowdhury's Blood Report.", "103.145.152.20"),
            (patients_map['niloy'], "GRANT_CONSENT", "Patient Niloy delegated health record access keys to Dr. Zara Ahmed.", "172.16.50.4")
        ]
        for user, action, details, ip in audit_records:
            AuditLog.objects.create(
                user=user,
                action=action,
                details=details,
                ip_address=ip,
                timestamp=timezone.now() - timedelta(hours=3)
            )

        self.stdout.write("Compliance audit records seeded.")
        
        self.stdout.write("\n========================================================")
        self.stdout.write("             DEMO LOGIN CREDENTIALS CHEAT SHEET         ")
        self.stdout.write("========================================================")
        self.stdout.write("ADMIN PORTALS:")
        for a in admin_users:
            self.stdout.write(f"  Username: {a.username}  |  Password: password123")
        self.stdout.write("\nCERTIFIED DOCTOR ACCOUNTS (Password: password123):")
        for d in doctors_data:
            self.stdout.write(f"  Dr. {d['first_name']} {d['last_name']} ({d['specialty']}) -> Username: {d['username']} [Status: {d['verification']}]")
        self.stdout.write("\nPATIENT CITIZEN ACCOUNTS (Password: password123):")
        for p in patients_data:
            self.stdout.write(f"  {p['first_name']} {p['last_name']} -> Username: {p['username']}")
        self.stdout.write("========================================================\n")
        self.stdout.write(self.style.SUCCESS("[SUCCESS] HealNsightdatabase refreshed and seeded successfully!"))

