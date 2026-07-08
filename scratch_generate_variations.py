import re
import subprocess
import os

svg_path = '/Users/writingafterx/Documents/readernwriter/svgs/vectorized_019eb1d9-db0e-7a6b-9b60-86b81ee695cc.svg'
output_dir = '/Users/writingafterx/.gemini/antigravity-ide/brain/9d7ec994-4ef2-4db4-9812-27e8d9a766b2'

with open(svg_path, 'r') as f:
    svg_content = f.read()

# 1. Let's split Path 9 into three separate path tags to see which is which.
# The original Path 9 is:
# <path d="m84.8 2.6c-20.1 0.3-42.2 15.9-42 38.5 0.4 18.6 14.8 33.1 36.2 33.1 15.6 0 28.9-7.1 38.2-21.8 2.2-4.7 3.9-9.9 3.8-15v-3c-0.5-14.2-12.4-31.4-32.5-31.7l-3.7-0.1zm-1.2 6.1h4.4c5.2 0.1 9.8 1.6 11.6 2.5 6.2 2.8 8.2 4.8 10.9 7.7l0.6 0.7 1.1 1.5 0.3 0.4c1.8 3 3 6.1 3.1 8.5 1.4 7-0.6 14.2-4 19.9-2.5 4.2-5.5 7-8.2 9.2-6.2 4.5-10.9 6.3-15.8 7.6-5.9 1.2-11 1.6-18.1 0-2.7-0.8-6.7-2.1-10.5-4.9-4.8-3.3-9-9.9-10.4-15.3-2.6-13.1 3.5-21.4 6.4-24.1 3.9-4.4 9-7.9 13.6-8.9 5.4-2.5 10.4-4 15-4.5v-0.3zm34.1 34.9c-1.3 6-4.5 11.4-8.6 15.4-7 7.4-18 12.2-28.7 12.9-8.4 0.3-14.7-1.5-19.4-4.2-3-1.6-8.6-6.3-11.1-10.9 6.1 7.6 14.8 10.7 21.5 12.2 1.6 0.4 5 0.6 7.8 0.7 8.6-0.1 17.7-2.6 25.5-8.3 5.4-3.9 10.8-10.8 13-17.8z"/>

subpath_0 = "m84.8 2.6c-20.1 0.3-42.2 15.9-42 38.5 0.4 18.6 14.8 33.1 36.2 33.1 15.6 0 28.9-7.1 38.2-21.8 2.2-4.7 3.9-9.9 3.8-15v-3c-0.5-14.2-12.4-31.4-32.5-31.7l-3.7-0.1z"
subpath_1 = "m83.6 8.7h4.4c5.2 0.1 9.8 1.6 11.6 2.5 6.2 2.8 8.2 4.8 10.9 7.7l0.6 0.7 1.1 1.5 0.3 0.4c1.8 3 3 6.1 3.1 8.5 1.4 7-0.6 14.2-4 19.9-2.5 4.2-5.5 7-8.2 9.2-6.2 4.5-10.9 6.3-15.8 7.6-5.9 1.2-11 1.6-18.1 0-2.7-0.8-6.7-2.1-10.5-4.9-4.8-3.3-9-9.9-10.4-15.3-2.6-13.1 3.5-21.4 6.4-24.1 3.9-4.4 9-7.9 13.6-8.9 5.4-2.5 10.4-4 15-4.5v-0.3z"
subpath_2 = "m117.7 43.6c-1.3 6-4.5 11.4-8.6 15.4-7 7.4-18 12.2-28.7 12.9-8.4 0.3-14.7-1.5-19.4-4.2-3-1.6-8.6-6.3-11.1-10.9 6.1 7.6 14.8 10.7 21.5 12.2 1.6 0.4 5 0.6 7.8 0.7 8.6-0.1 17.7-2.6 25.5-8.3 5.4-3.9 10.8-10.8 13-17.8z"

