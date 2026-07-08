import os
import re

color_map = {
    # Vibrant Yellow -> Soft Warm Yellow
    "#FFD166": "#FFE17B",
    
    # Vibrant Cyan -> Soft Cyan
    "#48CAE4": "#7CD1E8",
    
    # Vibrant Mint -> Soft Mint
    "#06D6A0": "#62DAB1",
    
    # Vibrant Coral -> Soft Rose
    "#EF476F": "#F27A96",
    
    # Vibrant Orange -> Soft Tangerine
    "#FF9F1C": "#FFB760",
    
    # Bright Cyan -> Soft Sky Blue
    "#4CC9F0": "#82D8F2",
}

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    new_content = content
    for old_color, new_color in color_map.items():
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

print("Color softening complete.")
