/**
 * fuelSystem.js — 연료 시스템
 * 담당: 시원 (Stage & State Manager)
 *
 * 연료 감소/증가 로직을 중앙에서 관리.
 * 외부(성화, 동규)에서 아래 함수들을 호출하여 연료를 변경.
 *
 * stageManager와의 순환 참조를 막기 위해 콜백 패턴 사용.
 * stageManager.js의 initStage() 안에서 registerFuelCallbacks()를 호출해 주입.
 */

import { GameState, FUEL_COSTS, FUEL_GAINS, FUEL_WARNING_THRESHOLD } from "./state.js";

// ─────────────────────────────────────────────
// 콜백 등록 (stageManager에서 initStage 시 주입)
// ─────────────────────────────────────────────

const _cb = {
  addSystemLog: (_msg, _type) => {},
  triggerGameOver: () => {},
};

/**
 * stageManager.js의 initStage()에서 반드시 호출.
 * @param {{ addSystemLog: Function, triggerGameOver: Function }} callbacks
 */
export function registerFuelCallbacks(callbacks) {
  if (callbacks.addSystemLog) _cb.addSystemLog = callbacks.addSystemLog;
  if (callbacks.triggerGameOver) _cb.triggerGameOver = callbacks.triggerGameOver;
}

// ─────────────────────────────────────────────
// 내부 유틸
// ─────────────────────────────────────────────

let _lowFuelWarned = false;

function _clampFuel() {
  GameState.fuel.current = Math.max(0, Math.min(GameState.fuel.max, GameState.fuel.current));
}

function _updateFuelUI() {
  const pct =
    GameState.fuel.max > 0 ? Math.round((GameState.fuel.current / GameState.fuel.max) * 100) : 0;

  // 퍼센트 텍스트
  const textEl = document.querySelector(".fuel-percent-text");
  if (textEl) textEl.textContent = `${pct}% REMAINING`;

  // SVG 바늘 회전: -90deg(E) ~ +90deg(F)
  const needle = document.getElementById("fuel-needle");
  if (needle) {
    const angle = -90 + (pct / 100) * 180;
    needle.setAttribute("transform", `rotate(${angle} 100 100)`);
  }

  // 연료 호(arc) 색상 및 길이
  const arc = document.getElementById("fuel-arc");
  if (arc) {
    arc.setAttribute("stroke", pct <= FUEL_WARNING_THRESHOLD ? "#FF7A1A" : "#FFC857");
    const arcLen = 251.3;
    arc.setAttribute("stroke-dasharray", `${(pct / 100) * arcLen} ${arcLen}`);
  }

  // 연료 카드 위험 클래스
  const fuelCard = document.querySelector(".fuel-card");
  if (fuelCard) {
    fuelCard.classList.toggle("fuel-low", pct <= FUEL_WARNING_THRESHOLD);
  }

  // 경고 로그 (1회)
  if (pct <= FUEL_WARNING_THRESHOLD && !_lowFuelWarned) {
    _lowFuelWarned = true;
    _cb.addSystemLog("Warning : Low Fuel", "warning");
  }
  if (pct > FUEL_WARNING_THRESHOLD) _lowFuelWarned = false;
}

// ─────────────────────────────────────────────
// 공개 API
// ─────────────────────────────────────────────

export function drainFuel(amount, logMsg = null, logType = "normal") {
  if (GameState.status !== "playing") return;

  GameState.fuel.current -= amount;
  _clampFuel();
  _updateFuelUI();

  if (logMsg) _cb.addSystemLog(logMsg, logType);

  if (GameState.fuel.current <= 0) {
    _cb.triggerGameOver();
  }
}

export function addFuel(amount) {
  if (GameState.status !== "playing") return;

  GameState.fuel.current += amount;
  _clampFuel();
  _updateFuelUI();
  _cb.addSystemLog(`Fuel +${amount}`, "positive");
}

export function resetFuelUI() {
  _lowFuelWarned = false;
  _updateFuelUI();
}

// ─────────────────────────────────────────────
// 이벤트 훅 — 성화(물리)가 호출
// ─────────────────────────────────────────────

export function onBallLaunch() {
  drainFuel(FUEL_COSTS.ballLaunch);
}

export function onBallMiss() {
  drainFuel(FUEL_COSTS.ballMiss, "Energy Pulse Lost..", "warning");
}

// ─────────────────────────────────────────────
// 이벤트 훅 — 동규(아이템/스킬)가 호출
// ─────────────────────────────────────────────

export function onFuelItemPickup() {
  addFuel(FUEL_GAINS.fuelItem);
}

export function onDebrisPickup() {
  drainFuel(15, "Space Debris Impact!", "warning");
}

export function onSkillUse(skillName) {
  const costs = { slow: FUEL_COSTS.skillSlow, laser: FUEL_COSTS.skillLaser };
  drainFuel(costs[skillName] ?? 10);
}
