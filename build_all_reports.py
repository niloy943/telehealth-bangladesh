#!/usr/bin/env python3
"""
Master PDF Generator for HealNSight E-Prescription System
Generates:
1. HealNSight_Master_Implementation_Plan.pdf (Full Multi-Page Architecture Report)
2. HealNSight_Verified_EPrescription_Sample.pdf (Official High-Fidelity Clinical Prescription)
"""

import os
import re
import sys
from generate_pdf_engine import PdfDocument, sanitize_pdf_text

def build_implementation_plan_pdf(source_md_path, output_pdf_path):
    print(f"Reading source markdown from: {source_md_path}")
    with open(source_md_path, 'r', encoding='utf-8') as f:
        md_text = f.read()

    doc = PdfDocument()

    # Title Page / Banner
    doc.draw_rect(doc.mx, doc.y - 70, doc.content_w, 70, fill=(0.04, 0.16, 0.28), stroke=(0.02, 0.45, 0.72), line_width=1.5)
    doc.draw_text("HealNSight Telemedicine Bangladesh", doc.mx + 18, doc.y - 26, font='F2', size=15, color=(0.30, 0.80, 1.00))
    doc.draw_text("Secure E-Prescription System: Master Implementation Plan & Architecture", doc.mx + 18, doc.y - 44, font='F2', size=11, color=(1.0, 1.0, 1.0))
    doc.draw_text("AES-256-GCM Envelope Encryption * Hyperledger Fabric Blockchain * Google Authenticator TOTP", doc.mx + 18, doc.y - 58, font='F1', size=8.5, color=(0.75, 0.85, 0.95))
    doc.y -= 85

    lines = md_text.split('\n')
    i = 0
    in_code_block = False
    code_lines = []
    code_lang = ""

    while i < len(lines):
        raw_line = lines[i].rstrip('\r\n')
        line = raw_line.strip()

        # Handle Code Blocks
        if line.startswith("```"):
            if not in_code_block:
                in_code_block = True
                code_lang = line[3:].strip()
                code_lines = []
                i += 1
                continue
            else:
                in_code_block = False
                # Render code block
                render_code_block(doc, code_lines, code_lang)
                code_lines = []
                i += 1
                continue

        if in_code_block:
            code_lines.append(raw_line)
            i += 1
            continue

        # Skip main title if already drawn
        if line.startswith("# ") and i < 5:
            i += 1
            continue

        # Handle Empty Lines
        if not line:
            doc.y -= 6
            doc.check_space(15)
            i += 1
            continue

        # Handle Horizontal Rule
        if line in ["---", "___", "***"]:
            doc.check_space(15)
            doc.draw_line(doc.mx, doc.y, doc.mx + doc.content_w, doc.y, stroke=(0.80, 0.85, 0.90), line_width=1.0)
            doc.y -= 12
            i += 1
            continue

        # Handle Blockquotes
        if line.startswith(">"):
            quote_text = line.lstrip('>').strip()
            # Clean bold markers
            quote_text = re.sub(r'\*\*(.*?)\*\*', r'\1', quote_text)
            doc.check_space(32)
            wrapped = doc.wrap_text(quote_text, max_chars=86)
            box_h = max(24, len(wrapped) * 11 + 10)
            doc.draw_rect(doc.mx, doc.y - box_h, doc.content_w, box_h, fill=(0.95, 0.98, 1.0), stroke=None)
            doc.draw_line(doc.mx, doc.y, doc.mx, doc.y - box_h, stroke=(0.02, 0.52, 0.85), line_width=3.5)
            qy = doc.y - 12
            for ql in wrapped:
                doc.draw_text(ql, doc.mx + 12, qy, font='F3', size=8.5, color=(0.15, 0.25, 0.38))
                qy -= 11
            doc.y -= (box_h + 8)
            i += 1
            continue

        # Handle Table
        if line.startswith("|") and i + 1 < len(lines) and lines[i+1].strip().startswith("|"):
            table_lines = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                table_lines.append(lines[i].strip())
                i += 1
            render_markdown_table(doc, table_lines)
            continue

        # Handle Headings
        if line.startswith("## "):
            h_text = line[3:].strip()
            h_text = re.sub(r'\*\*(.*?)\*\*', r'\1', h_text)
            doc.check_space(35)
            doc.y -= 8
            # Section accent badge
            doc.draw_rect(doc.mx, doc.y - 16, 4, 16, fill=(0.02, 0.45, 0.72))
            doc.draw_text(h_text, doc.mx + 10, doc.y - 13, font='F2', size=12.5, color=(0.04, 0.22, 0.42))
            doc.draw_line(doc.mx, doc.y - 18, doc.mx + doc.content_w, doc.y - 18, stroke=(0.85, 0.90, 0.95), line_width=0.8)
            doc.y -= 26
            i += 1
            continue

        if line.startswith("### "):
            h_text = line[4:].strip()
            h_text = re.sub(r'\*\*(.*?)\*\*', r'\1', h_text)
            doc.check_space(24)
            doc.y -= 6
            doc.draw_text(h_text, doc.mx, doc.y - 10, font='F2', size=10.5, color=(0.10, 0.28, 0.48))
            doc.y -= 16
            i += 1
            continue

        if line.startswith("#### "):
            h_text = line[5:].strip()
            h_text = re.sub(r'\*\*(.*?)\*\*', r'\1', h_text)
            doc.check_space(18)
            doc.y -= 4
            doc.draw_text(h_text, doc.mx, doc.y - 9, font='F2', size=9.5, color=(0.18, 0.35, 0.52))
            doc.y -= 14
            i += 1
            continue

        # Handle Bullet items
        if line.startswith("- ") or line.startswith("* "):
            bullet_text = line[2:].strip()
            bullet_text = re.sub(r'\*\*(.*?)\*\*', r'\1', bullet_text)
            bullet_text = re.sub(r'`(.*?)`', r'\1', bullet_text)
            wrapped = doc.wrap_text(bullet_text, max_chars=86)
            doc.check_space(len(wrapped) * 12 + 4)
            # draw bullet mark
            doc.draw_text("*", doc.mx + 6, doc.y - 9, font='F2', size=11, color=(0.02, 0.45, 0.72))
            by = doc.y - 9
            for bl in wrapped:
                doc.draw_text(bl, doc.mx + 18, by, font='F1', size=9, color=(0.15, 0.20, 0.28))
                by -= 11.5
            doc.y = by - 2
            i += 1
            continue

        # Handle Numbered Lists
        num_match = re.match(r'^(\d+)\.\s+(.*)', line)
        if num_match:
            num_str = num_match.group(1) + "."
            item_text = num_match.group(2).strip()
            item_text = re.sub(r'\*\*(.*?)\*\*', r'\1', item_text)
            item_text = re.sub(r'`(.*?)`', r'\1', item_text)
            wrapped = doc.wrap_text(item_text, max_chars=84)
            doc.check_space(len(wrapped) * 12 + 4)
            doc.draw_text(num_str, doc.mx + 4, doc.y - 9, font='F2', size=9, color=(0.04, 0.22, 0.42))
            ny = doc.y - 9
            for nl in wrapped:
                doc.draw_text(nl, doc.mx + 20, ny, font='F1', size=9, color=(0.15, 0.20, 0.28))
                ny -= 11.5
            doc.y = ny - 2
            i += 1
            continue

        # Regular Paragraph
        p_text = line
        p_text = re.sub(r'\*\*(.*?)\*\*', r'\1', p_text)
        p_text = re.sub(r'`(.*?)`', r'\1', p_text)
        wrapped = doc.wrap_text(p_text, max_chars=90)
        doc.check_space(len(wrapped) * 12 + 4)
        py = doc.y - 9
        for pl in wrapped:
            doc.draw_text(pl, doc.mx, py, font='F1', size=9, color=(0.15, 0.20, 0.28))
            py -= 12
        doc.y = py - 3
        i += 1

    pdf_bytes = doc.finish_pdf("HealNSight Telemedicine", "Master Architecture & Implementation Plan")
    with open(output_pdf_path, 'wb') as f:
        f.write(pdf_bytes)
    print(f"Master Implementation Plan PDF successfully written: {output_pdf_path} ({len(pdf_bytes)} bytes)")
    return output_pdf_path

