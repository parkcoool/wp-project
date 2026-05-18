/**
 * @module index
 * @description 애플리케이션 진입점. 메뉴 이벤트 바인딩, 화면 전환, 캔버스 리사이즈를 담당.
 */

import {
  initStage,
  startPlaying,
  goToNextStage,
  pauseGame,
  resumeGame,
  exitGameToMenu,
} from "./stageManager.js";
import { showScreen } from "./screen.js";
import { initEngine } from "./engine.js";
import { GameState } from "./state.js";

const audioSettings = {
  master: { volume: 0.5, muted: false },
  music: { volume: 0.5, muted: false },
  effects: { volume: 0.5, muted: false },
};
const backgroundMusicAudio = new Audio("./assets/music/background/cosmos.mp3");
backgroundMusicAudio.loop = true;
backgroundMusicAudio.preload = "auto";
let hasUserActivatedAudio = false;

const clampVolume = (value) => Math.min(Math.max(value, 0), 1);

function getEffectiveAudioVolume(control) {
  const setting = audioSettings[control];
  if (!setting || setting.muted) return 0;

  return clampVolume(setting.volume);
}

function applyAudioVolumes() {
  backgroundMusicAudio.volume = clampVolume(
    getEffectiveAudioVolume("master") * getEffectiveAudioVolume("music"),
  );
}

function playBackgroundMusic() {
  if (!hasUserActivatedAudio || backgroundMusicAudio.volume === 0) return;

  backgroundMusicAudio.play().catch(() => {
    // Browsers can still block audio until a direct user gesture is accepted.
  });
}

function setBackgroundMusicSource(src) {
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
}

function enableBackgroundMusicAfterGesture() {
  if (hasUserActivatedAudio) return;

  hasUserActivatedAudio = true;
  playBackgroundMusic();
}

