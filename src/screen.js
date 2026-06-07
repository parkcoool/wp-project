// 화면 전환 유틸리티 (stageManager랑 index 사이 순환참조 막으려고 분리)

export const showScreen = (screenId) => {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  const screen = document.querySelector(`.screen#${screenId}`);
  if (screen) screen.classList.add("active");
};