def render_code_block(doc, code_lines, lang):
    if not code_lines:
        return
    # Filter out empty ends
    while code_lines and not code_lines[0].strip():
        code_lines.pop(0)
    while code_lines and not code_lines[-1].strip():
        code_lines.pop()
    if not code_lines:
        return

    # Subdivide into wrapped lines
    display_lines = []
    for cl in code_lines:
        if len(cl) > 92:
            display_lines.extend(doc.wrap_text(cl, max_chars=92))
        else:
            display_lines.append(cl)

    # Limit chunk size to avoid infinite page break loop
    chunk_size = 45
    for start in range(0, len(display_lines), chunk_size):
        sub_chunk = display_lines[start:start + chunk_size]
        box_h = len(sub_chunk) * 10 + 12
        doc.check_space(box_h + 8)

        # Draw container
        doc.draw_rect(doc.mx, doc.y - box_h, doc.content_w, box_h, fill=(0.96, 0.97, 0.98), stroke=(0.85, 0.88, 0.92), line_width=0.7)
        doc.draw_line(doc.mx, doc.y, doc.mx, doc.y - box_h, stroke=(0.20, 0.50, 0.80), line_width=2.5)

        cy = doc.y - 9
        for cl in sub_chunk:
            doc.draw_text(cl, doc.mx + 8, cy, font='F4', size=7.2, color=(0.15, 0.20, 0.25))
            cy -= 10
        doc.y -= (box_h + 8)

