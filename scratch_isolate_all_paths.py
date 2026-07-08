import re
import subprocess
import os

svg_path = '/Users/writingafterx/Documents/readernwriter/svgs/vectorized_019eb1d9-db0e-7a6b-9b60-86b81ee695cc.svg'
output_dir = '/Users/writingafterx/.gemini/antigravity-ide/brain/9d7ec994-4ef2-4db4-9812-27e8d9a766b2/isolated'
os.makedirs(output_dir, exist_ok=True)

with open(svg_path, 'r') as f:
    svg_content = f.read()

# Find all path and polygon tags
tags = re.findall(r'<(?:path|polygon)[^>]*>', svg_content)

# We want to generate an SVG for each tag, where only that tag is drawn.
# To make it visible, we'll draw it with a thick red stroke and solid red fill.
for idx, tag in enumerate(tags):
    # Create a clean SVG containing only this tag
    # Copy the style block
    style_block = re.search(r'<style.*?</style>', svg_content, re.DOTALL).group(0)
    
    # We will override the styles or modify the tag to make sure it's filled red and stroked blue
    modified_tag = tag
    # Remove existing fill/stroke/class to override
    modified_tag = re.sub(r'class="[^"]+"', '', modified_tag)
    modified_tag = re.sub(r'fill="[^"]+"', '', modified_tag)
    modified_tag = re.sub(r'stroke="[^"]+"', '', modified_tag)
    modified_tag = re.sub(r'stroke-width="[^"]+"', '', modified_tag)
    
    if 'polygon' in modified_tag:
        modified_tag = modified_tag.replace('<polygon', '<polygon fill="red" stroke="blue" stroke-width="2"')
    else:
        modified_tag = modified_tag.replace('<path', '<path fill="red" stroke="blue" stroke-width="2"')
        
    temp_svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 156.4 118" width="100%">
  {style_block}
  <!-- Draw a light grey outline of the original SVG for reference -->
  <g opacity="0.1">
    {svg_content}
  </g>
  {modified_tag}
</svg>"""

    file_path = f'/Users/writingafterx/Documents/readernwriter/scratch_path_{idx}.svg'
    with open(file_path, 'w') as f:
        f.write(temp_svg)
        
    subprocess.run([
        'qlmanage', '-t', '-s', '800', '-o', output_dir, file_path
    ])
    # Remove the temp SVG to keep workspace clean
    os.remove(file_path)

print(f"Generated {len(tags)} isolated path PNGs in {output_dir}")
