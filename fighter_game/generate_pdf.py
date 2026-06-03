import json
import os
import re
from fpdf import FPDF

# Paths
overview_path = "/Users/ankit/.gemini/antigravity/brain/e4c5e1f4-aa0a-48b4-bee9-a9e9c68b3e0b/.system_generated/logs/overview.txt"
transcript_path = "/Users/ankit/.gemini/antigravity/brain/e4c5e1f4-aa0a-48b4-bee9-a9e9c68b3e0b/.system_generated/logs/transcript.jsonl"
pdf_path = "/Users/ankit/Code/antigravity/racing_game/Conversation.pdf"

class PDF(FPDF):
    def header(self):
        self.set_font("Helvetica", 'B', 15)
        self.cell(0, 10, 'Racing Game Development Conversation', 0, 1, 'C')
        self.ln(5)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", 'I', 8)
        self.cell(0, 10, f'Page {self.page_no()}', 0, 0, 'C')

def clean_text(text):
    # FPDF uses latin-1 by default. Let's replace unsupported characters.
    text = text.encode('latin-1', 'replace').decode('latin-1')
    text = re.sub(r'(\S{30})', r'\1 ', text)
    return text

def process_file(file_path, pdf):
    if not os.path.exists(file_path):
        return
    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            if not line.strip(): continue
            try:
                data = json.loads(line)
            except:
                continue
            
            source = data.get("source", "")
            step_type = data.get("type", "")
            content = data.get("content", "")
            
            if not content:
                continue
                
            if source == "USER_EXPLICIT" and step_type == "USER_INPUT":
                # Clean up <USER_REQUEST> tags
                content = re.sub(r'<USER_REQUEST>\n?', '', content)
                content = re.sub(r'</USER_REQUEST>.*', '', content, flags=re.DOTALL)
                
                pdf.set_font("Helvetica", 'B', 12)
                pdf.set_text_color(0, 51, 102) # Dark blue
                pdf.multi_cell(0, 10, "User:")
                
                pdf.set_font("Helvetica", '', 11)
                pdf.set_text_color(0, 0, 0)
                pdf.multi_cell(0, 8, clean_text(content.strip()))
                pdf.ln(5)
                
            elif source == "MODEL" and step_type in ["PLANNER_RESPONSE", "CHAT_RESPONSE", "MODEL_RESPONSE"]:
                if content.startswith("{"): continue # Skip raw json tool calls if any
                
                pdf.set_font("Helvetica", 'B', 12)
                pdf.set_text_color(153, 0, 0) # Dark red
                pdf.multi_cell(0, 10, "Antigravity:")
                
                pdf.set_font("Helvetica", '', 11)
                pdf.set_text_color(0, 0, 0)
                pdf.multi_cell(0, 8, clean_text(content.strip()))
                pdf.ln(5)

def main():
    pdf = PDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)
    
    process_file(overview_path, pdf)
    process_file(transcript_path, pdf)
    
    pdf.output(pdf_path)
    print(f"PDF successfully created at {pdf_path}")

if __name__ == "__main__":
    main()
