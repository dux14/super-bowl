/**
 * Background Audio Manager
 * Handles autoplay with fallback, continuity between pages,
 * mute toggle, volume slider, and fade in/out for video overlays.
 */
(function () {
  const body = document.body;
  const trackSrc = body.getAttribute('data-bg-track');
  if (!trackSrc) return;

  const DEFAULT_VOLUME = 0.15;
  const FADE_DURATION = 500; // ms
  const STORAGE_KEY_TIME = 'bgAudioTime';
  const STORAGE_KEY_TRACK = 'bgAudioTrack';
  const STORAGE_KEY_MUTED = 'bgAudioMuted';
  const STORAGE_KEY_VOLUME = 'bgAudioVolume';

  // --- Restore saved volume or use default ---
  const savedVolume = parseFloat(sessionStorage.getItem(STORAGE_KEY_VOLUME));
  let targetVolume = (!isNaN(savedVolume) && savedVolume >= 0 && savedVolume <= 1) ? savedVolume : DEFAULT_VOLUME;

  // --- Create audio element ---
  const audio = new Audio(trackSrc);
  audio.loop = true;
  audio.volume = targetVolume;
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
    const decrement = (targetVolume / (duration / step));
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
    const increment = (targetVolume / (duration / step));
    fadeInterval = setInterval(function () {
      if (audio.volume + increment >= targetVolume) {
        audio.volume = targetVolume;
        clearInterval(fadeInterval);
        fadeInterval = null;
      } else {
        audio.volume = Math.min(targetVolume, audio.volume + increment);
      }
    }, step);
  }

  window.fadeOutBgAudio = fadeOutBgAudio;
  window.fadeInBgAudio = fadeInBgAudio;

  // --- Build audio controls container ---
  const container = document.createElement('div');
  container.className = 'audio-controls-wrap';

  // --- Volume slider ---
  const sliderWrap = document.createElement('div');
  sliderWrap.className = 'volume-slider-wrap';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '100';
  slider.value = String(Math.round(targetVolume * 100));
  slider.className = 'volume-slider';
  slider.setAttribute('aria-label', 'Volume');

  slider.addEventListener('input', function (e) {
    e.stopPropagation();
    const val = parseInt(slider.value, 10) / 100;
    targetVolume = val;
    audio.volume = val;
    sessionStorage.setItem(STORAGE_KEY_VOLUME, String(val));

    // Auto-unmute if dragging above zero while muted
    if (val > 0 && audio.muted) {
      audio.muted = false;
      sessionStorage.setItem(STORAGE_KEY_MUTED, 'false');
      btn.innerHTML = '🔊';
      if (audio.paused) audio.play();
    }

    // Update mute icon based on volume
    if (val === 0) {
      btn.innerHTML = '🔇';
    } else if (!audio.muted) {
      btn.innerHTML = '🔊';
    }
  });

  sliderWrap.appendChild(slider);

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

  // Assemble: slider on top, mute button below
  container.appendChild(sliderWrap);
  container.appendChild(btn);
  body.appendChild(container);
})();
