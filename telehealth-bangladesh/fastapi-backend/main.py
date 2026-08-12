import os
import json
import sqlite3
import datetime
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="HealNsightUpstream Worker", version="1.0.0")

# Enable CORS for frontend API calls
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Relative path to Django SQLite Database
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("DB_SQLITE_PATH", os.path.join(BASE_DIR, "..", "backend", "db.sqlite3"))

class VisionAnalysisRequest(BaseModel):
    patient: int
    image_name: str
    image_file: str  # Base64 string of the image

@app.get("/")
def read_root():
    return {"status": "FastAPI Upstream Worker is active on port 6000"}

@app.post("/api/vision/analyze")
def analyze_vision_image(request: VisionAnalysisRequest):
    """
    Simulates passing legacy image files (ECG graphics or CBC scans)
    through a Vision model to extract charts into text summaries,
    then stores them under previous_data.images.ecg_summary.
    """
    name_lower = request.image_name.lower()
    
    # Simulate Multimodal Vision Model (GPT-4o / Local LLaVA) extraction logic
    if "ecg" in name_lower or "electrocardiogram" in name_lower:
        extracted_summary = (
            "ECG Multimodal Scan Analysis:\n"
            "- Heart Rate: 74 bpm (Normal Sinus Rhythm)\n"
            "- PR Interval: 156 ms (Normal: 120-200 ms)\n"
            "- QRS Duration: 88 ms (Normal: < 120 ms)\n"
            "- QT Interval: 390 ms\n"
            "- Segment Findings: No ST-elevation or T-wave abnormalities detected. "
            "Axis deviation: Normal. Rhythm: Regular."
        )
    elif "cbc" in name_lower or "blood" in name_lower or "hemogram" in name_lower:
        extracted_summary = (
            "Complete Blood Count (CBC) Scan Analysis:\n"
            "- Hemoglobin: 14.2 g/dL (Normal: 12.0-16.0 g/dL)\n"
            "- Red Blood Cells: 4.6 million/uL\n"
            "- White Blood Cells: 6,800 /uL (Normal range)\n"
            "- Platelet Count: 245,000 /uL\n"
            "- Diagnostics: Hematocrit 42%. Differential count shows normal neutrophil and lymphocyte ratios."
        )
    else:
        extracted_summary = (
            f"Legacy Medical Graphic Scan ({request.image_name}):\n"
            "- Chart Text Summary: High resolution diagnostic graphic digitized.\n"
            "- Vision Model Audit: Visual axes and numerical markers captured successfully.\n"
            "- Findings: Clear traces visible, normal baseline trends, metrics within typical reference intervals."
        )

    # Store in Django DB (PostgreSQL or SQLite) under the api_patientimageprofile table
    try:
        previous_data = {
            "images": {
                "ecg_summary": extracted_summary
            }
        }
        previous_data_json = json.dumps(previous_data)
        created_at_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

        db_host = os.environ.get("DB_HOST")
        if db_host:
            import psycopg2
            conn = psycopg2.connect(
                dbname=os.environ.get("DB_NAME", "telehealth_bd"),
                user=os.environ.get("DB_USER", "postgres"),
                password=os.environ.get("DB_PASSWORD", "postgres"),
                host=db_host,
                port=os.environ.get("DB_PORT", "5432")
            )
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO api_patientimageprofile (patient_id, image_name, image_file, previous_data, created_at) "
                "VALUES (%s, %s, %s, %s, %s) RETURNING id",
                (request.patient, request.image_name, request.image_file, previous_data_json, created_at_iso)
            )
            profile_id = cursor.fetchone()[0]
            conn.commit()
            conn.close()
        else:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO api_patientimageprofile (patient_id, image_name, image_file, previous_data, created_at) "
                "VALUES (?, ?, ?, ?, ?)",
                (request.patient, request.image_name, request.image_file, previous_data_json, created_at_iso)
            )
            profile_id = cursor.lastrowid
            conn.commit()
            conn.close()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to commit vision analysis to database. Error: {str(e)}"
        )

    return {
        "id": profile_id,
        "patient": request.patient,
        "image_name": request.image_name,
        "image_file": request.image_file[:50] + "...",  # Truncated return
        "previous_data": previous_data,
        "created_at": created_at_iso
    }

# Mock Dialogue script for Speech-to-Text translation simulation
CONVERSATION_MOCK = [
    "Patient: Hello, doctor. Can you hear me clearly?",
    "Doctor: Yes, Kazi. The audio is coming through perfectly. How can I help you today?",
    "Patient: I have been experiencing some palpitations and chest discomfort, mostly in the morning.",
    "Doctor: I see. Did you upload your recent ECG scan before joining?",
    "Patient: Yes, I uploaded my legacy ECG chart from last week. The vision model summary should be in my profile.",
    "Doctor: Let me check... Ah yes! The vision model has processed the ECG. It indicates a normal sinus rhythm at 74 bpm.",
    "Doctor: There are no ST-segment elevations or T-wave abnormalities. That is very reassuring.",
    "Patient: Oh, that's a relief! So what could be causing the fluttering feeling?",
    "Doctor: It could be mild stress, caffeine intake, or transient dehydration. Let's do a quick physical observation.",
    "Doctor: I will also issue an E-Prescription for mild observation logs. Make sure to update your vitals daily.",
    "Patient: Thank you, doctor. I will update my sleep and blood pressure logs regularly."
]

@app.websocket("/ws/audio")
async def websocket_audio_endpoint(websocket: WebSocket):
    """
    Handles live wss:// connection from the client.
    Receives binary audio frames every 100ms, slices them, and streams back
    mock Speech-to-Text segments (clinical transcription) every few seconds.
    """
    await websocket.accept()
    dialogue_index = 0
    packet_count = 0
    accumulated_bytes = 0

    try:
        while True:
            # Receive audio frame (binary PCM data)
            data = await websocket.receive_bytes()
            packet_count += 1
            accumulated_bytes += len(data)
            
            # Every 3 seconds (30 packets of 100ms), stream back a simulated STT segment
            if packet_count >= 30:
                segment_text = CONVERSATION_MOCK[dialogue_index % len(CONVERSATION_MOCK)]
                dialogue_index += 1
                packet_count = 0
                
                await websocket.send_json({
                    "type": "transcription_segment",
                    "text": segment_text,
                    "bytes_processed": accumulated_bytes,
                    "timestamp": datetime.datetime.now().strftime("%I:%M:%S %p")
                })
                accumulated_bytes = 0
                
            # Yield control back to async event loop to handle other connections
            await asyncio.sleep(0.01)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[WS] WebSocket error: {e}")
    finally:
        try:
            await websocket.close()
        except:
            pass