document.addEventListener("DOMContentLoaded", () => {
  initEngine();
  showScreen("menu-screen");
  typeMainSystemDescription();
  applyAudioVolumes();

  document.addEventListener("pointerdown", enableBackgroundMusicAfterGesture, {
    once: true,
  });
  document.addEventListener("keydown", enableBackgroundMusicAfterGesture, {
    once: true,
  });


  // ── 메인 메뉴 모달 열기/닫기 ──
  const modalOpenBtn = document.querySelectorAll(".main-menu-btn");
  const modalBoxes = document.querySelectorAll(".main-menu-modal");
  modalOpenBtn.forEach((btn, index) => {
    btn.addEventListener("click", () => {
      modalBoxes[index - 1]?.classList.add("active");
    });
  });

  const modalCloseBtn = document.querySelectorAll(".main-menu-modal-close-btn");
  modalCloseBtn.forEach((btn) => {
    btn.addEventListener("click", () => {
      btn.parentElement.classList.remove("active");
    });
  });

  // ── 설정 메뉴 선택 → 설정 컨텐츠 전환 ──
  const settingsMenuBtns = document.querySelectorAll(".settings-menu-btn");
  const settingsContents = document.querySelectorAll(".settings-content");
  settingsMenuBtns.forEach((btn, index) => {
    btn.addEventListener("click", () => {
      settingsMenuBtns.forEach((menuBtn) => {
        menuBtn.classList.remove("active");
      });
      settingsContents.forEach((content) => {
        content.classList.remove("active");
      });

      btn.classList.add("active");
      settingsContents[index]?.classList.add("active");
    });
  });

  // ── 스테이지 선택 → 게임 시작 ──
  const audioSettingSliders = document.querySelectorAll(".audio-setting-slider");
  audioSettingSliders.forEach((slider) => {
    const syncSliderProgress = () => {
      const min = Number(slider.min) || 0;
      const max = Number(slider.max) || 100;
      const value = Number(slider.value) || 0;
      const progress = ((value - min) / (max - min)) * 100;

      slider.style.setProperty("--slider-progress", `${progress}%`);
      slider.nextElementSibling.textContent = `${value}%`;

      const audioControl = slider.dataset.audioControl;
      if (audioControl && audioControl in audioSettings) {
        audioSettings[audioControl].volume = clampVolume(value / 100);
        applyAudioVolumes();
        playBackgroundMusic();
      }
    };

    syncSliderProgress();
    slider.addEventListener("input", syncSliderProgress);
  });

  const audioMuteBtns = document.querySelectorAll(".audio-mute-btn");
  const syncAudioMuteButton = (button) => {
    const audioControl = button.dataset.audioMute;
    const setting = audioSettings[audioControl];
    const icon = button.querySelector(".audio-mute-icon");
    if (!setting || !icon) return;

    button.classList.toggle("muted", setting.muted);
    button.setAttribute("aria-pressed", String(setting.muted));
    button.setAttribute(
      "aria-label",
      setting.muted ? `Unmute ${audioControl} volume` : `Mute ${audioControl} volume`,
    );
    icon.src = setting.muted
      ? "./assets/images/sprites/volume-x-icon.png"
      : "./assets/images/sprites/volume-icon.png";
  };

  audioMuteBtns.forEach((button) => {
    syncAudioMuteButton(button);

    button.addEventListener("click", () => {
      const audioControl = button.dataset.audioMute;
      if (!(audioControl in audioSettings)) return;

      audioSettings[audioControl].muted = !audioSettings[audioControl].muted;
      syncAudioMuteButton(button);
      applyAudioVolumes();
      playBackgroundMusic();
    });
  });

  const skillKeyInputs = document.querySelectorAll(".skill-key-input");
  const getKeyLabelFromEvent = (event) => {
    if (event.code.startsWith("Key")) return event.code.replace("Key", "");
    if (event.code.startsWith("Digit")) return event.code.replace("Digit", "");
    return event.key.length === 1 ? event.key.toUpperCase() : "";
  };
  const isKeyAlreadyAssigned = (targetInput, keyLabel) =>
    Array.from(skillKeyInputs).some(
      (input) => input !== targetInput && input.value === keyLabel,
    );
  const restoreAssignedKey = (input) => {
    input.value = input.dataset.currentKey || input.dataset.defaultKey || "";
  };

  skillKeyInputs.forEach((input) => {
    input.readOnly = true;
    input.dataset.currentKey = input.value;

    input.addEventListener("keydown", (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.key === "Tab") return;

      if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        input.value = "";
        return;
      }

      const keyLabel = getKeyLabelFromEvent(event);
      if (!keyLabel) return;

      event.preventDefault();
      if (isKeyAlreadyAssigned(input, keyLabel)) {
        restoreAssignedKey(input);
        return;
      }

      input.value = keyLabel;
      input.dataset.currentKey = keyLabel;
    });

    input.addEventListener("beforeinput", (event) => {
      event.preventDefault();
    });

    input.addEventListener("compositionstart", (event) => {
      event.preventDefault();
      restoreAssignedKey(input);
    });

    input.addEventListener("input", () => {
      const nextValue = input.value.replace(/[^a-zA-Z0-9]/g, "").slice(-1).toUpperCase();
      if (nextValue && isKeyAlreadyAssigned(input, nextValue)) {
        restoreAssignedKey(input);
        return;
      }

      input.value = nextValue;
      if (nextValue) input.dataset.currentKey = nextValue;
    });

    input.addEventListener("blur", () => {
      if (input.value) return;
      restoreAssignedKey(input);
    });
  });

  document.querySelector(".control-reset-btn")?.addEventListener("click", () => {
    skillKeyInputs.forEach((input) => {
      const defaultKey = input.dataset.defaultKey ?? "";
      input.value = defaultKey;
      input.dataset.currentKey = defaultKey;
    });
  });

  const gameplayDropdowns = document.querySelectorAll(".gameplay-setting-dropdown");
  const closeGameplayDropdowns = (exceptDropdown = null) => {
    gameplayDropdowns.forEach((dropdown) => {
      if (dropdown === exceptDropdown) return;

      dropdown.classList.remove("open");
      dropdown
        .querySelector(".gameplay-dropdown-btn")
        ?.setAttribute("aria-expanded", "false");
    });
  };

  gameplayDropdowns.forEach((dropdown) => {
    const dropdownBtn = dropdown.querySelector(".gameplay-dropdown-btn");
    const selectedText = dropdown.querySelector(".gameplay-dropdown-selected");
    const options = dropdown.querySelectorAll(".gameplay-dropdown-option");

    dropdownBtn?.addEventListener("click", () => {
      const willOpen = !dropdown.classList.contains("open");
      closeGameplayDropdowns(dropdown);
      dropdown.classList.toggle("open", willOpen);
      dropdownBtn.setAttribute("aria-expanded", String(willOpen));
    });

    options.forEach((option) => {
      option.addEventListener("click", () => {
        options.forEach((item) => item.classList.remove("active"));
        option.classList.add("active");
        selectedText.textContent = option.textContent.trim();

        if (dropdown.dataset.setting === "background-music") {
          setBackgroundMusicSource(option.dataset.musicSrc);
        }

        if (dropdown.dataset.setting === "brick-skin") {
          GameState.appearance.brickSkin = option.dataset.appearance;
        }

        if (dropdown.dataset.setting === "ball-skin") {
          GameState.appearance.ballSkin = option.dataset.appearance;
        }

        dropdown.classList.remove("open");
        dropdownBtn?.setAttribute("aria-expanded", "false");
      });
    });
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".gameplay-setting-dropdown")) {
      closeGameplayDropdowns();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeGameplayDropdowns();
      const status = window.gameAPI?.getState().status;
      if (status === "playing") {
        pauseGame();
      } else if (status === "paused") {
        resumeGame();
      }
    }
  });

  const stageStartBtns = document.querySelectorAll(".select-stage-btn");
  stageStartBtns.forEach((btn, index) => {
    btn.addEventListener("click", () => {
      const stageNum = index + 1;
      initStage(stageNum);
    });
  });

  // ── 인트로 오버레이: MISSION START 버튼 ──
  document.getElementById("intro-start-btn")?.addEventListener("click", () => {
    startPlaying();
  });

  document.getElementById("pause-continue-btn")?.addEventListener("click", () => {
    resumeGame();
  });

  document.getElementById("pause-exit-btn")?.addEventListener("click", () => {
    exitGameToMenu();
  });

  // ── 게임 오버 버튼 ──
  document.getElementById("retry-btn")?.addEventListener("click", () => {
    document.getElementById("game-over-overlay").classList.remove("active");
    initStage(window.gameAPI?.getState().currentStage ?? 1);
  });

  document.getElementById("gameover-menu-btn")?.addEventListener("click", () => {
    exitGameToMenu();
  });

  // ── 스테이지 클리어 버튼 ──
  document.getElementById("next-stage-btn")?.addEventListener("click", () => {
    document.getElementById("stage-clear-overlay").classList.remove("active");
    goToNextStage();
  });

  document.getElementById("stageclear-menu-btn")?.addEventListener("click", () => {
    exitGameToMenu();
  });

  // ── 미션 클리어 버튼 ──
  document.getElementById("mission-clear-menu-btn")?.addEventListener("click", () => {
    exitGameToMenu();
  });

  // ── 캔버스 크기 동적 설정 ──
  _resizeCanvas();
  window.addEventListener("resize", _resizeCanvas);
});

