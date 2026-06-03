import json
import os
import re
import markdown

overview_path = "/Users/ankit/.gemini/antigravity/brain/e4c5e1f4-aa0a-48b4-bee9-a9e9c68b3e0b/.system_generated/logs/overview.txt"
transcript_path = "/Users/ankit/.gemini/antigravity/brain/e4c5e1f4-aa0a-48b4-bee9-a9e9c68b3e0b/.system_generated/logs/transcript.jsonl"
html_path = "/Users/ankit/Code/antigravity/racing_game/Conversation.html"

md_content = "# Racing Game Development Conversation\n\n"

def process_file(file_path):
    global md_content
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
                content = re.sub(r'<USER_REQUEST>\n?', '', content)
                content = re.sub(r'</USER_REQUEST>.*', '', content, flags=re.DOTALL)
                md_content += f"## **User**\n\n{content.strip()}\n\n---\n\n"
                
            elif source == "MODEL" and step_type in ["PLANNER_RESPONSE", "CHAT_RESPONSE", "MODEL_RESPONSE"]:
                if content.startswith("{"): continue # Skip raw json tool calls if any
                md_content += f"## **Antigravity (AI)**\n\n{content.strip()}\n\n---\n\n"

process_file(overview_path)
process_file(transcript_path)

html = f'''
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.4; padding: 1em; max-width: 100%; margin: 0 auto; color: #333; font-size: 14px; }}
@media print {{
    body {{ padding: 0; margin: 0; max-width: 100%; font-size: 12px; }}
    pre {{ white-space: pre-wrap; word-wrap: break-word; }}
}}
h1 {{ text-align: center; border-bottom: 2px solid #eaecef; padding-bottom: .3em; }}
h2 {{ color: #0056b3; }}
hr {{ border: 0; height: 1px; background: #ccc; margin: 2em 0; }}
pre {{ background: #f6f8fa; padding: 16px; border-radius: 6px; overflow: auto; }}
code {{ font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace; font-size: 85%; background: #rgba(175,184,193,0.2); padding: .2em .4em; border-radius: 6px; }}
</style>
</head>
<body>
{markdown.markdown(md_content)}
</body>
</html>
'''

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(html)

print("Generated HTML successfully.")
