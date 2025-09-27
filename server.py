#!/usr/bin/env python3
"""
Universal Music Server
Serves music files and provides a REST API for the music player web app
Supports all platforms with Python 3.6+
"""

import os
import json
import mimetypes
import urllib.parse
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
import hashlib
import argparse
import mutagen
from mutagen.id3 import ID3, TIT2, TPE1, TALB, APIC
from mutagen.mp3 import MP3
from mutagen.flac import FLAC
from mutagen.mp4 import MP4
import base64

class MusicServerHandler(BaseHTTPRequestHandler):
    
    def __init__(self, *args, music_directory=None, **kwargs):
        if music_directory is None:
            music_directory = Path(__file__).parent / "music"
        self.music_directory = Path(music_directory)
        # Call parent constructor first
        super().__init__(*args, **kwargs)
        # After base init, ensure shared attributes exist on server
        self._ensure_server_attributes()
    
    def _ensure_server_attributes(self):
        """Ensure server has necessary shared attributes"""
        if not hasattr(self.server, 'static_root'):
            self.server.static_root = Path(__file__).resolve().parent
        if not hasattr(self.server, 'songs_cache'):
            self.server.songs_cache = None  # list of song dicts
        if not hasattr(self.server, 'id_to_path'):
            self.server.id_to_path = {}  # song_id -> Path
    
    def do_GET(self):
        """Handle GET requests"""
        parsed_path = urllib.parse.urlparse(self.path)
        path = parsed_path.path
        query = urllib.parse.parse_qs(parsed_path.query)
        
        # Serve static files (HTML, CSS, JS)
        if path == '/' or path == '/index.html':
            self.serve_file('index.html', 'text/html')
        elif path == '/app.js':
            self.serve_file('app.js', 'application/javascript')
        elif path == '/style.css':
            self.serve_file('style.css', 'text/css')
        elif path == '/manifest.json':
            self.serve_file('manifest.json', 'application/json')
        elif path == '/sw.js':
            self.serve_file('sw.js', 'application/javascript')
        
        # API endpoints
        elif path == '/api/music':
            self.handle_music_list()
        elif path == '/api/music/scan':
            self.handle_music_scan()
        elif path == '/api/music/file':
            # Serve individual music files by path
            file_path = query.get('path', [''])[0]
            if file_path:
                self.serve_music_file_direct(file_path)
            else:
                self.send_error(400, "No file path specified")
        elif path.startswith('/api/music/'):
            # Serve individual music files by ID
            music_id = path.split('/')[-1]
            self.serve_music_file(music_id)
        elif path == '/api/album-art':
            song_id = query.get('id', [''])[0]
            self.serve_album_art(song_id)
        
        # Serve music files directly from configured music directory
        elif path.startswith('/music/'):
            file_path = urllib.parse.unquote(path)
            # Convert web path to actual file path
            relative_path = path[7:]  # Remove '/music/' prefix
            actual_path = self.music_directory / relative_path
            self.serve_music_file_direct(str(actual_path))
        
        else:
            self.send_error(404, "File not found")
    
    def do_POST(self):
        """Handle POST requests"""
        parsed_path = urllib.parse.urlparse(self.path)
        path = parsed_path.path
        
        if path == '/api/sync':
            self.handle_sync()
        else:
            self.send_error(404, "Endpoint not found")
    
    def serve_file(self, filename, content_type):
        """Serve static files"""
        try:
            # Ensure server attributes are initialized
            self._ensure_server_attributes()
            file_path = self.server.static_root / filename
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(content.encode('utf-8'))))
            self.add_cors_headers()
            self.end_headers()
            self.wfile.write(content.encode('utf-8'))
            
        except FileNotFoundError:
            self.send_error(404, f"File {filename} not found")
        except Exception as e:
            print(f"Error serving file {filename}: {e}")
            self.send_error(500, "Internal server error")
    
    def handle_music_list(self):
        """Return list of all music files"""
        try:
            # Use cache if available; otherwise scan
            songs = self.scan_music_directory(force=False)
            
            # Convert to JSON
            response = json.dumps(songs, indent=2)
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(response.encode('utf-8'))))
            self.add_cors_headers()
            self.end_headers()
            self.wfile.write(response.encode('utf-8'))
            
        except Exception as e:
            print(f"Error getting music list: {e}")
            self.send_error(500, f"Error scanning music directory: {e}")
    
    def handle_music_scan(self):
        """Scan music directory and return updated list"""
        try:
            print("Scanning music directory...")
            songs = self.scan_music_directory(force=True)
            
            response = json.dumps({
                'success': True,
                'songs': songs,
                'count': len(songs)
            }, indent=2)
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.add_cors_headers()
            self.end_headers()
            self.wfile.write(response.encode('utf-8'))
            
        except Exception as e:
            print(f"Error scanning music: {e}")
            self.send_error(500, f"Error scanning music directory: {e}")
    
    def scan_music_directory(self, force: bool = False):
        """Scan the music directory and extract metadata. Uses cache unless force=True."""
        # Ensure server attributes are initialized
        self._ensure_server_attributes()
        
        # Return cached results if present and not forcing a rescan
        if not force and getattr(self.server, 'songs_cache', None) is not None:
            return self.server.songs_cache

        songs = []
        supported_formats = ('.mp3', '.flac', '.m4a', '.ogg', '.wav')
        
        if not self.music_directory.exists():
            print(f"Music directory does not exist: {self.music_directory}")
            # Cache empty result to avoid repeated checks
            self.server.songs_cache = []
            self.server.id_to_path = {}
            return self.server.songs_cache
        
        print(f"Scanning directory: {self.music_directory}")
        
        # Walk through all subdirectories
        for file_path in self.music_directory.rglob('*'):
            if file_path.is_file() and file_path.suffix.lower() in supported_formats:
                try:
                    song_info = self.extract_metadata(file_path)
                    if song_info:
                        songs.append(song_info)
                        # Map id to path for quick lookup
                        self.server.id_to_path[song_info['id']] = file_path
                        print(f"Added: {song_info['title']} by {song_info['artist']}")
                except Exception as e:
                    print(f"Error processing {file_path}: {e}")
                    # Add basic info even if metadata extraction fails
                    abs_path_str = str(Path(file_path).resolve())
                    fallback_id = hashlib.sha1(abs_path_str.encode('utf-8')).hexdigest()
                    songs.append({
                        'id': fallback_id,
                        'title': file_path.stem,
                        'artist': 'Unknown Artist',
                        'album': 'Unknown Album',
                        'duration': 0,
                        'filepath': str(file_path),
                        'albumArt': None
                    })
                    self.server.id_to_path[fallback_id] = file_path
        
        print(f"Found {len(songs)} music files")
        # Update cache
        self.server.songs_cache = songs
        return self.server.songs_cache
    
    def extract_metadata(self, file_path):
        """Extract metadata from audio file"""
        try:
            # Use mutagen to read metadata
            audio_file = mutagen.File(file_path)
            
            if audio_file is None:
                return None
            
            # Get basic file info
            duration = getattr(audio_file, 'info', {}).length or 0
            
            # Extract metadata based on file type
            title = self.get_tag_value(audio_file, ['TIT2', 'TITLE', '\xa9nam', 'title']) or file_path.stem
            artist = self.get_tag_value(audio_file, ['TPE1', 'ARTIST', '\xa9ART', 'artist']) or 'Unknown Artist'
            album = self.get_tag_value(audio_file, ['TALB', 'ALBUM', '\xa9alb', 'album']) or 'Unknown Album'
            
            # Create deterministic unique ID based on absolute file path
            abs_path_str = str(Path(file_path).resolve())
            song_id = hashlib.sha1(abs_path_str.encode('utf-8')).hexdigest()
            
            return {
                'id': song_id,
                'title': str(title),
                'artist': str(artist),
                'album': str(album),
                'duration': int(duration),
                'filepath': str(file_path),
                'albumArt': f'/api/album-art?id={song_id}' if self.has_album_art(audio_file) else None
            }
            
        except Exception as e:
            print(f"Error extracting metadata from {file_path}: {e}")
            return None
    
    def get_tag_value(self, audio_file, possible_keys):
        """Get tag value from various possible keys"""
        for key in possible_keys:
            try:
                if hasattr(audio_file, 'tags') and audio_file.tags:
                    value = audio_file.tags.get(key)
                    if value:
                        # Handle different tag formats
                        if hasattr(value, 'text'):
                            return value.text[0] if value.text else None
                        elif isinstance(value, list):
                            return str(value[0]) if value else None
                        else:
                            return str(value)
            except:
                continue
        return None
    
    def has_album_art(self, audio_file):
        """Check if file has embedded album art"""
        try:
            if hasattr(audio_file, 'tags') and audio_file.tags:
                # Check for ID3 APIC frame (MP3)
                if 'APIC:' in str(audio_file.tags):
                    return True
                # Check for FLAC pictures
                if hasattr(audio_file.tags, 'pictures') and audio_file.tags.pictures:
                    return True
                # Check for MP4 cover art
                if 'covr' in audio_file.tags:
                    return True
            return False
        except:
            return False
    
    def serve_album_art(self, song_id):
        """Serve album art for a specific song"""
        try:
            # Ensure server attributes are initialized
            self._ensure_server_attributes()
            
            # Lookup file path by cached id map; if missing, refresh cache once
            file_path = self.server.id_to_path.get(song_id)
            if file_path is None:
                # Refresh cache and try again
                self.scan_music_directory(force=True)
                file_path = self.server.id_to_path.get(song_id)

            if file_path is None:
                self.send_error(404, "Song not found")
                return

            file_path = Path(file_path)
            audio_file = mutagen.File(file_path)
            
            if not audio_file or not hasattr(audio_file, 'tags') or not audio_file.tags:
                self.send_error(404, "No album art found")
                return
            
            # Extract album art based on file type
            image_data = None
            mime_type = 'image/jpeg'
            
            # MP3 files
            if 'APIC:' in str(audio_file.tags):
                for key, value in audio_file.tags.items():
                    if key.startswith('APIC:'):
                        image_data = value.data
                        mime_type = value.mime
                        break
            
            # FLAC files
            elif hasattr(audio_file.tags, 'pictures') and audio_file.tags.pictures:
                picture = audio_file.tags.pictures[0]
                image_data = picture.data
                mime_type = picture.mime
            
            # MP4 files
            elif 'covr' in audio_file.tags:
                cover = audio_file.tags['covr'][0]
                image_data = bytes(cover)
                mime_type = 'image/jpeg' if cover.imageformat == mutagen.mp4.AtomDataType.JPEG else 'image/png'
            
            if image_data:
                self.send_response(200)
                self.send_header('Content-Type', mime_type)
                self.send_header('Content-Length', str(len(image_data)))
                self.send_header('Cache-Control', 'public, max-age=86400')  # Cache for 1 day
                self.add_cors_headers()
                self.end_headers()
                self.wfile.write(image_data)
            else:
                self.send_error(404, "No album art found")
                
        except Exception as e:
            print(f"Error serving album art: {e}")
            self.send_error(500, "Error retrieving album art")
    
    def serve_music_file_direct(self, file_path):
        """Serve music file directly"""
        try:
            # Clean up the file path
            file_path = urllib.parse.unquote(file_path)
            file_path = Path(file_path)
            
            print(f"Attempting to serve: {file_path}")
            
            if not file_path.exists():
                print(f"File not found: {file_path}")
                self.send_error(404, f"Music file not found: {file_path}")
                return
            
            # Security check - ensure file is within configured music directory
            try:
                file_path.resolve().relative_to(self.music_directory.resolve())
            except ValueError:
                print(f"Security: File outside music directory: {file_path}")
                self.send_error(403, "Access denied")
                return
            
            # Get file size for Content-Length header
            file_size = file_path.stat().st_size
            print(f"File size: {file_size} bytes")
            
            # Determine MIME type
            mime_type, _ = mimetypes.guess_type(str(file_path))
            if not mime_type:
                if file_path.suffix.lower() == '.mp3':
                    mime_type = 'audio/mpeg'
                elif file_path.suffix.lower() == '.flac':
                    mime_type = 'audio/flac'
                elif file_path.suffix.lower() == '.m4a':
                    mime_type = 'audio/mp4'
                elif file_path.suffix.lower() == '.ogg':
                    mime_type = 'audio/ogg'
                else:
                    mime_type = 'audio/mpeg'  # Default
            
            print(f"MIME type: {mime_type}")
            
            # Handle range requests for audio streaming
            range_header = self.headers.get('Range')
            if range_header:
                print(f"Range request: {range_header}")
                self.handle_range_request(file_path, file_size, mime_type, range_header)
            else:
                # Serve entire file
                print("Serving entire file")
                self.send_response(200)
                self.send_header('Content-Type', mime_type)
                self.send_header('Content-Length', str(file_size))
                self.send_header('Accept-Ranges', 'bytes')
                self.send_header('Cache-Control', 'public, max-age=3600')
                self.add_cors_headers()
                self.end_headers()
                
                with open(file_path, 'rb') as f:
                    # Send in chunks to avoid memory issues with large files
                    while True:
                        chunk = f.read(8192)  # 8KB chunks
                        if not chunk:
                            break
                        self.wfile.write(chunk)
                
                print("File served successfully")
                    
        except Exception as e:
            print(f"Error serving music file {file_path}: {e}")
            import traceback
            traceback.print_exc()
            self.send_error(500, f"Error serving music file: {e}")

    def serve_music_file(self, music_id: str):
        """Serve music file by deterministic ID using the cached map."""
        # Ensure server attributes are initialized
        self._ensure_server_attributes()
        
        if music_id not in self.server.id_to_path:
            self.scan_music_directory(force=True)
        file_path = self.server.id_to_path.get(music_id)
        if not file_path:
            self.send_error(404, "Music not found")
            return
        self.serve_music_file_direct(str(file_path))
    
    def handle_range_request(self, file_path, file_size, mime_type, range_header):
        """Handle HTTP range requests for audio streaming"""
        try:
            # Parse range header (e.g., "bytes=0-1023")
            range_match = range_header.replace('bytes=', '').split('-')
            start = int(range_match[0]) if range_match[0] else 0
            end = int(range_match[1]) if range_match[1] else file_size - 1
            
            # Ensure valid range
            start = max(0, start)
            end = min(file_size - 1, end)
            content_length = end - start + 1
            
            self.send_response(206)  # Partial Content
            self.send_header('Content-Type', mime_type)
            self.send_header('Content-Length', str(content_length))
            self.send_header('Content-Range', f'bytes {start}-{end}/{file_size}')
            self.send_header('Accept-Ranges', 'bytes')
            self.add_cors_headers()
            self.end_headers()
            
            # Send requested byte range
            with open(file_path, 'rb') as f:
                f.seek(start)
                remaining = content_length
                while remaining > 0:
                    chunk_size = min(8192, remaining)  # 8KB chunks
                    chunk = f.read(chunk_size)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    remaining -= len(chunk)
                    
        except Exception as e:
            print(f"Error handling range request: {e}")
            self.send_error(500, "Error handling range request")
    
    def handle_sync(self):
        """Handle sync requests from the client"""
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            # Process sync data (save playlists, etc.)
            print(f"Received sync data: {data}")
            
            response = json.dumps({'success': True})
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.add_cors_headers()
            self.end_headers()
            self.wfile.write(response.encode('utf-8'))
            
        except Exception as e:
            print(f"Error handling sync: {e}")
            self.send_error(500, "Error processing sync data")
    
    def add_cors_headers(self):
        """Add CORS headers for cross-origin requests"""
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Range')
    
    def do_OPTIONS(self):
        """Handle preflight OPTIONS requests"""
        self.send_response(200)
        self.add_cors_headers()
        self.end_headers()
    
    def log_message(self, format, *args):
        """Custom log format"""
        print(f"[{self.date_time_string()}] {format % args}")