function typeMainSystemDescription() {
  const description = document.querySelector(".main-system-description");
  if (!description) return;

  const lines = [
    "Solar dimming detected.",
    "Astrophage contamination spreading...",
    "Mission Ready.",
  ];
  const typingDelay = 42;
  const deletingDelay = 24;
  const lineBreakDelay = 280;
  const restartDelay = 700;
  let lineIndex = 0;
  let charIndex = 0;
  let typedText = "";

  description.textContent = "";
  description.classList.add("is-typing");

  const renderText = () => {
    description.replaceChildren();
    typedText.split("\n").forEach((line, index) => {
      if (index > 0) description.append(document.createElement("br"));
      description.append(line);
    });
  };

  const deleteNextCharacter = () => {
    if (typedText.length > 0) {
      typedText = typedText.slice(0, -1);
      renderText();
      window.setTimeout(deleteNextCharacter, deletingDelay);
      return;
    }

    lineIndex = 0;
    charIndex = 0;
    window.setTimeout(typeNextCharacter, restartDelay);
  };

  const typeNextCharacter = () => {
    const currentLine = lines[lineIndex];

    if (charIndex < currentLine.length) {
      typedText += currentLine[charIndex];
      renderText();
      charIndex += 1;
      window.setTimeout(typeNextCharacter, typingDelay);
      return;
    }

    lineIndex += 1;
    charIndex = 0;

    if (lineIndex < lines.length) {
      typedText += "\n";
      renderText();
      window.setTimeout(typeNextCharacter, lineBreakDelay);
      return;
    }

    window.setTimeout(deleteNextCharacter, restartDelay);
  };

  typeNextCharacter();
}

export { showScreen } from "./screen.js";

/**
 * 게임 캔버스를 .game-canvas-container 크기에 맞게 리사이즈.
 * 윈도우 resize 이벤트마다 호출.
 */
function _resizeCanvas() {
  const container = document.querySelector(".game-canvas-container");
  const canvas = document.getElementById("game-canvas");
  if (!container || !canvas) return;

  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;

  // 게임 루프에 리사이즈 알림 (외부 등록 콜백)
  if (typeof window.onCanvasResize === "function") {
    window.onCanvasResize(canvas.width, canvas.height);
  }
}

window.resizeCanvas = _resizeCanvas; // 외부에서 호출할 수 있도록 전역 함수로 등록
