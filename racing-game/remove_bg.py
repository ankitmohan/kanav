from rembg import remove
from PIL import Image

input_path = '/Users/ankit/.gemini/antigravity/brain/8b80f22e-b39a-4935-98a5-cb9a5432da2c/media__1780276859107.png'
output_path = '/Users/ankit/.gemini/antigravity/scratch/racing-game/car_transparent.png'

print('Opening image...')
input_image = Image.open(input_path)

print('Removing background accurately...')
output_image = remove(input_image)

print('Rotating 180 degrees to point forward...')
output_image = output_image.rotate(180, expand=True)

# Crop to bounding box to remove excess transparent space
bbox = output_image.getbbox()
if bbox:
    output_image = output_image.crop(bbox)

print('Saving perfect transparent image...')
output_image.save(output_path)
print('Success!')
