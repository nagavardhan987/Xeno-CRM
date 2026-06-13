import os
import re

directory = r"D:\Nagavardhan\Xeno Task\xeno-crm\frontend\app"

files_to_update = [
    r"campaigns\[id]\page.tsx",
    r"campaigns\page.tsx",
    r"copilot\page.tsx",
    r"customers\page.tsx",
    r"segments\page.tsx",
    r"page.tsx"
]

for rel_path in files_to_update:
    file_path = os.path.join(directory, rel_path)
    if not os.path.exists(file_path):
        continue
        
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
        
    if "apiFetch" not in content:
        # Add import
        content = 'import { apiFetch } from "@/lib/api";\n' + content
        
    # Replace fetch( with apiFetch( 
    # but only those fetching from API, e.g. fetch(`${API}
    content = re.sub(r'\bfetch\(', 'apiFetch(', content)
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
        
print("Replaced fetch with apiFetch in all files.")
