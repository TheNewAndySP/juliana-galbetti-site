'use strict';

// Preview playback is muted. Sound always starts with an explicit user action.
function setupVideo(video) {
  const section = video.closest('.video-section');
  const player = section?.querySelector('.video-player');
  const startButton = section?.querySelector('.play-button');
  const controls = section?.querySelector('.video-controls');
  if (!section || !player || !startButton || !controls) return;
  const toggle = controls.querySelector('.video-toggle');
  const sound = controls.querySelector('.video-sound');
  const seek = controls.querySelector('input[type="range"]');
  const time = controls.querySelector('.video-time');
  const fullscreen = controls.querySelector('.video-fullscreen');
  const note = section.querySelector('.video-note');
  const error = section.querySelector('.video-error');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let watchingWithSound = false;
  let failed = false;
  let attempt = 0;
  let restartOnMetadata = false;

  const clock = (seconds) => {
    const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  };
  function update() {
    const playing = !video.paused && !video.ended;
    const duration = Number.isFinite(video.duration) ? video.duration : 155;
    startButton.hidden = failed || (watchingWithSound && !video.muted && !video.ended);
    startButton.setAttribute('aria-label', video.ended ? 'Replay with sound from the beginning' : 'Play with sound from the beginning');
    toggle.textContent = playing ? 'Pause' : (watchingWithSound && !video.ended ? 'Resume' : 'Play');
    toggle.setAttribute('aria-label', playing ? 'Pause video' : (watchingWithSound && !video.ended ? 'Resume video' : 'Play video from the beginning with sound'));
    sound.textContent = video.muted ? 'Sound off' : 'Mute sound';
    sound.setAttribute('aria-label', video.muted ? 'Sound off. Play from the beginning with sound' : 'Mute sound');
    toggle.disabled = failed;
    sound.disabled = failed;
    seek.disabled = failed || !Number.isFinite(video.duration);
    seek.max = String(duration);
    seek.value = String(video.currentTime || 0);
    seek.setAttribute('aria-valuetext', `${clock(video.currentTime)} of ${clock(duration)}`);
    time.textContent = `${clock(video.currentTime)} / ${clock(duration)}`;
    if (failed) note.textContent = 'Open the MP4 file to watch this video.';
    else if (watchingWithSound && !video.muted) note.textContent = playing ? 'Playing with sound.' : 'Paused.';
    else if (playing) note.textContent = 'Muted preview. Play with sound to restart.';
    else note.textContent = 'Play with sound to watch from the beginning.';
  }
  function playSafely(automatic = false) {
    const thisAttempt = ++attempt;
    try {
      Promise.resolve(video.play()).then(() => {
        if (thisAttempt === attempt) update();
      }).catch(() => {
        if (thisAttempt !== attempt) return;
        // A rejected autoplay request is a normal manual state, not a media error.
        if (automatic) video.autoplay = false;
        update();
      });
    } catch {
      if (automatic) video.autoplay = false;
      update();
    }
  }
  function startWithSound() {
    ++attempt;
    video.autoplay = false;
    video.loop = false;
    video.pause();
    restartOnMetadata = false;
    // Keep reset, unmute and play in the same user-activation task (including iOS).
    try { video.currentTime = 0; } catch { restartOnMetadata = true; }
    watchingWithSound = true;
    video.muted = false;
    playSafely();
    update();
    toggle.focus();
  }
  function showMediaError() {
    ++attempt;
    failed = true;
    error.hidden = false;
    update();
  }

  video.defaultMuted = true;
  video.muted = true;
  video.playsInline = true;
  startButton.addEventListener('click', startWithSound);
  toggle.addEventListener('click', () => {
    if (!video.paused && !video.ended) {
      ++attempt;
      video.pause();
      update();
    } else if (!watchingWithSound || video.ended) startWithSound();
    else { playSafely(); update(); }
  });
  sound.addEventListener('click', () => {
    if (video.muted) startWithSound();
    else { video.muted = true; update(); }
  });
  seek.addEventListener('input', () => {
    try { video.currentTime = Number(seek.value); } catch { /* Metadata is not ready yet. */ }
    update();
  });
  fullscreen.hidden = typeof player.requestFullscreen !== 'function';
  fullscreen.addEventListener('click', () => {
    const request = document.fullscreenElement === player ? document.exitFullscreen() : player.requestFullscreen();
    Promise.resolve(request).catch(() => { /* Fullscreen can be denied by the browser. */ });
  });
  document.addEventListener('fullscreenchange', () => {
    const active = document.fullscreenElement === player;
    fullscreen.textContent = active ? 'Exit fullscreen' : 'Fullscreen';
    fullscreen.setAttribute('aria-label', active ? 'Exit fullscreen' : 'Enter fullscreen');
  });
  video.addEventListener('loadedmetadata', () => {
    if (restartOnMetadata) {
      try { video.currentTime = 0; restartOnMetadata = false; } catch { /* Keep the manual control available. */ }
    }
    update();
  });
  ['play', 'pause', 'ended', 'timeupdate', 'durationchange', 'seeking', 'seeked'].forEach((event) => video.addEventListener(event, update));
  video.addEventListener('volumechange', () => {
    if (!video.muted && !watchingWithSound && !failed) startWithSound();
    else update();
  });
  video.addEventListener('error', showMediaError);
  video.querySelector('source')?.addEventListener('error', showMediaError);
  motion.addEventListener?.('change', () => {
    if (motion.matches && !watchingWithSound) {
      ++attempt;
      video.autoplay = false;
      video.loop = false;
      video.pause();
      update();
    }
  });

  // English controls replace browser-localized controls after enhancement is ready.
  controls.hidden = false;
  video.controls = false;
  update();
  if (!motion.matches) {
    video.autoplay = true;
    video.loop = true;
    video.preload = 'auto';
    playSafely(true);
  }
}
document.querySelectorAll('video').forEach(setupVideo);

// Links still open full images when JavaScript or <dialog> is unavailable.
const dialog = document.querySelector('.lightbox');
const photos = [...document.querySelectorAll('[data-gallery]')];
if (dialog && typeof dialog.showModal === 'function' && photos.length) {
  const image = dialog.querySelector('#lightbox-image');
  const caption = dialog.querySelector('#lightbox-caption');
  const counter = dialog.querySelector('#lightbox-counter');
  const close = dialog.querySelector('.lightbox-close');
  let current = 0;
  let opener;
  function show(index) {
    current = (index + photos.length) % photos.length;
    const photo = photos[current];
    const thumbnail = photo.querySelector('img');
    image.src = photo.href;
    image.alt = thumbnail.alt;
    caption.textContent = thumbnail.alt;
    counter.textContent = `${String(current + 1).padStart(2, '0')} / ${String(photos.length).padStart(2, '0')}`;
  }
  photos.forEach((photo, index) => {
    photo.addEventListener('click', (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      opener = photo;
      show(index);
      dialog.showModal();
      document.body.classList.add('has-modal');
      close.focus();
    });
  });
  close.addEventListener('click', () => dialog.close());
  dialog.querySelector('.lightbox-prev').addEventListener('click', () => show(current - 1));
  dialog.querySelector('.lightbox-next').addEventListener('click', () => show(current + 1));
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      show(current + (event.key === 'ArrowRight' ? 1 : -1));
    }
  });
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('has-modal');
    image.removeAttribute('src');
    opener?.focus({preventScroll: true});
  });
}
