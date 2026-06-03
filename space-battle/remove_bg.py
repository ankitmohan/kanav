from PIL import Image
import collections
import sys

def remove_background(input_path, output_path, threshold=50):
    try:
        img = Image.open(input_path).convert('RGBA')
        width, height = img.size
        pixels = img.load()

        queue = collections.deque()
        visited = set()
        
        # Add all border pixels to start
        for x in range(width):
            queue.append((x, 0))
            queue.append((x, height - 1))
            visited.add((x, 0))
            visited.add((x, height - 1))
            
        for y in range(height):
            queue.append((0, y))
            queue.append((width - 1, y))
            visited.add((0, y))
            visited.add((width - 1, y))

        # BFS to find contiguous dark background pixels
        while queue:
            x, y = queue.popleft()
            r, g, b, a = pixels[x, y]
            
            # If the pixel is close to black
            if r < threshold and g < threshold and b < threshold:
                pixels[x, y] = (0, 0, 0, 0) # Make transparent
                
                # Check neighbors
                for dx, dy in [(0, 1), (1, 0), (0, -1), (-1, 0)]:
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < width and 0 <= ny < height and (nx, ny) not in visited:
                        visited.add((nx, ny))
                        queue.append((nx, ny))

        img.save(output_path, "PNG")
        print("Success")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    remove_background('spaceship.png', 'spaceship_transparent.png')
