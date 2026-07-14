import json
import os
from flask import Flask, jsonify, request, send_file
from flask_cors import CORS

# Initialize the Flask app
app = Flask(__name__, static_url_path='', static_folder='.')
CORS(app)  # Enable Cross-Origin Resource Sharing

DB_FILE = 'database.json'
VIDEO_UPLOAD_FOLDER = 'videos'

def load_database():
    """Loads the question database from the JSON file."""
    try:
        with open(DB_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return []

def save_database(db):
    """Saves the question database to the JSON file."""
    with open(DB_FILE, 'w', encoding='utf-8') as f:
        json.dump(db, f, indent=2)

@app.route('/')
def index():
    """Serve the main index.html file."""
    return send_file('index.html')

@app.route('/api/questions')
def get_questions():
    """API endpoint to get all question data."""
    return jsonify(load_database())

@app.route('/api/add_question', methods=['POST'])
def add_question():
    """API endpoint to add a new question and upload its video."""
    # --- Form Data ---
    key = request.form.get('key')
    en_text = request.form.get('en')
    es_text = request.form.get('es')

    # --- File Upload ---
    if 'video' not in request.files:
        return jsonify({"status": "error", "message": "No video file part"}), 400
    video_file = request.files['video']
    if video_file.filename == '':
        return jsonify({"status": "error", "message": "No selected video file"}), 400

    # Ensure the video upload folder exists and save the file there
    video_path = os.path.join(app.static_folder, VIDEO_UPLOAD_FOLDER)
    os.makedirs(video_path, exist_ok=True)
    video_filename = video_file.filename
    video_file.save(os.path.join(video_path, video_filename))

    # --- Update Database ---
    db = load_database()
    # Store the path relative to the web root
    new_question = {"key": key, "en": en_text, "es": es_text, "video": f"{VIDEO_UPLOAD_FOLDER}/{video_filename}"}
    db.append(new_question)
    save_database(db)

    return jsonify({"status": "success", "message": "Content added successfully!"})

if __name__ == '__main__':
    print("Starting Flask server. Access at http://127.0.0.1:8000")
    app.run(host='0.0.0.0', port=8000, debug=True)