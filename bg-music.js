/*
 * נגן מוזיקת רקע משותף לכל האתר.
 * השירים מתנגנים ברצף, אחד אחרי השני, וממשיכים לנגן בין דפי האתר.
 *
 * === איך מוסיפים שיר ===
 * 1. העלו את קובץ ה-mp3 לתיקייה /audio/
 * 2. הוסיפו שורה חדשה לרשימה PLAYLIST למטה עם הנתיב והשם.
 *    השירים ינוגנו לפי הסדר שבו הם מופיעים כאן.
 */
(function () {
    'use strict';

    var PLAYLIST = [
        { src: '/audio/elvis.mp3', title: 'אלביס פרסלי' }
        // הוסיפו כאן שירים נוספים, למשל:
        // { src: '/audio/song2.mp3', title: 'שם השיר' },
    ];

    if (!PLAYLIST.length) return;

    var STORAGE_KEY = 'bgMusicState';
    var SAVE_THROTTLE_MS = 2000;
    var lastSave = 0;

    function loadState() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            var s = JSON.parse(raw);
            if (typeof s.index !== 'number') return null;
            return s;
        } catch (e) {
            return null;
        }
    }

    function saveState(state) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (e) { /* אחסון לא זמין - מתעלמים */ }
    }

    function buildPlayer() {
        var wrap = document.createElement('div');
        wrap.id = 'bg-music-player';
        wrap.className = 'bg-music-player';
        wrap.setAttribute('aria-label', 'נגן מוזיקת רקע');

        var audio = document.createElement('audio');
        audio.id = 'bg-audio';
        audio.preload = 'none';

        var btn = document.createElement('button');
        btn.id = 'bg-music-toggle';
        btn.type = 'button';
        btn.className = 'bg-music-btn';
        btn.setAttribute('aria-pressed', 'false');
        btn.title = 'הפעלה / השתקה של מוזיקת רקע';

        var icon = document.createElement('span');
        icon.id = 'bg-music-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = '🎵';

        var label = document.createElement('span');
        label.id = 'bg-music-label';
        label.textContent = 'נגן שיר רקע';

        btn.appendChild(icon);
        btn.appendChild(label);
        wrap.appendChild(audio);
        wrap.appendChild(btn);
        document.body.appendChild(wrap);

        return { audio: audio, btn: btn, icon: icon, label: label };
    }

    function init() {
        // אם בדף קיים כבר נגן סטטי - מסירים אותו כדי להימנע מכפילות
        var existing = document.getElementById('bg-music-player');
        if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

        var ui = buildPlayer();
        var audio = ui.audio, btn = ui.btn, icon = ui.icon, label = ui.label;
        audio.volume = 0.4;

        var state = loadState() || { index: 0, time: 0, playing: false };
        var current = 0;

        function persist(playing) {
            saveState({ index: current, time: audio.currentTime || 0, playing: !!playing });
        }

        function setState(playing) {
            btn.setAttribute('aria-pressed', playing ? 'true' : 'false');
            icon.textContent = playing ? '🔇' : '🎵';
            label.textContent = playing ? ('משמיע: ' + PLAYLIST[current].title) : 'נגן שיר רקע';
            persist(playing);
        }

        function loadTrack(i, time) {
            current = ((i % PLAYLIST.length) + PLAYLIST.length) % PLAYLIST.length;
            audio.src = PLAYLIST[current].src;
            if (time) {
                audio.addEventListener('loadedmetadata', function once() {
                    audio.removeEventListener('loadedmetadata', once);
                    try { audio.currentTime = time; } catch (e) { /* מתעלמים */ }
                });
            }
        }

        function play() {
            return audio.play().then(function () {
                setState(true);
            });
        }

        loadTrack(state.index, state.time);

        btn.addEventListener('click', function () {
            if (audio.paused) {
                play().catch(function () { label.textContent = 'לא ניתן לנגן'; });
            } else {
                audio.pause();
                setState(false);
            }
        });

        // בסיום שיר - מעבר אוטומטי לשיר הבא ברשימה (וחזרה לראשון אחרי האחרון)
        audio.addEventListener('ended', function () {
            loadTrack(current + 1, 0);
            play().catch(function () { setState(false); });
        });

        // שמירת מיקום הניגון כדי שאפשר יהיה להמשיך מאותה נקודה במעבר בין דפים
        audio.addEventListener('timeupdate', function () {
            if (audio.paused) return;
            var now = Date.now();
            if (now - lastSave >= SAVE_THROTTLE_MS) {
                lastSave = now;
                persist(true);
            }
        });

        window.addEventListener('beforeunload', function () {
            persist(!audio.paused);
        });

        // אם המוזיקה ניגנה בדף הקודם - ממשיכים אותה כאן ברצף
        if (state.playing) {
            play().catch(function () {
                // דפדפנים חוסמים ניגון אוטומטי עד למגע ראשון של המשתמש בדף
                setState(false);
                var resume = function () { play().catch(function () {}); };
                document.addEventListener('click', resume, { once: true });
                document.addEventListener('keydown', resume, { once: true });
                document.addEventListener('touchstart', resume, { once: true });
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