# We'll generate a variation where path 9 is split and we can omit individual parts.
def generate_svg_and_png(name, custom_body_paths):
    # Replaces path 9 with custom paths
    body_pattern = r'<path d="m84\.8 2\.6c-20\.1.*?"/>'
    replaced_svg = re.sub(body_pattern, '\n'.join(custom_body_paths), svg_content)
    
    file_path = f'/Users/writingafterx/Documents/readernwriter/scratch_{name}.svg'
    with open(file_path, 'w') as f:
        f.write(replaced_svg)
        
    subprocess.run([
        'qlmanage', '-t', '-s', '800', '-o', output_dir, file_path
    ])
    print(f"Generated {name}")

# Variation 1: Keep all subpaths of body, but color Subpath 0 red, Subpath 1 green, Subpath 2 blue
generate_svg_and_png("color_body", [
    f'<path d="{subpath_0}" fill="red" />',
    f'<path d="{subpath_1}" fill="green" />',
    f'<path d="{subpath_2}" fill="blue" />'
])

# Variation 2: Omit Subpath 2 of body completely
generate_svg_and_png("no_subpath_2", [
    f'<path d="{subpath_0}" />',
    f'<path d="{subpath_1}" />'
])

# Variation 3: Omit Subpath 1 of body completely
generate_svg_and_png("no_subpath_1", [
    f'<path d="{subpath_0}" />',
    f'<path d="{subpath_2}" />'
])

# Variation 4: Let's look at the legs paths. What if we color them red/blue to make sure they are legs?
legs_rest_pattern = r'<path d="m57\.9 67\.9.*?"/>\s*<path d="m44\.1 65\.5.*?"/>'
# Wait, let's just create a version where we color path 42 and 43.
replaced_legs = svg_content.replace(
    '<path d="m57.9 67.9c0.7 2.4 2.6 4.9 2.2 7.7-0.6 2.9-2.6 6.8-3.4 9.1-0.2 0.8 0.2 2 1.7 2.2s3.5 0.1 6.3 0c3.4-0.2 2.8-4.2-0.7-4.1l-4.4 0.6v-0.4c1.4-3.4 3.3-6.9 2.9-9.3-0.3-1.2-0.9-2.9-1.6-4.7l-3-1.1z"/>',
    '<path d="m57.9 67.9c0.7 2.4 2.6 4.9 2.2 7.7-0.6 2.9-2.6 6.8-3.4 9.1-0.2 0.8 0.2 2 1.7 2.2s3.5 0.1 6.3 0c3.4-0.2 2.8-4.2-0.7-4.1l-4.4 0.6v-0.4c1.4-3.4 3.3-6.9 2.9-9.3-0.3-1.2-0.9-2.9-1.6-4.7l-3-1.1z" fill="magenta"/>'
).replace(
    '<path d="m44.1 65.5 0.5 1.5c0.8 2.2 1.6 5.1 1.5 6.7-0.1 1.8-1.5 4.2-2.4 5.9-0.9 1.5-2.6 4.2-2.6 4.2l4.4-0.5c3.4-0.3 3.9 3.3 1.5 4-1.4 0.2-7.2 0.5-8.2-0.1-0.8-0.4-1.1-1.6-0.4-3.2 1.3-2.6 5.1-8.1 5.5-10.7 0.3-1.4-1-6-1.6-6.8l1.8-1z"/>',
    '<path d="m44.1 65.5 0.5 1.5c0.8 2.2 1.6 5.1 1.5 6.7-0.1 1.8-1.5 4.2-2.4 5.9-0.9 1.5-2.6 4.2-2.6 4.2l4.4-0.5c3.4-0.3 3.9 3.3 1.5 4-1.4 0.2-7.2 0.5-8.2-0.1-0.8-0.4-1.1-1.6-0.4-3.2 1.3-2.6 5.1-8.1 5.5-10.7 0.3-1.4-1-6-1.6-6.8l1.8-1z" fill="cyan"/>'
)
file_path = '/Users/writingafterx/Documents/readernwriter/scratch_colored_legs.svg'
with open(file_path, 'w') as f:
    f.write(replaced_legs)
subprocess.run([
    'qlmanage', '-t', '-s', '800', '-o', output_dir, file_path
])
print("Generated colored_legs")
