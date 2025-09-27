# 🎵 Universal Music Player

A modern, cross-platform web-based music player that works on **all platforms** with Python 3.6+. Originally designed for Termux, now universally compatible with Windows, macOS, Linux, and Android.

![Platform Support](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux%20%7C%20Android-blue)
![Python](https://img.shields.io/badge/python-3.6%2B-green)
![License](https://img.shields.io/badge/license-MIT-blue)

## 🎬 Quick Demo

1. **Clone & Run**: `git clone [repo] && cd universal-music-player && python3 server.py`
2. **Open Browser**: http://localhost:8000
3. **Add Music**: Drop files in `./music` folder
4. **Enjoy**: Full-featured music player with playlists, themes, and PWA support!

## ✨ Features

- 🎵 **Universal Audio Support** - MP3, FLAC, M4A, OGG, WAV
- 📱 **Mobile-First Design** - Responsive, touch-friendly interface
- 🌙 **Dark/Light Themes** - Spotify-inspired design
- 📋 **Playlist Management** - Create, edit, delete playlists
- 🎨 **Album Art Support** - Embedded artwork display
- 🔀 **Advanced Controls** - Shuffle, repeat, seek, volume
- 📳 **Media Session API** - Browser/OS notifications
- 💾 **Progressive Web App** - Install as native app
- 📤 **Data Management** - Export/import playlists
- 🚀 **Zero Configuration** - Works out of the box

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/universal-music-player.git
cd universal-music-player
```

### 2. Install Dependencies

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install python3 python3-pip python3-mutagen
```

**macOS:**
```bash
brew install python3
pip3 install mutagen
```

**Windows:**
```bash
# Install Python 3.6+ from python.org
pip install mutagen
```

**Or use pip anywhere:**
```bash
pip3 install -r requirements.txt
```

### 3. Run the Server
```bash
python3 server.py
```

### 4. Open in Browser
- **Local:** http://localhost:8000
- **Network:** http://YOUR_IP_ADDRESS:8000

**That's it!** 🎉 Your music player is ready!

## 📚 Usage

### First Run
On first run, the server will:
1. **Detect** if the `./music` directory exists
2. **Prompt** to create it if it doesn't exist
3. **Guide** you on adding music files or using a custom directory

```bash
📁 Music directory does not exist: ./music

Would you like to create this directory? (y/n): y
✅ Created music directory: ./music

💡 You can now:
   • Move your music files to: ./music
   • Or use a custom directory: python server.py --music-directory /path/to/your/music
```

### Adding Music
1. **Copy** your music files to the `./music` directory
2. **Refresh** the web page
3. **Enjoy** your music!

## ⚙️ Configuration Options

```bash
# Custom music directory
python3 server.py --music-directory ~/Music

# Custom host/port  
python3 server.py --host 0.0.0.0 --port 3000

# Environment variables
HOST=0.0.0.0 PORT=3000 MUSIC_DIR="~/Music" python3 server.py

# Help
python3 server.py --help
```

**Supported formats:** MP3, FLAC, M4A, OGG, WAV

## 📱 Progressive Web App

- Install as native app: "Add to Home Screen" in browser
- Works offline with cached music
- Media controls integration

## 🛠️ Troubleshooting

| Issue | Solution |
|-------|----------|
| No music found | Add files to `./music` or use `--music-directory` |
| Can't access from phone | Use `--host 0.0.0.0` and check firewall |
| Port already in use | Use `--port 3000` (or another port) |
| Permission denied | Check directory permissions |

## 📄 License

MIT License - Free to use and modify!
