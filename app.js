/**
 * My Music Player - Main JavaScript File
 * A modern web-based music player for mobile devices
 * Built for Termux environment with web server
 */

class MusicPlayer {
    constructor() {
        // Initialize application state
        this.currentSong = null;
        this.currentIndex = -1;
        this.playlist = [];
        this.allSongs = [];
        this.isPlaying = false;
        this.isShuffleOn = false;
        this.repeatMode = 'off'; // 'off', 'all', 'one'
        this.currentPlaylistId = null; // For playlist detail view
        this.currentSongForPlaylist = null; // For playlist modal
        this.currentQueue = []; // Separate from main playlist
this.queueName = 'All Songs'; // Track what's currently playing
        this.settings = {
            theme: localStorage.getItem('theme') || 'light',
            musicDirectory: './music',
            autoplay: true
        };
        
        // User data storage
        this.userData = {
            playlists: JSON.parse(localStorage.getItem('playlists')) || []
            // --> I turned off the rectly played export. Right now it also does not add songs to recently played. If you ever turn this back on. Do not forget to uncomment in the playSonng function.
            
            // recentlyPlayed: JSON.parse(localStorage.getItem('recentlyPlayed')) || [],   
            
            // We are doing nothing with favorites. There is no section or playlist.
        
            // favorites: JSON.parse(localStorage.getItem('favorites')) || []
        };

        // Initialize the application
        this.init();
    }

    /**
     * Initialize the music player application
     */
    async init() {
        console.log('Initializing Music Player...');
        
        this.setupEventListeners();
        this.setupTheme();
        this.setupTabs();
        this.setupPlayer();
        this.loadSettings();
        
        console.log('Loading music files...');
        // Load music files from the server
        await this.loadMusicFiles();
        
        console.log('Rendering UI...');
        this.renderMusicList();
        this.renderPlaylists();
        
        console.log('Music Player initialized successfully');
    }

    /**
     * Set up all event listeners for the application
     */
    setupEventListeners() {
        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());
        
