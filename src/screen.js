/**
 * screen.js — 화면 전환 유틸리티 (순환 참조 방지용 분리)
 * 담당: 시원
 */

/**
 * 특정 화면을 활성화하고 나머지를 숨김.
 * @param {string} screenId
 */
export const showScreen = (screenId) => {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  const screen = document.querySelector(`.screen#${screenId}`);
  if (screen) screen.classList.add("active");
};
