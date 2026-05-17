/**
 * @module index
 * @description 애플리케이션 진입점. 메뉴 이벤트 바인딩, 화면 전환, 캔버스 리사이즈를 담당.
 */

import { initStage, startPlaying, goToNextStage } from "./stageManager.js";
import { showScreen } from "./screen.js";
import { initEngine } from "./engine.js";

document.addEventListener("DOMContentLoaded", () => {
  initEngine();
  showScreen("menu-screen");


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
    };

    syncSliderProgress();
    slider.addEventListener("input", syncSliderProgress);
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

  // ── 게임 오버 버튼 ──
  document.getElementById("retry-btn")?.addEventListener("click", () => {
    document.getElementById("game-over-overlay").classList.remove("active");
    initStage(window.gameAPI?.getState().currentStage ?? 1);
  });

  document.getElementById("gameover-menu-btn")?.addEventListener("click", () => {
    document.getElementById("game-over-overlay").classList.remove("active");
    showScreen("menu-screen");
  });

  // ── 스테이지 클리어 버튼 ──
  document.getElementById("next-stage-btn")?.addEventListener("click", () => {
    document.getElementById("stage-clear-overlay").classList.remove("active");
    goToNextStage();
  });

  document.getElementById("stageclear-menu-btn")?.addEventListener("click", () => {
    document.getElementById("stage-clear-overlay").classList.remove("active");
    showScreen("menu-screen");
  });

  // ── 미션 클리어 버튼 ──
  document.getElementById("mission-clear-menu-btn")?.addEventListener("click", () => {
    document.getElementById("mission-clear-overlay").classList.remove("active");
    showScreen("menu-screen");
  });

  // ── 캔버스 크기 동적 설정 ──
  _resizeCanvas();
  window.addEventListener("resize", _resizeCanvas);
});

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