def create_handler(music_directory):
    """Create handler with custom music directory"""
    def handler(*args, **kwargs):
        return MusicServerHandler(*args, music_directory=music_directory, **kwargs)
    return handler


def main():
    """Main server function"""
    # CLI and environment configuration
    parser = argparse.ArgumentParser(
        description='Universal Music Player Server',
        epilog='Example: python server.py --music-directory ~/MyMusic --port 8080'
    )
    parser.add_argument('--host', 
                       default=os.environ.get('HOST', '0.0.0.0'),
                       help='Server host address (default: 0.0.0.0)')
    parser.add_argument('--port', 
                       type=int, 
                       default=int(os.environ.get('PORT', '8000')),
                       help='Server port (default: 8000)')
    parser.add_argument('--music-directory', 
                       default=os.environ.get('MUSIC_DIR'),
                       help='Path to music directory (default: ./music)')
    
    args = parser.parse_args()

    HOST = args.host
    PORT = args.port
    
    # Determine music directory
    if args.music_directory:
        # User specified a custom directory
        MUSIC_DIR = Path(args.music_directory).resolve()
        if not MUSIC_DIR.exists():
            print(f"❌ Specified music directory does not exist: {MUSIC_DIR}")
            return 1
        if not MUSIC_DIR.is_dir():
            print(f"❌ Specified path is not a directory: {MUSIC_DIR}")
            return 1
    else:
        # Use default ./music directory
        script_dir = Path(__file__).parent
        MUSIC_DIR = script_dir / "music"
        
        if not MUSIC_DIR.exists():
            print(f"📁 Music directory does not exist: {MUSIC_DIR}")
            
            # Get user confirmation
            while True:
                response = input("\nWould you like to create this directory? (y/n): ").lower().strip()
                if response in ['y', 'yes']:
                    try:
                        MUSIC_DIR.mkdir(parents=True, exist_ok=True)
                        print(f"✅ Created music directory: {MUSIC_DIR}")
                        print(f"\n💡 You can now:")
                        print(f"   • Move your music files to: {MUSIC_DIR}")
                        print(f"   • Or use a custom directory: python server.py --music-directory /path/to/your/music")
                        break
                    except PermissionError:
                        print(f"❌ Permission denied creating: {MUSIC_DIR}")
                        return 1
                    except Exception as e:
                        print(f"❌ Error creating directory: {e}")
                        return 1
                elif response in ['n', 'no']:
                    print("\n💡 To use a custom directory, run:")
                    print(f"   python server.py --music-directory /path/to/your/music")
                    return 1
                else:
                    print("Please enter 'y' for yes or 'n' for no.")
    
    # Verify directory is readable
    if not os.access(MUSIC_DIR, os.R_OK):
        print(f"❌ Cannot read music directory: {MUSIC_DIR}")
        print("Please check permissions and try again.")
        return 1
    
    print(f"\n🎵 Universal Music Player Server")
    print(f"📁 Music Directory: {MUSIC_DIR}")
    print(f"🌐 Server running on http://{HOST}:{PORT}")
    
    # Show access methods
    if HOST == '0.0.0.0':
        print(f"🔗 Local access: http://localhost:{PORT}")
        print(f"📱 Network access: http://<your-ip-address>:{PORT}")
    else:
        print(f"🔗 Access URL: http://{HOST}:{PORT}")
    
    print("\n💡 Add your music files to the music directory and refresh the web page")
    print("\nPress Ctrl+C to stop the server")
    
    # Create server
    handler = create_handler(str(MUSIC_DIR))
    server = HTTPServer((HOST, PORT), handler)
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n\n🛑 Shutting down server...")
        server.shutdown()
        print("✅ Server stopped successfully")
    except Exception as e:
        print(f"\n❌ Server error: {e}")
        return 1
    
    return 0


if __name__ == '__main__':
    import sys
    sys.exit(main())
