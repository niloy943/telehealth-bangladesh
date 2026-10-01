import urllib.request
import json
import time

BASE_URL = "http://127.0.0.1:8000"

def post_json(endpoint, data, token=None):
    url = f"{BASE_URL}{endpoint}"
    req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers={
        "Content-Type": "application/json",
        **({"Authorization": f"Bearer {token}"} if token else {})
    }, method="POST")
    with urllib.request.urlopen(req) as resp:
        return resp.status, json.loads(resp.read().decode('utf-8'))

def get_json(endpoint, token=None):
    url = f"{BASE_URL}{endpoint}"
    req = urllib.request.Request(url, headers={
        **({"Authorization": f"Bearer {token}"} if token else {})
    }, method="GET")
    with urllib.request.urlopen(req) as resp:
        return resp.status, json.loads(resp.read().decode('utf-8'))

def patch_json(endpoint, data, token=None):
    url = f"{BASE_URL}{endpoint}"
    req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers={
        "Content-Type": "application/json",
        **({"Authorization": f"Bearer {token}"} if token else {})
    }, method="PATCH")
    with urllib.request.urlopen(req) as resp:
        return resp.status, json.loads(resp.read().decode('utf-8'))

def put_json(endpoint, data, token=None):
    url = f"{BASE_URL}{endpoint}"
    req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers={
        "Content-Type": "application/json",
        **({"Authorization": f"Bearer {token}"} if token else {})
    }, method="PUT")
    with urllib.request.urlopen(req) as resp:
        return resp.status, json.loads(resp.read().decode('utf-8'))

def run_tests():
    print("--- 1. Authenticate Patient (sadia) & Doctor (sarah) ---")
    _, p_auth = post_json("/api/login/", {"username": "sadia", "password": "password123"})
    patient_token = p_auth["access"]
    print("✓ Patient authenticated:", p_auth["user"]["username"])

    _, d_auth = post_json("/api/login/", {"username": "sarah", "password": "password123"})
    doctor_token = d_auth["access"]
    doctor_id = d_auth["user"]["id"]
    print(f"✓ Doctor authenticated: {d_auth['user']['username']} (ID: {doctor_id})")

    print("\n--- 2. Patient books an Anonymous Consultation ---")
    appt_payload = {
        "doctor": doctor_id,
        "date": "2026-10-20",
        "time": "11:00 AM",
        "reason": "Requesting confidential audio consultation for anxiety and fatigue",
        "consultation_type": "audio",
        "is_anonymous": True,
        "audio_only": True
    }
    status, appt_data = post_json("/api/appointments/", appt_payload, patient_token)
    assert status == 201, f"Expected 201, got {status}"
    appt_id = appt_data["id"]
    anon_session_id = appt_data.get("anonymous_session_id")
    print(f"✓ Appointment #{appt_id} booked!")
    print(f"  - is_anonymous: {appt_data.get('is_anonymous')}")
    print(f"  - anonymous_session_id: {anon_session_id}")
    print(f"  - consultation_type: {appt_data.get('consultation_type')}")
    assert appt_data.get('is_anonymous') is True, "is_anonymous should be True"
    assert anon_session_id and len(anon_session_id) == 6, f"Invalid anonymous_session_id: {anon_session_id}"

    print("\n--- 3. Verify Doctor's Appointments View (Zero PII / IDOR Verification) ---")
    status, doc_appts = get_json("/api/appointments/", doctor_token)
    assert status == 200
    target_appt = next((a for a in doc_appts if a["id"] == appt_id), None)
    assert target_appt is not None, "Booked appointment not found in doctor's list"

    print("Checking for PII leaks in doctor's appointment list:")
    print("  - raw patient ID:", target_appt.get("patient"))
    print("  - patient_details:", target_appt.get("patient_details"))
    assert target_appt.get("patient") is None, "CRITICAL SECURITY FAULT: Raw patient ID leaked to doctor!"
    pat_details = target_appt.get("patient_details", {})
    assert "sadia" not in str(pat_details).lower(), "CRITICAL SECURITY FAULT: Real username leaked to doctor!"
    assert pat_details.get("phone") == "HIDDEN_ANONYMOUS", "CRITICAL SECURITY FAULT: Phone number leaked!"
    assert pat_details.get("username") == f"Anonymous Patient #{anon_session_id}", "Anonymous username mismatch!"
    print("✓ Doctor's appointment view is completely anonymized. Zero PII/IDOR leaks.")

    print("\n--- 4. Doctor Approves Consultation ---")
    status, approved_data = put_json(f"/api/appointments/{appt_id}/", {"action": "approve"}, doctor_token)
    assert status == 200
    consultation_id = approved_data.get("consultation", {}).get("id")
    print(f"✓ Appointment approved. Linked Consultation ID: {consultation_id}")

    print("\n--- 5. Doctor Fetches Consultation Details (/api/consultations/<id>/) ---")
    status, consult_meta = get_json(f"/api/consultations/{consultation_id}/", doctor_token)
    assert status == 200
    print("Consultation metadata returned to doctor:")
    print("  - type:", consult_meta.get("type"))
    print("  - audio_only:", consult_meta.get("audio_only"))
    print("  - is_anonymous:", consult_meta.get("is_anonymous"))
    print("  - anonymous_identifier:", consult_meta.get("anonymous_identifier"))
    print("  - patient:", consult_meta.get("patient"))

    assert consult_meta.get("audio_only") is True, "audio_only should be True"
    assert consult_meta.get("is_anonymous") is True, "is_anonymous should be True"
    assert consult_meta.get("patient", {}).get("id") is None, "Patient ID must be None for doctor"
    assert consult_meta.get("patient", {}).get("phone") == "", "Patient phone must be empty for doctor"
    assert consult_meta.get("patient", {}).get("blood_group") == "", "Patient blood group must be empty for doctor"
    assert consult_meta.get("patient", {}).get("name") == f"Anonymous Patient #{anon_session_id}"
    print("✓ Consultation detail endpoint enforces complete privacy protection.")

    print("\n--- 6. Start Consultation & Test Duration Tracking ---")
    status, start_data = patch_json(f"/api/consultations/{consultation_id}/", {"action": "start"}, doctor_token)
    assert status == 200
    assert start_data.get("status") == "active"
    assert start_data.get("started_at") is not None
    print(f"✓ Consultation active. started_at: {start_data.get('started_at')}")

    time.sleep(2)  # Simulate 2 seconds of consultation duration

    print("\n--- 7. End Consultation & Verify Calculated Duration ---")
    status, end_data = patch_json(f"/api/consultations/{consultation_id}/", {"action": "end"}, doctor_token)
    assert status == 200
    assert end_data.get("status") == "ended"
    assert end_data.get("ended_at") is not None
    assert end_data.get("duration", 0) >= 1, f"Expected duration >= 1, got {end_data.get('duration')}"
    print(f"✓ Consultation ended. ended_at: {end_data.get('ended_at')}, duration: {end_data.get('duration')}s")

    print("\n=======================================================")
    print("  ALL ANONYMOUS CONSULTATION VERIFICATIONS PASSED!")
    print("=======================================================")

if __name__ == "__main__":
    run_tests()
