#!/usr/bin/env python3
"""
High-Fidelity PDF Generation Engine for HealNSight Telemedicine
Generates:
1. HealNSight_Master_Implementation_Plan.pdf
2. HealNSight_Verified_EPrescription_Sample.pdf
"""

import os
import re
import sys

def sanitize_pdf_text(text):
    if not text:
        return ""
    replacements = {
        '→': '->', '←': '<-', '↔': '<->', '•': '*', '—': '--', '–': '-',
        '“': '"', '”': '"', '‘': "'", '’': "'", '✅': '[PASS]', '❌': '[FAIL]',
        '⚠️': '[WARN]', '🔒': '[SECURE]', '🟢': '[RUNNING]', '…': '...',
        '≥': '>=', '≤': '<=', '±': '+/-', '°': ' deg ', '×': 'x', '·': '-',
        '≈': '~=', '≠': '!=', '✓': '[OK]', '➜': '->', '➔': '->'
    }
    for k, v in replacements.items():
        text = text.replace(k, v)
    text = text.encode('latin1', 'replace').decode('latin1')
    return text.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')

class PdfDocument:
    def __init__(self, page_width=595.28, page_height=841.89, margin_x=45, margin_top=55, margin_bottom=55):
        self.pw = page_width
        self.ph = page_height
        self.mx = margin_x
        self.mt = margin_top
        self.mb = margin_bottom
        self.content_w = page_width - (2 * margin_x)
        self.content_h = page_height - margin_top - margin_bottom
        
        self.pages = []  # list of byte streams
        self.current_cmds = []
        self.fonts = {
            'F1': 'Helvetica',
            'F2': 'Helvetica-Bold',
            'F3': 'Helvetica-Oblique',
            'F4': 'Courier',
            'F5': 'Courier-Bold'
        }
        self.y = self.ph - self.mt

    def new_page(self):
        if self.current_cmds:
            self.pages.append(b''.join(self.current_cmds))
            self.current_cmds = []
        self.y = self.ph - self.mt

    def add_cmd(self, cmd_str):
        self.current_cmds.append(cmd_str.encode('latin1') + b'\n')

    def check_space(self, needed):
        if self.y - needed < self.mb:
            self.new_page()
            return True
        return False

    def draw_rect(self, x, y, w, h, fill=None, stroke=None, line_width=1.0):
        cmds = []
        if stroke:
            r, g, b = stroke
            cmds.append(f"{line_width:.2f} w {r:.3f} {g:.3f} {b:.3f} RG")
        if fill:
            r, g, b = fill
            cmds.append(f"{r:.3f} {g:.3f} {b:.3f} rg")
        cmds.append(f"{x:.2f} {y:.2f} {w:.2f} {h:.2f} re")
        if fill and stroke:
            cmds.append("B")
        elif fill:
            cmds.append("f")
        elif stroke:
            cmds.append("S")
        self.add_cmd(" ".join(cmds))

    def draw_line(self, x1, y1, x2, y2, stroke=(0.7, 0.7, 0.7), line_width=0.8):
        r, g, b = stroke
        self.add_cmd(f"{line_width:.2f} w {r:.3f} {g:.3f} {b:.3f} RG {x1:.2f} {y1:.2f} m {x2:.2f} {y2:.2f} l S")

    def draw_text(self, text, x, y, font='F1', size=10, color=(0.1, 0.1, 0.1)):
        r, g, b = color
        safe_str = sanitize_pdf_text(text)
        cmd = f"BT /{font} {size:.1f} Tf {r:.3f} {g:.3f} {b:.3f} rg {x:.2f} {y:.2f} Td ({safe_str}) Tj ET"
        self.add_cmd(cmd)

    def wrap_text(self, text, max_chars):
        words = text.split()
        lines = []
        curr = []
        curr_len = 0
        for w in words:
            if curr_len + len(w) + (1 if curr else 0) <= max_chars:
                curr.append(w)
                curr_len += len(w) + (1 if curr else 0)
            else:
                if curr:
                    lines.append(" ".join(curr))
                curr = [w]
                curr_len = len(w)
        if curr:
            lines.append(" ".join(curr))
        return lines or [""]

    def finish_pdf(self, doc_title="HealNSight Telemedicine", doc_type="Plan"):
        if self.current_cmds:
            self.pages.append(b''.join(self.current_cmds))
            self.current_cmds = []

        total_pages = len(self.pages)
        
        # Second pass: prepend / append headers & footers to each page
        finished_pages = []
        for idx, pstream in enumerate(self.pages):
            pnum = idx + 1
            decorations = []
            
            # Header line and text
            decorations.append(f"0.75 w 0.80 0.85 0.90 RG {self.mx:.2f} {self.ph - 42:.2f} m {self.pw - self.mx:.2f} {self.ph - 42:.2f} l S\n")
            safe_hdr = sanitize_pdf_text(f"{doc_title} | {doc_type}")
            decorations.append(f"BT /F1 8 Tf 0.40 0.45 0.50 rg {self.mx:.2f} {self.ph - 36:.2f} Td ({safe_hdr}) Tj ET\n")
            
            # Footer line and text
            decorations.append(f"0.75 w 0.80 0.85 0.90 RG {self.mx:.2f} 42.00 m {self.pw - self.mx:.2f} 42.00 l S\n")
            safe_ftr_l = sanitize_pdf_text("Confidential & Proprietary * Government of Bangladesh / BMDC Healthcare Standard")
            decorations.append(f"BT /F1 8 Tf 0.45 0.50 0.55 rg {self.mx:.2f} 30.00 Td ({safe_ftr_l}) Tj ET\n")
            
            safe_ftr_r = sanitize_pdf_text(f"Page {pnum} of {total_pages}")
            # Approximate right alignment: right margin - 60
            rx = self.pw - self.mx - 55
            decorations.append(f"BT /F2 8 Tf 0.35 0.40 0.45 rg {rx:.2f} 30.00 Td ({safe_ftr_r}) Tj ET\n")
            
            dec_bytes = "".join(decorations).encode('latin1')
            finished_pages.append(dec_bytes + pstream)

        # Build PDF Catalog, Pages, Fonts and Content streams
        objects = {}
        next_id = 1

        catalog_id = next_id
        next_id += 1
        pages_id = next_id
        next_id += 1

        font_ids = {}
        for fname, base in self.fonts.items():
            font_ids[fname] = next_id
            objects[next_id] = f"<< /Type /Font /Subtype /Type1 /BaseFont /{base} >>".encode('latin1')
            next_id += 1

        page_record_list = []
        for pstream in finished_pages:
            p_id = next_id
            next_id += 1
            c_id = next_id
            next_id += 1
            page_record_list.append((p_id, c_id, pstream))

        kids_str = " ".join([f"{p[0]} 0 R" for p in page_record_list])
        objects[pages_id] = f"<< /Type /Pages /Kids [{kids_str}] /Count {len(page_record_list)} >>".encode('latin1')
        objects[catalog_id] = f"<< /Type /Catalog /Pages {pages_id} 0 R >>".encode('latin1')

        font_res_str = " ".join([f"/{fname} {font_ids[fname]} 0 R" for fname in self.fonts])

        for p_id, c_id, pstream in page_record_list:
            p_obj = (
                f"<< /Type /Page /Parent {pages_id} 0 R "
                f"/MediaBox [0 0 {self.pw:.2f} {self.ph:.2f}] "
                f"/Resources << /Font << {font_res_str} >> >> "
                f"/Contents {c_id} 0 R >>"
            ).encode('latin1')
            objects[p_id] = p_obj
            objects[c_id] = f"<< /Length {len(pstream)} >>\nstream\n".encode('latin1') + pstream + b"\nendstream"

        # Serialize PDF with exact xref table
        header = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"
        out = [header]
        offsets = {}
        cur_pos = len(header)

        for obj_id in sorted(objects.keys()):
            offsets[obj_id] = cur_pos
            obj_hdr = f"{obj_id} 0 obj\n".encode('latin1')
            body = objects[obj_id]
            obj_ftr = b"\nendobj\n"
            out.append(obj_hdr + body + obj_ftr)
            cur_pos += len(obj_hdr) + len(body) + len(obj_ftr)

        xref_pos = cur_pos
        out.append(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode('latin1'))
        for obj_id in sorted(objects.keys()):
            out.append(f"{offsets[obj_id]:010d} 00000 n \n".encode('latin1'))

        trailer = (
            f"trailer\n<< /Size {len(objects) + 1} /Root {catalog_id} 0 R >>\n"
            f"startxref\n{xref_pos}\n%%EOF\n"
        ).encode('latin1')
        out.append(trailer)

        return b"".join(out)

print("PdfDocument Engine Initialized successfully")