def render_markdown_table(doc, table_lines):
    if len(table_lines) < 2:
        return
    headers = [c.strip() for c in table_lines[0].split('|')[1:-1]]
    if not headers:
        return
    
    rows = []
    for r in table_lines[1:]:
        # Skip separator line |:---|:---|
        if re.match(r'^[|\s:-]+$', r):
            continue
        cols = [c.strip() for c in r.split('|')[1:-1]]
        if cols:
            rows.append(cols)

    num_cols = len(headers)
    if num_cols == 0:
        return

    # Calculate column widths based on content
    col_w = doc.content_w / num_cols
    # Adjust for 3 or 4 cols if common
    col_widths = [col_w] * num_cols
    if num_cols == 3:
        col_widths = [doc.content_w * 0.25, doc.content_w * 0.50, doc.content_w * 0.25]
    elif num_cols == 4:
        col_widths = [doc.content_w * 0.20, doc.content_w * 0.35, doc.content_w * 0.25, doc.content_w * 0.20]
    elif num_cols == 2:
        col_widths = [doc.content_w * 0.32, doc.content_w * 0.68]

    # Render Header
    doc.check_space(24)
    doc.draw_rect(doc.mx, doc.y - 18, doc.content_w, 18, fill=(0.06, 0.18, 0.32), stroke=None)
    hx = doc.mx
    for idx, h in enumerate(headers):
        h_clean = re.sub(r'\*\*(.*?)\*\*', r'\1', h)
        doc.draw_text(h_clean[:28], hx + 5, doc.y - 13, font='F2', size=8.5, color=(1.0, 1.0, 1.0))
        hx += col_widths[idx]
    doc.y -= 18

    # Render Data Rows
    for row_idx, rcols in enumerate(rows):
        # Measure row height based on longest cell text
        cell_wrapped = []
        for c_idx in range(num_cols):
            val = rcols[c_idx] if c_idx < len(rcols) else ""
            val_clean = re.sub(r'\*\*(.*?)\*\*', r'\1', val)
            val_clean = re.sub(r'`(.*?)`', r'\1', val_clean)
            max_c = max(12, int(col_widths[c_idx] / 5.5))
            cell_wrapped.append(doc.wrap_text(val_clean, max_chars=max_c))
        
        max_lines = max([len(cw) for cw in cell_wrapped]) if cell_wrapped else 1
        row_h = max(16, max_lines * 10 + 6)
        doc.check_space(row_h + 2)

        # Zebra striping
        row_fill = (0.97, 0.98, 1.0) if row_idx % 2 == 1 else (1.0, 1.0, 1.0)
        doc.draw_rect(doc.mx, doc.y - row_h, doc.content_w, row_h, fill=row_fill, stroke=(0.88, 0.90, 0.94), line_width=0.5)

        cx = doc.mx
        for c_idx in range(num_cols):
            cy = doc.y - 10
            for line_str in cell_wrapped[c_idx]:
                doc.draw_text(line_str, cx + 5, cy, font='F1', size=8, color=(0.15, 0.20, 0.25))
                cy -= 10
            cx += col_widths[c_idx]
        doc.y -= row_h

    doc.y -= 10


