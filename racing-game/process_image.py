from rembg import remove
from PIL import Image
import os

input_path = '/Users/ankit/.gemini/antigravity/brain/8b80f22e-b39a-4935-98a5-cb9a5432da2c/media__1780276481904.png'
output_path = 'car_transparent.png'

print('Opening image...')
input_image = Image.open(input_path)

print('Removing background...')
output_image = remove(input_image)

print('Rotating 180 degrees to point right...')
output_image = output_image.rotate(180, expand=True)

# Crop the transparent borders
bbox = output_image.getbbox()
if bbox:
    output_image = output_image.crop(bbox)

print('Saving image...')
output_image.save(output_path)
print('Done!')
