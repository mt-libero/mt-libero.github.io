(() => {
  'use strict';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const connection = navigator.connection;
  const videos = [...document.querySelectorAll('video')];
  const states = new Map(videos.map(video => [video, {
    visible: false,
    wanted: false,
    userPaused: false,
    internalPause: false,
  }]));
  const autoAllowed = () => !reducedMotion.matches && !connection?.saveData;
  const realVideos = [...document.querySelectorAll('.real-video')];
  const groupButton = document.getElementById('play-real-rollouts');
  const heroControl = document.querySelector('[data-video-toggle="hero-video"]');
  const hero = document.getElementById('hero-video');

  function updateControls() {
    heroControl.textContent = hero.paused ? 'Play film ▷' : 'Pause film Ⅱ';
    heroControl.setAttribute('aria-label', hero.paused ? 'Play parallel evaluation film' : 'Pause parallel evaluation film');
    const playing = realVideos.some(video => !video.paused);
    groupButton.textContent = playing ? 'Pause all rollouts Ⅱ' : 'Play all rollouts ▷';
  }

  function pauseVideo(video, manual = false) {
    const state = states.get(video);
    state.wanted = false;
    if (manual) state.userPaused = true;
    if (!video.paused) {
      state.internalPause = true;
      video.pause();
    }
    updateControls();
  }

  async function playVideo(video, manual = false) {
    const state = states.get(video);
    if (document.hidden || video.closest('[hidden]')) return;
    if (!manual && (!autoAllowed() || state.userPaused || !state.visible)) return;
    if (manual) state.userPaused = false;
    state.wanted = true;
    try {
      await video.play();
      if (!state.wanted || document.hidden || video.closest('[hidden]')) pauseVideo(video);
    } catch (_) {
      // Browser autoplay restrictions leave the poster and play control usable.
    }
    updateControls();
  }

  for (const video of videos) {
    video.addEventListener('play', () => {
      states.get(video).userPaused = false;
      updateControls();
    });
    video.addEventListener('pause', () => {
      const state = states.get(video);
      if (state.internalPause) state.internalPause = false;
      else {
        state.userPaused = true;
        state.wanted = false;
      }
      updateControls();
    });
  }
  heroControl.hidden = false;
  heroControl.addEventListener('click', () => {
    if (hero.paused) playVideo(hero, true);
    else pauseVideo(hero, true);
  });
  groupButton.hidden = false;
  groupButton.addEventListener('click', () => {
    if (realVideos.some(video => !video.paused)) {
      realVideos.forEach(video => pauseVideo(video, true));
    } else {
      realVideos.forEach(video => {
        video.currentTime = 0;
        playVideo(video, true);
      });
    }
  });

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const video = entry.target;
        const state = states.get(video);
        state.visible = entry.isIntersecting && entry.intersectionRatio >= 0.15;
        if (!state.visible) pauseVideo(video);
        else if (video.hasAttribute('data-autoplay')) playVideo(video);
      }
    }, { threshold: [0, 0.15] });
    videos.forEach(video => observer.observe(video));
  }
  function updateMotionPreference() {
    for (const video of videos) {
      if (document.hidden || !autoAllowed()) pauseVideo(video);
      else if (video.hasAttribute('data-autoplay')) playVideo(video);
    }
  }
  reducedMotion.addEventListener('change', updateMotionPreference);
  connection?.addEventListener('change', updateMotionPreference);
  document.addEventListener('visibilitychange', updateMotionPreference);

  const tabs = [...document.querySelectorAll('[role="tab"]')];
  function activateTab(tab, play = true) {
    for (const item of tabs) {
      const selected = item === tab;
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
      const panel = document.getElementById(item.getAttribute('aria-controls'));
      const video = panel.querySelector('video');
      if (!selected) pauseVideo(video);
      panel.hidden = !selected;
      if (selected && play) playVideo(video, true);
    }
  }
  document.documentElement.classList.add('js');
  document.querySelector('[role="tablist"]').hidden = false;
  activateTab(tabs[0], false);
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activateTab(tab));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      tabs[next].focus();
      activateTab(tabs[next]);
    });
  });

  const learnerButtons = [...document.querySelectorAll('[data-learner]')];
  const entryPanels = [...document.querySelectorAll('[data-entry-panel]')];
  const entryMethods = [...document.querySelectorAll('[data-entry-method]')];
  function selectLearner(button) {
    const panel = document.getElementById(button.getAttribute('aria-controls'));
    learnerButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    entryPanels.forEach(item => { item.hidden = item !== panel; });
    entryMethods.forEach(method => {
      const selected = method.dataset.entryMethod === panel.dataset.entryPanel;
      method.classList.toggle('is-active', selected);
      method.querySelector('.entry-indicator').hidden = !selected;
    });
  }
  learnerButtons.forEach((button, index) => {
    button.disabled = false;
    button.addEventListener('click', () => selectLearner(button));
    button.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % learnerButtons.length;
      else if (event.key === 'ArrowLeft') next = (index - 1 + learnerButtons.length) % learnerButtons.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = learnerButtons.length - 1;
      else return;
      event.preventDefault();
      learnerButtons[next].focus();
      selectLearner(learnerButtons[next]);
    });
  });

  const navLinks = [...document.querySelectorAll('.site-header nav a')];
  const sections = navLinks.map(link => document.querySelector(link.getAttribute('href')));
  let queued = false;
  function updateReadingPosition() {
    queued = false;
    document.querySelector('.site-header').classList.toggle('is-scrolled', window.scrollY > 32);
    const distance = document.documentElement.scrollHeight - window.innerHeight;
    const progress = distance > 0 ? Math.min(1, Math.max(0, window.scrollY / distance)) : 0;
    document.getElementById('reading-progress').style.transform = `scaleX(${progress})`;
    let current = -1;
    sections.forEach((section, index) => {
      if (section.getBoundingClientRect().top <= 150) current = index;
    });
    navLinks.forEach((link, index) => {
      if (index === current) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  function queueReadingPosition() {
    if (!queued) {
      queued = true;
      requestAnimationFrame(updateReadingPosition);
    }
  }
  window.addEventListener('scroll', queueReadingPosition, { passive: true });
  window.addEventListener('resize', queueReadingPosition, { passive: true });
  updateReadingPosition();
  updateControls();
})();
