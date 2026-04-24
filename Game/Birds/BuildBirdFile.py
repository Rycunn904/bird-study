# Takes each bird folder
# Folder name is the bird name
# Each folder has an image and or sound file
# Builds a birds.json file with the following format:
# {
#   "birds": [
#     {
#       "name": "Sparrow",
#       "image": "data:image/png;base64,...",
#       "sound": "data:audio/mp3;base64,..."
#     }
#   ]
# }
import os
import json
import base64

def build_bird_file(bird_folders, output_file):
    birds = []
    for folder in bird_folders:
        bird_name = os.path.basename(folder)
        bird_data = {"name": bird_name}
        
        # Look for image and sound files
        for file in os.listdir(folder):
            if file.endswith(('.png', '.jpg', '.jpeg')):
                # Read image file and convert to base64
                with open(os.path.join(folder, file), 'rb') as img_file:
                    encoded_string = base64.b64encode(img_file.read()).decode('utf-8')
                    bird_data["image"] = f"data:image/{file.split('.')[-1]};base64,{encoded_string}"
            elif file.endswith(('.mp3', '.wav', '.ogg')):
                # Read sound file and convert to base64
                with open(os.path.join(folder, file), 'rb') as sound_file:
                    encoded_string = base64.b64encode(sound_file.read()).decode('utf-8')
                    bird_data["sound"] = f"data:audio/{file.split('.')[-1]};base64,{encoded_string}"
        
        birds.append(bird_data)
    
    # Write to output JSON file
    with open(output_file, 'w') as f:
        json.dump({"birds": birds}, f, indent=4)
    

if __name__ == "__main__":
    # Find all bird folders in the current directory
    bird_folders = [os.path.join(os.getcwd(), d) for d in os.listdir() if os.path.isdir(d)]
    output_file = "birds.json"
    build_bird_file(bird_folders, output_file)