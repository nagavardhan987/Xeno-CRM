import os

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
        lines = f.readlines()
        
    # Check if we need to fix
    has_use_client = any('"use client"' in line or "'use client'" in line for line in lines)
    if has_use_client and not lines[0].strip().startswith('"use client"'):
        # Remove all existing use client lines
        new_lines = [line for line in lines if '"use client"' not in line and "'use client'" not in line]
        # Prepend it to the top
        new_lines.insert(0, '"use client";\n')
        
        with open(file_path, "w", encoding="utf-8") as f:
            f.writelines(new_lines)
            
print("Fixed 'use client' directives in all files.")