def build_clinical_prescription_pdf(output_pdf_path):
    print("Generating official clinical prescription sample PDF...")
    doc = PdfDocument()

    # 1. Top Clinical Banner
    doc.draw_rect(doc.mx, doc.y - 75, doc.content_w, 75, fill=(0.02, 0.42, 0.68), stroke=None)
    doc.draw_text("HealNSight Telemedicine Services", doc.mx + 16, doc.y - 24, font='F2', size=16, color=(1, 1, 1))
    doc.draw_text("National Digital Health & E-Prescription Portal of Bangladesh", doc.mx + 16, doc.y - 40, font='F1', size=9.5, color=(0.85, 0.94, 1.0))
    doc.draw_text("DGHS & BMDC Approved Clinical Tele-Consultation Platform", doc.mx + 16, doc.y - 54, font='F3', size=8.5, color=(0.75, 0.88, 0.98))

    # Doctor Credentials Box (Right Top)
    doc.draw_rect(doc.pw - doc.mx - 220, doc.y - 70, 212, 65, fill=(0.04, 0.25, 0.45), stroke=(0.20, 0.60, 0.85), line_width=1.0)
    doc.draw_text("Dr. Rafiqul Islam", doc.pw - doc.mx - 212, doc.y - 20, font='F2', size=11, color=(1, 1, 1))
    doc.draw_text("MBBS (DMC), FCPS, MD (Cardiology)", doc.pw - doc.mx - 212, doc.y - 32, font='F1', size=8.5, color=(0.85, 0.95, 1.0))
    doc.draw_text("BMDC Reg No: A-48912 | Specialist Card", doc.pw - doc.mx - 212, doc.y - 44, font='F2', size=8.5, color=(1.0, 0.85, 0.35))
    doc.draw_text("Telemedicine Unit, Dhaka Medical College Hospital", doc.pw - doc.mx - 212, doc.y - 56, font='F1', size=7.8, color=(0.80, 0.90, 0.98))
    doc.y -= 88

    # 2. Consultation & Prescription Metadata Strip
    doc.draw_rect(doc.mx, doc.y - 24, doc.content_w, 24, fill=(0.94, 0.96, 0.98), stroke=(0.80, 0.85, 0.90), line_width=0.8)
    doc.draw_text("Prescription ID: RX-2026-98412-BGD", doc.mx + 12, doc.y - 16, font='F2', size=9, color=(0.05, 0.25, 0.45))
    doc.draw_text("Consultation ID: CONS-77401-DHAKA", doc.mx + 180, doc.y - 16, font='F1', size=8.5, color=(0.25, 0.35, 0.45))
    doc.draw_text("Date: 03-Nov-2026 | Time: 11:45 AM BST", doc.mx + 340, doc.y - 16, font='F1', size=8.5, color=(0.25, 0.35, 0.45))
    doc.y -= 32

    # 3. Patient Vitals & Demographics Card
    card_h = 56
    doc.draw_rect(doc.mx, doc.y - card_h, doc.content_w, card_h, fill=(1, 1, 1), stroke=(0.78, 0.85, 0.92), line_width=1.0)
    # Left vertical accent
    doc.draw_rect(doc.mx, doc.y - card_h, 4, card_h, fill=(0.02, 0.52, 0.85))

    doc.draw_text("PATIENT INFORMATION & VITALS", doc.mx + 12, doc.y - 14, font='F2', size=8.5, color=(0.02, 0.42, 0.68))
    doc.draw_text("Name: Farhana Ahmed", doc.mx + 12, doc.y - 28, font='F2', size=10, color=(0.10, 0.15, 0.22))
    doc.draw_text("Age / Gender: 38 Years / Female", doc.mx + 12, doc.y - 42, font='F1', size=8.5, color=(0.25, 0.30, 0.38))

    doc.draw_text("Vitals: BP 128/82 mmHg | Pulse: 76 bpm", doc.mx + 190, doc.y - 28, font='F1', size=8.5, color=(0.15, 0.25, 0.35))
    doc.draw_text("SpO2: 99% | Body Temp: 98.4 F | Wt: 64 kg", doc.mx + 190, doc.y - 42, font='F1', size=8.5, color=(0.15, 0.25, 0.35))

    # Allergies Warning Box
    doc.draw_rect(doc.mx + 360, doc.y - card_h + 8, 135, 38, fill=(1.0, 0.95, 0.95), stroke=(0.90, 0.60, 0.60), line_width=0.8)
    doc.draw_text("KNOWN ALLERGIES:", doc.mx + 366, doc.y - 22, font='F2', size=7.5, color=(0.75, 0.15, 0.15))
    doc.draw_text("Penicillin, Sulfa drugs", doc.mx + 366, doc.y - 36, font='F2', size=8.5, color=(0.85, 0.10, 0.10))
    doc.y -= (card_h + 12)

    # 4. Clinical Diagnosis & Chief Complaints
    doc.draw_rect(doc.mx, doc.y - 36, doc.content_w, 36, fill=(0.97, 0.98, 1.0), stroke=(0.85, 0.88, 0.94), line_width=0.7)
    doc.draw_text("Clinical Diagnosis:", doc.mx + 10, doc.y - 14, font='F2', size=9, color=(0.05, 0.25, 0.45))
    doc.draw_text("Essential Hypertension (Stage 1, ICD-10 I10) & Chronic Fatigue", doc.mx + 105, doc.y - 14, font='F2', size=9.5, color=(0.12, 0.18, 0.25))
    doc.draw_text("Chief Symptoms: Recurrent occipital headaches, mild exertional dyspnea, intermittent palpitations", doc.mx + 10, doc.y - 28, font='F1', size=8.5, color=(0.30, 0.35, 0.45))
    doc.y -= 46

    # 5. Rx Symbol & Medication Table
    doc.draw_text("Rx", doc.mx + 2, doc.y - 16, font='F2', size=22, color=(0.02, 0.42, 0.68))
    doc.draw_text("(Prescribed Medications & Administration Regimen)", doc.mx + 34, doc.y - 11, font='F2', size=9.5, color=(0.10, 0.25, 0.40))
    doc.y -= 24

    med_headers = ["No.", "Medication / Brand (Generic)", "Dosage", "Schedule / Frequency", "Duration", "Instruction"]
    med_col_w = [25, 170, 55, 95, 60, 100]
    
    # Table Header
    doc.draw_rect(doc.mx, doc.y - 18, doc.content_w, 18, fill=(0.04, 0.22, 0.38), stroke=None)
    tx = doc.mx
    for idx, mh in enumerate(med_headers):
        doc.draw_text(mh, tx + 4, doc.y - 13, font='F2', size=8, color=(1, 1, 1))
        tx += med_col_w[idx]
    doc.y -= 18

    med_data = [
        ("1", "Tab. Micardis (Telmisartan)", "40 mg", "1 + 0 + 0 (Morning)", "30 Days", "After breakfast daily"),
        ("2", "Tab. Concor (Bisoprolol Fumarate)", "2.5 mg", "0 + 0 + 1 (Night)", "30 Days", "Before bed with water"),
        ("3", "Tab. Coralcal-D (Calcium Orotate + D3)", "740 mg", "0 + 1 + 0 (Noon)", "60 Days", "After lunch daily"),
        ("4", "Cap. Maxpro (Esomeprazole Magnesium)", "20 mg", "1 + 0 + 1 (M + N)", "14 Days", "30 mins before meals")
    ]

    for ridx, row in enumerate(med_data):
        row_h = 24
        fill_col = (0.97, 0.98, 1.0) if ridx % 2 == 1 else (1.0, 1.0, 1.0)
        doc.draw_rect(doc.mx, doc.y - row_h, doc.content_w, row_h, fill=fill_col, stroke=(0.85, 0.88, 0.92), line_width=0.5)
        tx = doc.mx
        for cidx, cell in enumerate(row):
            font_choice = 'F2' if cidx in [0, 1] else 'F1'
            color_choice = (0.05, 0.20, 0.35) if cidx == 1 else (0.15, 0.20, 0.28)
            doc.draw_text(cell, tx + 4, doc.y - 15, font=font_choice, size=8.5, color=color_choice)
            tx += med_col_w[cidx]
        doc.y -= row_h

    doc.y -= 14

    # 6. Clinical Advice & Investigations Requested
    doc.draw_rect(doc.mx, doc.y - 50, doc.content_w, 50, fill=(0.98, 0.99, 1.0), stroke=(0.82, 0.86, 0.92), line_width=0.8)
    doc.draw_text("Physician's Guidance & Follow-up Instructions:", doc.mx + 10, doc.y - 14, font='F2', size=9, color=(0.04, 0.22, 0.40))
    doc.draw_text("1. Strict dietary sodium restriction (< 2 grams/day). Avoid added table salt, processed foods, and pickles.", doc.mx + 14, doc.y - 26, font='F1', size=8.5, color=(0.18, 0.24, 0.32))
    doc.draw_text("2. Maintain daily blood pressure log (Morning & Evening measurements) for 14 consecutive days.", doc.mx + 14, doc.y - 38, font='F1', size=8.5, color=(0.18, 0.24, 0.32))
    doc.draw_text("3. Follow-up consultation scheduled in 4 weeks or immediately if systolic BP > 160 mmHg.", doc.mx + 14, doc.y - 50, font='F2', size=8.5, color=(0.75, 0.20, 0.10))
    doc.y -= 60

    # 7. Security Architecture & Cryptographic Proof Seal (Bottom Block)
    sec_h = 75
    doc.draw_rect(doc.mx, doc.y - sec_h, doc.content_w, sec_h, fill=(0.03, 0.12, 0.22), stroke=(0.02, 0.50, 0.85), line_width=1.2)
    
    # Left Badge
    doc.draw_rect(doc.mx + 12, doc.y - sec_h + 12, 50, 50, fill=(0.06, 0.20, 0.35), stroke=(0.25, 0.75, 0.95), line_width=1.0)
    doc.draw_text("VERIFIED", doc.mx + 16, doc.y - 28, font='F2', size=7.5, color=(0.35, 0.95, 0.65))
    doc.draw_text("BLOCK", doc.mx + 20, doc.y - 40, font='F2', size=8.5, color=(1, 1, 1))
    doc.draw_text("CHAIN", doc.mx + 18, doc.y - 52, font='F2', size=8.5, color=(0.30, 0.80, 1.0))

    # Security Details
    doc.draw_text("SECURITY GUARANTEE & CRYPTOGRAPHIC VERIFICATION PROOF", doc.mx + 72, doc.y - 18, font='F2', size=9, color=(0.35, 0.85, 1.00))
    doc.draw_text("Layer 1: AES-256-GCM Envelope Encrypted (Cloud KMS Key-Wrapped Payload)", doc.mx + 72, doc.y - 30, font='F1', size=8, color=(0.85, 0.92, 0.98))
    doc.draw_text("Layer 2: Hyperledger Fabric Immutable Anchor TxID: 0x7f8841a9bc348214d021c998c56fa8e", doc.mx + 72, doc.y - 42, font='F4', size=7.5, color=(0.75, 0.88, 0.98))
    doc.draw_text("Layer 3: SHA-256 Document Integrity Digest: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", doc.mx + 72, doc.y - 54, font='F4', size=7.0, color=(0.70, 0.85, 0.95))
    doc.draw_text("Layer 4: Clinician Signature Digitally Verified via Google Authenticator (RFC 6238 TOTP) [CONFIRMED]", doc.mx + 72, doc.y - 66, font='F2', size=7.8, color=(0.40, 0.95, 0.60))

    pdf_bytes = doc.finish_pdf("HealNSight Official Clinical Record", "E-Prescription")
    with open(output_pdf_path, 'wb') as f:
        f.write(pdf_bytes)
    print(f"Sample Clinical Prescription PDF successfully written: {output_pdf_path} ({len(pdf_bytes)} bytes)")
    return output_pdf_path

if __name__ == "__main__":
    src_md = "/Users/mdniloy/.gemini/antigravity/brain/d8377e63-709e-4ddb-966e-c271656ae01b/full_e_prescription_system_implementation_plan.md"
    plan_pdf = "/Users/mdniloy/Downloads/telehealth bangladesh/HealNSight_Master_Implementation_Plan.pdf"
    rx_pdf = "/Users/mdniloy/Downloads/telehealth bangladesh/HealNSight_Verified_EPrescription_Sample.pdf"

    build_implementation_plan_pdf(src_md, plan_pdf)
    build_clinical_prescription_pdf(rx_pdf)
    print("ALL PDF GENERATION COMPLETE!")

