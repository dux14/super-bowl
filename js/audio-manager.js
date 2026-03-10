/**
 * Background Audio Manager
 * Handles autoplay with fallback, continuity between pages,
 * mute toggle, and fade in/out for video overlays.
 */
(function () {
  const body = document.body;
  const trackSrc = body.getAttribute('data-bg-track');
  if (!trackSrc) return;

  const TARGET_VOLUME = 0.13;
  const FADE_DURATION = 500; // ms
  const STORAGE_KEY_TIME = 'bgAudioTime';
  const STORAGE_KEY_TRACK = 'bgAudioTrack';
  const STORAGE_KEY_MUTED = 'bgAudioMuted';

  // --- Create audio element ---
  const audio = new Audio(trackSrc);
  audio.loop = true;
  audio.volume = TARGET_VOLUME;
  window.bgAudio = audio;

  // --- Restore mute state ---
  const wasMuted = sessionStorage.getItem(STORAGE_KEY_MUTED) === 'true';
  audio.muted = wasMuted;

  // --- Restore playback position (continuity) ---
  const storedTrack = sessionStorage.getItem(STORAGE_KEY_TRACK);
  if (storedTrack === trackSrc) {
    const savedTime = parseFloat(sessionStorage.getItem(STORAGE_KEY_TIME));
    if (!isNaN(savedTime) && savedTime > 0) {
      audio.currentTime = savedTime;
    }
  } else {
    // Different track — reset
    sessionStorage.setItem(STORAGE_KEY_TRACK, trackSrc);
    sessionStorage.removeItem(STORAGE_KEY_TIME);
  }

  // --- Save position before leaving ---
  window.addEventListener('beforeunload', function () {
    sessionStorage.setItem(STORAGE_KEY_TIME, String(audio.currentTime));
    sessionStorage.setItem(STORAGE_KEY_TRACK, trackSrc);
  });

  // --- Autoplay with fallback ---
  function tryPlay() {
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(function () {
        // Autoplay blocked — wait for first user interaction
        document.addEventListener('click', function resumeAudio() {
          audio.play();
          document.removeEventListener('click', resumeAudio);
        }, { once: true });
      });
    }
  }

  tryPlay();

  // --- Fade functions ---
  let fadeInterval = null;

  function fadeOutBgAudio(duration) {
    duration = duration || FADE_DURATION;
    if (fadeInterval) clearInterval(fadeInterval);
    const step = 20; // ms per tick
    const decrement = (TARGET_VOLUME / (duration / step));
    fadeInterval = setInterval(function () {
      if (audio.volume - decrement <= 0) {
        audio.volume = 0;
        audio.pause();
        clearInterval(fadeInterval);
        fadeInterval = null;
      } else {
        audio.volume = Math.max(0, audio.volume - decrement);
      }
    }, step);
  }

  function fadeInBgAudio(duration) {
    duration = duration || FADE_DURATION;
    if (fadeInterval) clearInterval(fadeInterval);
    audio.volume = 0;
    if (!audio.muted) {
      audio.play();
    }
    const step = 20;
    const increment = (TARGET_VOLUME / (duration / step));
    fadeInterval = setInterval(function () {
      if (audio.volume + increment >= TARGET_VOLUME) {
        audio.volume = TARGET_VOLUME;
        clearInterval(fadeInterval);
        fadeInterval = null;
      } else {
        audio.volume = Math.min(TARGET_VOLUME, audio.volume + increment);
      }
    }, step);
  }

  window.fadeOutBgAudio = fadeOutBgAudio;
  window.fadeInBgAudio = fadeInBgAudio;

  // --- Mute/Unmute button ---
  const btn = document.createElement('button');
  btn.id = 'audio-toggle-btn';
  btn.className = 'audio-toggle-btn';
  btn.innerHTML = wasMuted ? '🔇' : '🔊';
  btn.setAttribute('aria-label', 'Toggle background music');

  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    audio.muted = !audio.muted;
    btn.innerHTML = audio.muted ? '🔇' : '🔊';
    sessionStorage.setItem(STORAGE_KEY_MUTED, String(audio.muted));
    // If unmuting for the first time, also try to play
    if (!audio.muted && audio.paused) {
      audio.play();
    }
  });

  body.appendChild(btn);
})();
