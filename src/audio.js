export const audioSettings = {
  master: { volume: 0.5, muted: false },
  music: { volume: 0.5, muted: false },
  effects: { volume: 0.5, muted: false },
};

const soundEffectSources = {
  pulseShot: './assets/music/pulse-shot.mp3',
  hitAstrophage: './assets/music/hit-astrophage.mp3',
  crashAstrophage: './assets/music/crash-astrophage.mp3',
};

const soundEffects = Object.fromEntries(
  Object.entries(soundEffectSources).map(([name, src]) => {
    const audio = new Audio(src);
    audio.preload = 'auto';
    return [name, audio];
  }),
);

export const backgroundMusicAudio = new Audio(
  './assets/music/background/cosmos.mp3',
);
backgroundMusicAudio.loop = true;
backgroundMusicAudio.preload = 'auto';

let hasUserActivatedAudio = false;

export const clampVolume = (value) => Math.min(Math.max(value, 0), 1);

export const getEffectiveAudioVolume = (control) => {
  const setting = audioSettings[control];
  if (!setting || setting.muted) return 0;

  return clampVolume(setting.volume);
};

export const getEffectiveEffectsVolume = () => {
  return clampVolume(
    getEffectiveAudioVolume('master') * getEffectiveAudioVolume('effects'),
  );
};

export const applyAudioVolumes = () => {
  backgroundMusicAudio.volume = clampVolume(
    getEffectiveAudioVolume('master') * getEffectiveAudioVolume('music'),
  );
};

export const playBackgroundMusic = () => {
  if (!hasUserActivatedAudio || backgroundMusicAudio.volume === 0) return;

  backgroundMusicAudio.play().catch(() => {
    // Browsers can still block audio until a direct user gesture is accepted.
  });
};

export const setBackgroundMusicSource = (src) => {
  if (!src) return;

  const nextSrc = new URL(src, window.location.href).href;
  if (backgroundMusicAudio.src === nextSrc) {
    playBackgroundMusic();
    return;
  }

  const shouldResume = hasUserActivatedAudio && !backgroundMusicAudio.paused;
  backgroundMusicAudio.src = nextSrc;
  backgroundMusicAudio.load();

  if (shouldResume || hasUserActivatedAudio) {
    playBackgroundMusic();
  }
};

export const enableAudioAfterGesture = () => {
  if (hasUserActivatedAudio) return;

  hasUserActivatedAudio = true;
  playBackgroundMusic();
};

export const playSoundEffect = (name) => {
  const baseAudio = soundEffects[name];
  const volume = getEffectiveEffectsVolume();
  if (!baseAudio || volume === 0) return;

  const audio = baseAudio.cloneNode();
  audio.volume = volume;
  audio.play().catch(() => {
    // Ignore play interruptions so rapid collisions never break gameplay.
  });
};
