/**
 * @module screen
 * @description 화면(.screen) 전환 유틸리티. stageManager와 index 간 순환 참조를 막기 위해 분리.
 */

/**
 * 특정 화면을 활성화하고 나머지를 숨김.
 * @param {string} screenId - 활성화할 .screen 요소의 id
 */
export const showScreen = (screenId) => {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  const screen = document.querySelector(`.screen#${screenId}`);
  if (screen) screen.classList.add("active");
};