        // Tab navigation
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchTab(e.currentTarget.dataset.tab));
        });
        
        // Search functionality
        document.getElementById('searchInput').addEventListener('input', (e) => this.searchMusic(e.target.value));
        
        // Mini Player controls
        document.getElementById('miniPlayPauseBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePlayPause();
        });
        document.getElementById('miniNextBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.nextSong();
        });
        document.getElementById('miniPrevBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.previousSong();
        });
        
        // Mini player click to expand
        document.getElementById('miniPlayer').addEventListener('click', () => this.expandPlayer());
        
        // Full Player controls
        document.getElementById('playPauseBtn').addEventListener('click', () => this.togglePlayPause());
        document.getElementById('nextBtn').addEventListener('click', () => this.nextSong());
        document.getElementById('prevBtn').addEventListener('click', () => this.previousSong());
        document.getElementById('shuffleBtn').addEventListener('click', () => this.toggleShuffle());
        document.getElementById('repeatBtn').addEventListener('click', () => this.cycleRepeat());
        document.getElementById('playerClose').addEventListener('click', () => this.collapsePlayer());
        document.getElementById('minimizePlayer').addEventListener('click', () => this.collapsePlayer());

        
        // Progress bar
        const progressBar = document.getElementById('progressBar');
        progressBar.addEventListener('click', (e) => this.seekToPosition(e));
        
        // Audio element events
        const audio = document.getElementById('audioPlayer');
        audio.addEventListener('loadedmetadata', () => this.updateTimeDisplay());
        audio.addEventListener('timeupdate', () => this.updateProgress());
        audio.addEventListener('ended', () => this.onSongEnded());
        audio.addEventListener('error', (e) => this.handleAudioError(e));
        
        // Playlist management
        document.getElementById('createPlaylistBtn').addEventListener('click', () => this.createPlaylist());
        
        // Settings
        document.getElementById('exportDataBtn').addEventListener('click', () => this.exportUserData());
        document.getElementById('importDataBtn').addEventListener('click', () => document.getElementById('importDataInput').click());
        document.getElementById('importDataInput').addEventListener('change', (e) => this.importUserData(e));
        document.getElementById('updateDirectoryBtn').addEventListener('click', () => {
            const input = document.getElementById('musicDirectoryInput');
            this.updateMusicDirectory(input.value);
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
        
        // Navigation between playlist list and detail
        document.getElementById('backToPlaylistsBtn').addEventListener('click', () => this.showPlaylistList());
        document.getElementById('playPlaylistBtn').addEventListener('click', () => this.playCurrentPlaylist());
        document.getElementById('deletePlaylistBtn').addEventListener('click', () => this.deleteCurrentPlaylist());
        
        // Playlist modal
        document.getElementById('playlistModalClose').addEventListener('click', () => this.closePlaylistModal());
        document.getElementById('quickCreateBtn').addEventListener('click', () => this.quickCreateAndAdd());
        
        // Close modal on background click
        document.getElementById('playlistModal').addEventListener('click', (e) => {
            if (e.target.id === 'playlistModal') {
                this.closePlaylistModal();
            }
        });
        
        // Media session API for notifications (if supported)
        if ('mediaSession' in navigator) {
            navigator.mediaSession.setActionHandler('play', () => this.play());
            navigator.mediaSession.setActionHandler('pause', () => this.pause());
            navigator.mediaSession.setActionHandler('nexttrack', () => this.nextSong());
            navigator.mediaSession.setActionHandler('previoustrack', () => this.previousSong());
        }
        document.getElementById('volumeSlider').addEventListener('input', (e) => this.updateVolume(e));
document.getElementById('volumeBtn').addEventListener('click', () => this.toggleMute());
    }

    /**
     * Set up theme management
     */
    setupTheme() {
        const theme = this.settings.theme;
        document.documentElement.setAttribute('data-theme', theme);
        this.updateThemeToggleIcon(theme);
    }

    /**
     * Toggle between light and dark themes
     */
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        this.settings.theme = newTheme;
        localStorage.setItem('theme', newTheme);
        
        this.updateThemeToggleIcon(newTheme);
    }

    /**
     * Update theme toggle icon
     */
    updateThemeToggleIcon(theme) {
        const themeToggle = document.getElementById('themeToggle');
        const sunIcon = `
   <svg class="icon" xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <g transform="translate(1.4066 1.4066) scale(2.81 2.81)">
    <path d="M 88 47 H 77.866 c -1.104 0 -2 -0.896 -2 -2 s 0.896 -2 2 -2 H 88 c 1.104 0 2 0.896 2 2 S 89.104 47 88 47 z"/>
    <path d="M 12.134 47 H 2 c -1.104 0 -2 -0.896 -2 -2 s 0.896 -2 2 -2 h 10.134 c 1.104 0 2 0.896 2 2 S 13.239 47 12.134 47 z"/>
    <path d="M 45 14.134 c -1.104 0 -2 -0.896 -2 -2 V 2 c 0 -1.104 0.896 -2 2 -2 s 2 0.896 2 2 v 10.134 C 47 13.239 46.104 14.134 45 14.134 z"/>
    <path d="M 45 90 c -1.104 0 -2 -0.896 -2 -2 V 77.866 c 0 -1.104 0.896 -2 2 -2 s 2 0.896 2 2 V 88 C 47 89.104 46.104 90 45 90 z"/>
    <path d="M 75.405 77.405 c -0.512 0 -1.023 -0.195 -1.414 -0.586 l -7.166 -7.166 c -0.781 -0.781 -0.781 -2.047 0 -2.828 s 2.047 -0.781 2.828 0 l 7.166 7.166 c 0.781 0.781 0.781 2.047 0 2.828 C 76.429 77.21 75.917 77.405 75.405 77.405 z"/>
    <path d="M 21.76 23.76 c -0.512 0 -1.024 -0.195 -1.414 -0.586 l -7.166 -7.166 c -0.781 -0.781 -0.781 -2.047 0 -2.828 c 0.78 -0.781 2.048 -0.781 2.828 0 l 7.166 7.166 c 0.781 0.781 0.781 2.047 0 2.828 C 22.784 23.565 22.272 23.76 21.76 23.76 z"/>
    <path d="M 68.239 23.76 c -0.512 0 -1.023 -0.195 -1.414 -0.586 c -0.781 -0.781 -0.781 -2.047 0 -2.828 l 7.166 -7.166 c 0.781 -0.781 2.047 -0.781 2.828 0 c 0.781 0.781 0.781 2.047 0 2.828 l -7.166 7.166 C 69.263 23.565 68.751 23.76 68.239 23.76 z"/>
    <path d="M 14.594 77.405 c -0.512 0 -1.024 -0.195 -1.414 -0.586 c -0.781 -0.781 -0.781 -2.047 0 -2.828 l 7.166 -7.166 c 0.78 -0.781 2.048 -0.781 2.828 0 c 0.781 0.781 0.781 2.047 0 2.828 l -7.166 7.166 C 15.618 77.21 15.106 77.405 14.594 77.405 z"/>
    <path d="M 45 66.035 c -11.599 0 -21.035 -9.437 -21.035 -21.035 S 33.401 23.965 45 23.965 S 66.035 33.401 66.035 45 S 56.599 66.035 45 66.035 z"/>
  </g>
</svg>

        `;
        const moonIcon = `
            <svg class="icon" viewBox="0 0 24 24">
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
            </svg>
        `;
        
        themeToggle.innerHTML = theme === 'dark' ? sunIcon : moonIcon;
    }

    /**
     * Set up tab navigation
     */
    setupTabs() {
        // Default to music tab
        this.switchTab('music');
    }

    /**
     * Switch between different tabs (Music, Playlists, Settings)
     */
    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(tabName).classList.add('active');
        
        // Refresh content if needed
        if (tabName === 'playlists') {
            this.renderPlaylists();
            this.showPlaylistList(); // Make sure we're showing list view
        }
    }

    /**
     * Set up audio player
     */
    setupPlayer() {
        const audio = document.getElementById('audioPlayer');
        
        // Set volume to reasonable level
        audio.volume = 0.8;
        
        console.log('Audio player setup complete');
    }

    /**
     * Load music files from the server
     */
    async loadMusicFiles() {
        try {
            console.log('Loading music files from server...');
            
            // Fetch music files from the Python server
            const response = await fetch('/api/music');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const songs = await response.json();
            console.log('Raw server response:', songs);
            
            this.allSongs = songs;
            this.playlist = [...this.allSongs];
            
            console.log(`Loaded ${this.allSongs.length} songs from server`);
            console.log('Songs:', this.allSongs);
            
        } catch (error) {
            console.error('Error loading music files:', error);
            
            // Fallback to dummy data for testing
            this.allSongs = [
                {
                    id: 'demo1',
                    title: 'Demo Song 1',
                    artist: 'Demo Artist',
                    // album: 'Demo Album',
                    duration: 180,
                    filepath: './music/demo1.mp3',
                    albumArt: null
                },
                {
                    id: 'demo2',
                    title: 'Another Demo Track',
                    artist: 'Test Artist',
                    // album: 'Test Collection',
                    duration: 220,
                    filepath: './music/demo2.mp3',
                    albumArt: null
                }
            ];
            
            this.playlist = [...this.allSongs];
            console.log('Using fallback demo data:', this.allSongs);
            this.showNotification('Using demo data - check server connection', 'warning');
        }
    }

    /**
     * Render the music list in the UI (Spotify-style)
     */
    renderMusicList() {
        const container = document.getElementById('musicList');
        
        if (this.playlist.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">♪</div>
                    <h3>No music found</h3>
                    <p>Add some music files to your directory to get started</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = this.playlist.map((song, index) => `
            <div class="track-item ${this.currentIndex === index ? 'playing' : ''}" data-index="${index}">
                <div class="track-number">${this.currentIndex === index && this.isPlaying ? '♪' : index + 1}</div>
                <div class="track-info">
                    <div class="track-art">
                        ${song.albumArt ? `<img src="${song.albumArt}" alt="Album Art">` : '♪'}
                    </div>
                    <div class="track-details">
                        <div class="track-title">${this.escapeHtml(song.title)}</div>
                        <div class="track-artist">${this.escapeHtml(song.artist)}</div>
                    </div>
                </div>
              <!--  <div class="track-album">${this.escapeHtml(song.album)}</div> -->
                <div class="track-duration">${this.formatTime(song.duration)}</div>
                <div class="track-actions">
                    <button class="track-menu-btn" onclick="player.showPlaylistModal('${song.id}', event)" title="Add to Playlist">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
</svg>
                    </button>
                </div>
            </div>
        `).join('');
        
        // Add click listeners for music items
        container.querySelectorAll('.track-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // Don't trigger if clicking on menu button
                if (!e.target.closest('.track-menu-btn')) {
                    const index = parseInt(item.dataset.index);
                    this.playSong(index);
                }
            });
            
            // Add double-click for extra responsiveness
            item.addEventListener('dblclick', (e) => {
                const index = parseInt(item.dataset.index);
                this.playSong(index);
            });
        });
    }

    /**
     * Search through music collection
     */
    searchMusic(query) {
        if (!query.trim()) {
            this.playlist = [...this.allSongs];
        } else {
            const searchTerm = query.toLowerCase();
            this.playlist = this.allSongs.filter(song => 
                song.title.toLowerCase().includes(searchTerm) ||
                song.artist.toLowerCase().includes(searchTerm) ||
                song.album.toLowerCase().includes(searchTerm)
            );
        }
        this.renderMusicList();
    }

    /**
     * Play a specific song by index
     */
    async playSong(index) {
        const songsToUse = this.currentQueue.length > 0 ? this.currentQueue : this.playlist;
    if (index < 0 || index >= songsToUse.length) return;
    
    const song = songsToUse[index];
        this.currentSong = song;
        this.currentIndex = index;
        
        const audio = document.getElementById('audioPlayer');
        
        // Use the API endpoint to serve the music file
        const fileUrl = `/api/music/file?path=${encodeURIComponent(song.filepath)}`;
        audio.src = fileUrl;
        
        try {
            await audio.play();
            this.isPlaying = true;
            this.updatePlayerUI();
            this.updateMediaSession();
            this.showMiniPlayer();
            // this.addToRecentlyPlayed(song);
            
            console.log(`Now playing: ${song.title} by ${song.artist}`);
        } catch (error) {
            console.error('Error playing song:', error);
            this.showNotification('Unable to play this song', 'error');
        }
    }

    /**
     * Toggle play/pause
     */
    async togglePlayPause() {
        const audio = document.getElementById('audioPlayer');
        
        if (this.isPlaying) {
            audio.pause();
            this.isPlaying = false;
        } else {
            if (this.currentSong) {
                try {
                    await audio.play();
                    this.isPlaying = true;
                } catch (error) {
                    console.error('Error resuming playback:', error);
                }
            } else if (this.playlist.length > 0) {
                await this.playSong(0);
                return;
            }
        }
        
        this.updatePlayerUI();
    }

    /**
     * Play the next song
     */
    async nextSong() {
        if (this.playlist.length === 0) return;
        
        let nextIndex;
        
        if (this.isShuffleOn) {
            nextIndex = Math.floor(Math.random() * this.playlist.length);
        } else {
            nextIndex = this.currentIndex + 1;
            if (nextIndex >= this.playlist.length) {
                nextIndex = this.repeatMode === 'all' ? 0 : this.playlist.length - 1;
            }
        }
        
        await this.playSong(nextIndex);
    }

    /**
     * Play the previous song
     */
    async previousSong() {
        if (this.playlist.length === 0) return;
        
        let prevIndex = this.currentIndex - 1;
        if (prevIndex < 0) {
            prevIndex = this.repeatMode === 'all' ? this.playlist.length - 1 : 0;
        }
        
        await this.playSong(prevIndex);
    }

    /**
     * Toggle shuffle mode with better UI feedback
     */
    toggleShuffle() {
        this.isShuffleOn = !this.isShuffleOn;
        const shuffleBtn = document.getElementById('shuffleBtn');
        
        if (this.isShuffleOn) {
            shuffleBtn.classList.add('active');
        } else {
            shuffleBtn.classList.remove('active');
        }
        
        this.showNotification(`Shuffle ${this.isShuffleOn ? 'on' : 'off'}`, 'info');
    }

    /**
     * Cycle through repeat modes with better UI feedback
     */
    cycleRepeat() {
        const modes = ['off', 'all', 'one'];
        const currentIndex = modes.indexOf(this.repeatMode);
        this.repeatMode = modes[(currentIndex + 1) % modes.length];
        
        const repeatBtn = document.getElementById('repeatBtn');
        
        if (this.repeatMode === 'off') {
            repeatBtn.classList.remove('active');
            repeatBtn.innerHTML = `
                <svg class="icon icon-lg" viewBox="0 0 24 24">
                    <polyline points="17 1 21 5 17 9"/>
                    <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                    <polyline points="7 23 3 19 7 15"/>
                    <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                </svg>
            `;
        } else {
            repeatBtn.classList.add('active');
            if (this.repeatMode === 'one') {
                repeatBtn.innerHTML = `
                    <svg class="icon icon-lg" viewBox="0 0 24 24">
                        <polyline points="17 1 21 5 17 9"/>
                        <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                        <polyline points="7 23 3 19 7 15"/>
                        <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                        <text x="12" y="15" text-anchor="middle" font-size="8" fill="currentColor">1</text>
                    </svg>
                `;
            }
        }
        
        const modeText = this.repeatMode === 'off' ? 'off' : 
                        this.repeatMode === 'all' ? 'all' : 'one';
        this.showNotification(`Repeat ${modeText}`, 'info');
    }

    /**
     * Handle when a song ends
     */
    async onSongEnded() {
        if (this.repeatMode === 'one') {
            await this.playSong(this.currentIndex);
        } else if (this.settings.autoplay) {
            await this.nextSong();
        } else {
            this.isPlaying = false;
            this.updatePlayerUI();
        }
    }

    /**
     * Seek to a specific position in the current song
     */
    seekToPosition(event) {
        const audio = document.getElementById('audioPlayer');
        if (!audio.duration) return;
        
        const progressBar = event.currentTarget;
        const rect = progressBar.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const percentage = clickX / rect.width;
        
        audio.currentTime = audio.duration * percentage;
    }

    /**
     * Update the progress bar and time display
     */
    updateProgress() {
        const audio = document.getElementById('audioPlayer');
        if (!audio.duration) return;
        
        const progress = (audio.currentTime / audio.duration) * 100;
        
        // Update full player progress bar
        document.getElementById('progressFill').style.width = `${progress}%`;
        
        // Update mini player progress bar
        document.getElementById('miniProgressFill').style.width = `${progress}%`;
        
        document.getElementById('currentTime').textContent = this.formatTime(audio.currentTime);
    }

    /**
     * Update time display when metadata loads
     */
    updateTimeDisplay() {
        const audio = document.getElementById('audioPlayer');
        document.getElementById('totalTime').textContent = this.formatTime(audio.duration);
    }

    /**
     * Update player UI elements
     */
    updatePlayerUI() {
        // Update play/pause buttons with SVG icons
        const playIcon = `
            <svg class="icon icon-xl" viewBox="0 0 24 24">
                <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
        `;
        const pauseIcon = `
            <svg class="icon icon-xl" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16"/>
                <rect x="14" y="4" width="4" height="16"/>
            </svg>
        `;
        
        const miniPlayIcon = `
            <svg class="icon" viewBox="0 0 24 24">
                <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
        `;
        const miniPauseIcon = `
            <svg class="icon" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16"/>
                <rect x="14" y="4" width="4" height="16"/>
            </svg>
        `;
        
        // Update full player button
        const playPauseBtn = document.getElementById('playPauseBtn');
        playPauseBtn.innerHTML = this.isPlaying ? pauseIcon : playIcon;
        
        // Update mini player button
        const miniPlayPauseBtn = document.getElementById('miniPlayPauseBtn');
        miniPlayPauseBtn.innerHTML = this.isPlaying ? miniPauseIcon : miniPlayIcon;
        
        if (this.currentSong) {
            // Update mini player info
            document.getElementById('miniPlayerTitle').textContent = this.currentSong.title;
            document.getElementById('miniPlayerArtist').textContent = this.currentSong.artist;
            
            // Update full player info
    const titleElement = document.getElementById('playerTitle');
    const artistElement = document.getElementById('playerArtist');
    
    titleElement.textContent = this.currentSong.title;
    artistElement.textContent = this.currentSong.artist;

    // Setup auto-scrolling for long text
    setTimeout(() => {
        this.setupTextScrolling(titleElement);
        this.setupTextScrolling(artistElement);
    }, 100);
            // Update album art
            const miniArt = document.getElementById('miniPlayerArt');
            const playerArt = document.getElementById('playerArt');
            
            if (this.currentSong.albumArt) {
                miniArt.innerHTML = `<img src="${this.currentSong.albumArt}" alt="Album Art">`;
                playerArt.innerHTML = `<img src="${this.currentSong.albumArt}" alt="Album Art">`;
            } else {
                miniArt.textContent = '♪';
                playerArt.textContent = '♪';
            }
                if (this.isPlaying) {
                    // miniArt.classList.add('playing-animation');
                    playerArt.classList.add('playing-animation');
                } else {
                    miniArt.classList.remove('playing-animation');
                    playerArt.classList.remove('playing-animation');
                }
            
        }
        
        // Update music list to show currently playing song
        this.renderMusicList();
    }

    /**
     * Update Media Session API for notifications
     */
    updateMediaSession() {
        if ('mediaSession' in navigator && this.currentSong) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: this.currentSong.title,
                artist: this.currentSong.artist,
                album: this.currentSong.album,
                artwork: this.currentSong.albumArt ? [
                    { src: this.currentSong.albumArt, sizes: '512x512', type: 'image/jpeg' }
                ] : []
            });
        }
    }

    /**
     * Show the mini player
     */
    showMiniPlayer() {
        const miniPlayer = document.getElementById('miniPlayer');
        miniPlayer.classList.add('visible');
    }

    /**
     * Hide the mini player
     */
    hideMiniPlayer() {
        const miniPlayer = document.getElementById('miniPlayer');
        miniPlayer.classList.remove('visible');
    }

    /**
     * Expand to full player overlay
     */
    expandPlayer() {
        const playerOverlay = document.getElementById('playerOverlay');
        playerOverlay.classList.add('expanded');
        document.body.style.overflow = 'hidden';
        
        // Update the full player info
        this.updatePlayerUI();
    }

    /**
     * Collapse to mini player
     */
    collapsePlayer() {
        const playerOverlay = document.getElementById('playerOverlay');
        playerOverlay.classList.remove('expanded');
        document.body.style.overflow = '';
    }

    /**
     * Handle keyboard shortcuts
     */
    handleKeyboardShortcuts(event) {
        // Don't trigger if user is typing in an input
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            return;
        }

        switch (event.code) {
            case 'Space':
                event.preventDefault();
                this.togglePlayPause();
                break;
            case 'ArrowRight':
                event.preventDefault();
                this.nextSong();
                break;
            case 'ArrowLeft':
                event.preventDefault();
                this.previousSong();
                break;
            case 'Escape':
                event.preventDefault();
                // Close playlist modal if open, otherwise minimize player
                if (document.getElementById('playlistModal').classList.contains('visible')) {
                    this.closePlaylistModal();
                } else {
                    this.collapsePlayer();
                }
                break;
        }
    }

    /**
     * Handle audio playback errors
     */
    handleAudioError(event) {
        console.error('Audio error:', event);
        this.showNotification('Playback error occurred', 'error');
        this.isPlaying = false;
        this.updatePlayerUI();
    }

    /**
     * Playlist Management Functions
     */

    /**
     * Create a new playlist
     */
    createPlaylist() {
        const input = document.getElementById('playlistNameInput');
        const name = input.value.trim();
        
        if (!name) {
            this.showNotification('Please enter a playlist name', 'warning');
            return;
        }
        
        if (this.userData.playlists.find(p => p.name === name)) {
            this.showNotification('Playlist name already exists', 'warning');
            return;
        }
        
        const playlist = {
            id: Date.now().toString(),
            name: name,
            songs: [],
            createdAt: new Date().toISOString()
        };
        
        this.userData.playlists.push(playlist);
        this.saveUserData();
        this.renderPlaylists();
        
        input.value = '';
        this.showNotification('Playlist created successfully', 'success');
    }

    /**
     * Render playlists in the UI (new Spotify-style layout)
     */
    renderPlaylists() {
        const container = document.getElementById('playlistsList');
        
        if (this.userData.playlists.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📋</div>
                    <h3>No playlists yet</h3>
                    <p>Create your first playlist to organize your music</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = this.userData.playlists.map(playlist => {
            const songs = playlist.songs.map(songId => 
                this.allSongs.find(song => song.id === songId)
            ).filter(song => song);
            
            // Calculate total duration
            const totalDuration = songs.reduce((total, song) => total + (song.duration || 0), 0);
            
            // Get first song's album art for playlist art
            const firstSong = songs[0];
            const playlistArt = firstSong?.albumArt || null;
            
            return `
                <div class="playlist-item" onclick="player.openPlaylistDetail('${playlist.id}')">
                    <div class="playlist-art">
                        ${playlistArt ? `<img src="${playlistArt}" alt="Playlist Art">` : '📋'}
                    </div>
                    <div class="playlist-info">
                        <div class="playlist-name">${this.escapeHtml(playlist.name)}</div>
                        <div class="playlist-count">${playlist.songs.length} songs</div>
                    </div>
                    <div class="playlist-duration">${this.formatTime(totalDuration)}</div>
                    <!--
                    <div class="playlist-actions">
                        <button class="playlist-menu-btn" onclick="player.playCurrentPlaylist('${playlist.id}', event)" title="Play Playlist">
                            <svg class="icon" viewBox="0 0 24 24">
                                <polygon points="5 3 19 12 5 21 5 3"/>
                            </svg>
                        </button>
                    </div>
                    -->
                </div>
            `;
        }).join('');
    }

    /**
     * Open playlist detail view
     */
    openPlaylistDetail(playlistId) {
        const playlist = this.userData.playlists.find(p => p.id === playlistId);
        if (!playlist) return;
        
        this.currentPlaylistId = playlistId;
        
        // Hide list view and show detail view
        const listView = document.querySelector('.playlist-list-view');
        const detailView = document.getElementById('playlistDetail');
        
        listView.style.display = 'none';
        detailView.style.display = 'block';
        
        // Get songs in playlist
        const songs = playlist.songs.map(songId => 
            this.allSongs.find(song => song.id === songId)
        ).filter(song => song);
        
        // Calculate total duration
        const totalDuration = songs.reduce((total, song) => total + (song.duration || 0), 0);
        
        // Update playlist detail header
        document.getElementById('playlistDetailName').textContent = playlist.name;
        document.getElementById('playlistDetailCount').textContent = `${songs.length} songs`;
        document.getElementById('playlistDetailDuration').textContent = this.formatTime(totalDuration);
        
        // Set playlist art (first song's album art or default)
        const playlistArt = document.getElementById('playlistDetailArt');
        const firstSong = songs[0];
        if (firstSong?.albumArt) {
            playlistArt.innerHTML = `<img src="${firstSong.albumArt}" alt="Playlist Art">`;
        } else {
            playlistArt.textContent = '📋';
        }
        
        // Render playlist tracks
        this.renderPlaylistTracks(songs);
    }

    /**
     * Show playlist list view
     */
    showPlaylistList() {
        const listView = document.querySelector('.playlist-list-view');
        const detailView = document.getElementById('playlistDetail');
        
        listView.style.display = 'block';
        detailView.style.display = 'none';
        this.currentPlaylistId = null;
    }

    /**
     * Render tracks in playlist detail view
     */
    renderPlaylistTracks(songs) {
        const container = document.getElementById('playlistDetailTracks');
        
        if (songs.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">♪</div>
                    <h3>Empty playlist</h3>
                    <p>Add some songs to this playlist</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = songs.map((song, index) => `
            <div class="track-item" data-song-id="${song.id}">
                <div class="track-number">${index + 1}</div>
                <div class="track-info">
                    <div class="track-art">
                        ${song.albumArt ? `<img src="${song.albumArt}" alt="Album Art">` : '♪'}
                    </div>
                    <div class="track-details">
                        <div class="track-title">${this.escapeHtml(song.title)}</div>
                        <div class="track-artist">${this.escapeHtml(song.artist)}</div>
                    </div>
                </div> 
            <!--    <div class="track-album">${this.escapeHtml(song.album)}</div> -->
                <div class="track-duration">${this.formatTime(song.duration)}</div>
                <div class="track-actions">
                    <button class="track-menu-btn bad-btn" onclick="player.removeFromPlaylist('${song.id}', event)" title="Remove from Playlist">
                        <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" xmlns="http://www.w3.org/2000/svg">
  <line x1="6" y1="12" x2="18" y2="12" />
</svg>

                    </button>
                </div>
            </div>
        `).join('');
        
        // Add click listeners for tracks
        container.querySelectorAll('.track-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.track-menu-btn')) {
                    const songId = item.dataset.songId;
                    const songIndex = this.allSongs.findIndex(s => s.id === songId);
                    if (songIndex !== -1) {
                        // Set playlist as current playlist and play song
                        this.playlist = [...songs];
                        const playlistIndex = songs.findIndex(s => s.id === songId);
                        this.playSong(playlistIndex);
                    }
                }
            });
        });
    }

    /**
     * Play current playlist from detail view
     */
   playCurrentPlaylist() {
    if (!this.currentPlaylistId) return;
    
    const playlist = this.userData.playlists.find(p => p.id === this.currentPlaylistId);
    if (!playlist) return;
    
    const songs = playlist.songs.map(songId => 
        this.allSongs.find(song => song.id === songId)
    ).filter(song => song);
    
    if (songs.length > 0) {
        // Set the queue without affecting main library
        this.currentQueue = songs;
        this.queueName = playlist.name;
        this.playSong(0);
        // Don't switch tabs or re-render main list
        this.showNotification(`Playing playlist: ${playlist.name}`, 'info');
    }
}

    /**
     * Delete current playlist from detail view
     */
    deleteCurrentPlaylist() {
        if (!this.currentPlaylistId) return;
        
        const playlist = this.userData.playlists.find(p => p.id === this.currentPlaylistId);
        if (!playlist) return;
        
        if (confirm(`Are you sure you want to delete "${playlist.name}"?`)) {
            this.userData.playlists = this.userData.playlists.filter(p => p.id !== this.currentPlaylistId);
            this.saveUserData();
            this.showPlaylistList();
            this.renderPlaylists();
            this.showNotification('Playlist deleted', 'success');
        }
    }

    /**
     * Remove song from playlist
     */
    removeFromPlaylist(songId, event) {
        event.stopPropagation();
        
        if (!this.currentPlaylistId) return;
        
        const playlist = this.userData.playlists.find(p => p.id === this.currentPlaylistId);
        if (!playlist) return;
        
        playlist.songs = playlist.songs.filter(id => id !== songId);
        this.saveUserData();
        
        // Refresh the detail view
        this.openPlaylistDetail(this.currentPlaylistId);
        this.showNotification('Song removed from playlist', 'success');
    }

   

    /**
     * Show playlist selection modal
     */
    showPlaylistModal(songId, event) {
        event.stopPropagation();
        this.currentSongForPlaylist = songId;
        
        const modal = document.getElementById('playlistModal');
        const modalBody = document.getElementById('playlistModalBody');
        
        // Render existing playlists
        if (this.userData.playlists.length === 0) {
            modalBody.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                    <div style="font-size: 2rem; margin-bottom: 1rem;">📋</div>
                    <p>No playlists yet. Create one below!</p>
                </div>
            `;
        } else {
            modalBody.innerHTML = this.userData.playlists.map(playlist => `
                <div class="playlist-option" onclick="player.addSongToPlaylist('${songId}', '${playlist.id}')">
                    <div class="playlist-option-icon">📋</div>
                    <div class="playlist-option-info">
                        <div class="playlist-option-name">${this.escapeHtml(playlist.name)}</div>
                        <div class="playlist-option-count">${playlist.songs.length} songs</div>
                    </div>
                </div>
            `).join('');
        }
        
        modal.classList.add('visible');
        document.body.style.overflow = 'hidden';
    }

    /**
     * Close playlist modal
     */
    closePlaylistModal() {
        const modal = document.getElementById('playlistModal');
        modal.classList.remove('visible');
        document.body.style.overflow = '';
        this.currentSongForPlaylist = null;
        
        // Clear quick create input
        document.getElementById('quickCreateInput').value = '';
    }

    /**
     * Add song to specific playlist
     */
    addSongToPlaylist(songId, playlistId) {
        const playlist = this.userData.playlists.find(p => p.id === playlistId);
        if (!playlist) return;
        
        if (!playlist.songs.includes(songId)) {
            playlist.songs.push(songId);
            this.saveUserData();
            this.showNotification(`Added to ${playlist.name}`, 'success');
        } else {
            this.showNotification(`Already in ${playlist.name}`, 'info');
        }
        
        this.closePlaylistModal();
        this.renderPlaylists(); // Update playlist view if currently visible
    }

    /**
     * Quick create playlist and add song
     */
    quickCreateAndAdd() {
        const input = document.getElementById('quickCreateInput');
        const name = input.value.trim();
        
        if (!name) {
            this.showNotification('Please enter a playlist name', 'warning');
            return;
        }
        
        if (this.userData.playlists.find(p => p.name === name)) {
            this.showNotification('Playlist name already exists', 'warning');
            return;
        }
        
        // Create playlist
        const playlist = {
            id: Date.now().toString(),
            name: name,
            songs: [this.currentSongForPlaylist],
            createdAt: new Date().toISOString()
        };
        
        this.userData.playlists.push(playlist);
        this.saveUserData();
        this.renderPlaylists();
        
        this.showNotification(`Created "${name}" and added song`, 'success');
        this.closePlaylistModal();
    }

    /**
     * Data Management Functions
     */

    /**
     * Add song to recently played
     */
    addToRecentlyPlayed(song) {
        const recent = this.userData.recentlyPlayed;
        const existingIndex = recent.findIndex(s => s.id === song.id);
        
        if (existingIndex !== -1) {
            recent.splice(existingIndex, 1);
        }
        
        recent.unshift({ ...song, playedAt: new Date().toISOString() });
        
        // Keep only last 50 songs
        if (recent.length > 50) {
            recent.splice(50);
        }
        
        this.saveUserData();
    }

    /**
     * Save user data to localStorage
     */
    saveUserData() {
        localStorage.setItem('playlists', JSON.stringify(this.userData.playlists));
        localStorage.setItem('recentlyPlayed', JSON.stringify(this.userData.recentlyPlayed));
        localStorage.setItem('favorites', JSON.stringify(this.userData.favorites));
    }

    /**
     * Load settings from localStorage
     */
    loadSettings() {
        const savedSettings = localStorage.getItem('settings');
        if (savedSettings) {
            this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
        }
        
        // Update UI with loaded settings (only if elements exist)
        const musicDirInput = document.getElementById('musicDirectoryInput');
        if (musicDirInput) {
            musicDirInput.value = this.settings.musicDirectory;
        }
    }

    /**
     * Update music directory setting
     */
    updateMusicDirectory(directory) {
        this.settings.musicDirectory = directory;
        localStorage.setItem('settings', JSON.stringify(this.settings));
        this.showNotification('Music directory updated', 'info');
    }

    /**
     * Export user data as JSON file
     */
    exportUserData() {
        const data = {
            playlists: this.userData.playlists,
            recentlyPlayed: this.userData.recentlyPlayed,
            favorites: this.userData.favorites,
            settings: this.settings,
            exportDate: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `music-player-data-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showNotification('Data exported successfully', 'success');
    }

    /**
     * Import user data from JSON file
     */
    importUserData(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                if (data.playlists) this.userData.playlists = data.playlists;
                if (data.recentlyPlayed) this.userData.recentlyPlayed = data.recentlyPlayed;
                if (data.favorites) this.userData.favorites = data.favorites;
                if (data.settings) this.settings = { ...this.settings, ...data.settings };
                
                this.saveUserData();
                localStorage.setItem('settings', JSON.stringify(this.settings));
                
                this.renderPlaylists();
                this.loadSettings();
                
                this.showNotification('Data imported successfully', 'success');
            } catch (error) {
                console.error('Import error:', error);
                this.showNotification('Failed to import data', 'error');
            }
        };
        
        reader.readAsText(file);
        event.target.value = ''; // Reset file input
    }

    /**
     * Utility Functions
     */

    /**
     * Format time in MM:SS format
     */
    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Show notification to user
     */
    showNotification(message, type = 'info') {
        // Simple notification system
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--accent);
            color: white;
            padding: 1rem;
            border-radius: 0.5rem;
            z-index: 1000;
            max-width: 300px;
            box-shadow: var(--shadow-lg);
        `;
        
        if (type === 'error') notification.style.background = '#ef4444';
        if (type === 'warning') notification.style.background = '#f59e0b';
        if (type === 'success') notification.style.background = '#10b981';
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    /**
     * Play method for external access
     */
    play() {
        if (!this.isPlaying) this.togglePlayPause();
    }

    /**
     * Pause method for external access
     */
    pause() {
        if (this.isPlaying) this.togglePlayPause();
    }
    /**
 * Update volume
 */
updateVolume(event) {
    const audio = document.getElementById('audioPlayer');
    const volume = event.target.value / 100;
    audio.volume = volume;
    
    const volumeText = document.getElementById('volumeText');
    volumeText.textContent = `${event.target.value}%`;
    
    // Update volume icon
    this.updateVolumeIcon(event.target.value);
}

/**
 * Toggle mute
 */
toggleMute() {
    const audio = document.getElementById('audioPlayer');
    const volumeSlider = document.getElementById('volumeSlider');
    const volumeText = document.getElementById('volumeText');
    
    if (audio.muted) {
        audio.muted = false;
        volumeSlider.value = this.lastVolume || 80;
        volumeText.textContent = `${volumeSlider.value}%`;
    } else {
        this.lastVolume = volumeSlider.value;
        audio.muted = true;
        volumeText.textContent = '0%';
    }
    
    this.updateVolumeIcon(audio.muted ? 0 : volumeSlider.value);
}

/**
 * Update volume icon based on volume level
 */
updateVolumeIcon(volume) {
    const volumeBtn = document.getElementById('volumeBtn');
    let iconSVG = '';
    
    if (volume == 0) {
        // Muted
        iconSVG = `
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <line x1="23" y1="9" x2="17" y2="15"/>
                <line x1="17" y1="9" x2="23" y2="15"/>
            </svg>
        `;
    } else if (volume < 50) {
        // Low volume
        iconSVG = `
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.08"/>
            </svg>
        `;
    } else {
        // High volume
        iconSVG = `
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.08"/>
            </svg>
        `;
    }
    
    volumeBtn.innerHTML = iconSVG;
}
/**
 * Setup continuous marquee for long text (hides left, reveals right)
 */
setupTextScrolling(element) {
    if (!element) return;

    // If we previously wrapped this element, unwrap it back to plain text first
    const existingTrack = element.querySelector('.marquee__track');
    if (existingTrack) {
        const firstSpan = existingTrack.querySelector('span');
        const originalText = firstSpan ? firstSpan.textContent : existingTrack.textContent;
        element.innerHTML = '';
        element.textContent = originalText || '';
    }

    // Remove legacy classes
    element.classList.remove('scrolling-text', 'animate');

    // Determine if text overflows
    const needsMarquee = element.scrollWidth > element.clientWidth;

    if (needsMarquee) {
        const text = element.textContent;
        element.classList.add('marquee');
        element.innerHTML = '';

        // Build marquee track with duplicated content for seamless loop
        const track = document.createElement('div');
        track.className = 'marquee__track';

        const span1 = document.createElement('span');
        span1.textContent = text;
        const span2 = document.createElement('span');
        span2.textContent = text;
        span2.setAttribute('aria-hidden', 'true');

        track.appendChild(span1);
        track.appendChild(span2);
        element.appendChild(track);
    } else {
        // Ensure plain text with no marquee
        element.classList.remove('marquee');
    }
}
}

// Initialize the music player when DOM is loaded
let player;

document.addEventListener('DOMContentLoaded', () => {
    player = new MusicPlayer();
});

// Service Worker Registration for PWA functionality
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
                // Force PWA install criteria check
                setTimeout(() => {
                    if ('getInstalledRelatedApps' in navigator) {
                        navigator.getInstalledRelatedApps().then(apps => {
                            console.log('PWA install check:', apps);
                        });
                    }
                }, 2000);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}