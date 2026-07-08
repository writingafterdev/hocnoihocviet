import os
import re

color_map = {
    # Backgrounds
    "#FAF9F5": "#FFFFFF",
    "#F6F6F5": "#FFFFFF",
    "#F2F1EC": "#F8F9FA",
    
    # Core Accent Cards (Dashboard)
    "#ECE4CD": "#FFD166", # Vibrant Yellow
    "#B6C8C3": "#48CAE4", # Vibrant Cyan
    "#8F9F7F": "#06D6A0", # Vibrant Mint
    "#C4BBD0": "#EF476F", # Vibrant Coral
    
    # TopHeader & Misc
    "#E7EDE0": "#06D6A0", 
    "#EAD5CD": "#FF9F1C",
    
    # Articles
    "#DDB49F": "#FF9F1C",
    "#A3BCB6": "#4CC9F0",
}

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    new_content = content
    for old_color, new_color in color_map.items():
        # Case insensitive replacement for hex codes
        pattern = re.compile(re.escape(old_color), re.IGNORECASE)
        new_content = pattern.sub(new_color, new_content)
        
    if new_content != content:
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

for root, _, files in os.walk('src'):
    for file in files:
        if file.endswith(('.tsx', '.ts', '.css')):
            process_file(os.path.join(root, file))

print("Color update complete.")
