/**
 * index.js — 메뉴 화면 진입점 및 화면 전환 관리
 * 담당: 시원 (showScreen export + 스테이지 시작 연결)
 */

import { initStage, startPlaying, goToNextStage } from "./stageManager.js";
import { showScreen } from "./screen.js";

document.addEventListener("DOMContentLoaded", () => {
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

  // ── 스테이지 선택 → 게임 시작 ──
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

/**
 * 화면 전환 함수 — stageManager.js에서도 import해서 사용
 * @param {string} screenId
 */
export { showScreen } from "./screen.js";

/**
 * 캔버스를 컨테이너 크기에 맞게 리사이즈
 */
function _resizeCanvas() {
  const container = document.querySelector(".game-canvas-container");
  const canvas = document.getElementById("game-canvas");
  if (!container || !canvas) return;

  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;

  // 성화의 게임 루프에 리사이즈 알림
  if (typeof window.onCanvasResize === "function") {
    window.onCanvasResize(canvas.width, canvas.height);
  }
}
