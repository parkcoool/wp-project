/**
 * @module fuelSystem
 * @description 연료의 증가·감소·UI 갱신을 중앙에서 관리.
 *   stageManager와의 순환 참조를 막기 위해 콜백 주입(registerFuelCallbacks) 패턴을 사용.
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
 * stageManager가 스테이지 초기화 시 호출하는 콜백 주입 함수.
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

/**
 * 연료를 [0, max] 범위로 제한.
 */
function _clampFuel() {
  GameState.fuel.current = Math.max(0, Math.min(GameState.fuel.max, GameState.fuel.current));
}

/**
 * 연료 퍼센트를 계산하고 게이지 SVG 및 텍스트 UI를 갱신.
 */
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

/**
 * 연료를 감소시키고, 고갈 시 게임 오버를 트리거.
 * @param {number} amount - 감소량 (양수)
 * @param {string|null} [logMsg] - 시스템 로그 메시지
 * @param {'normal'|'warning'|'danger'|'positive'} [logType]
 */
export function drainFuel(amount, logMsg = null, logType = "normal") {
  if (GameState.status !== "playing") return;

  GameState.fuel.current -= amount;
  _clampFuel();
  _updateFuelUI();

  if (logMsg) _cb.addSystemLog(logMsg, logType);

  if (GameState.fuel.current <= 0) {
    if (GameState.lives > 1) {
      GameState.lives -= 1;
      GameState.fuel.current = Math.max(10, Math.floor(GameState.fuel.max * 0.3));
      _clampFuel();
      _updateFuelUI();
      _cb.addSystemLog("Loki Shield Activated : Extra Life Used", "positive");
      return;
    }

    _cb.triggerGameOver();
  }
}

/**
 * 연료를 충전.
 * @param {number} amount - 충전량 (양수)
 */
export function addFuel(amount) {
  if (GameState.status !== "playing") return;

  GameState.fuel.current += amount;
  _clampFuel();
  _updateFuelUI();
  _cb.addSystemLog(`Fuel +${amount}`, "positive");

  const overchargeThreshold = Math.ceil(GameState.fuel.max * 0.9);
  if (
    GameState.currentStage >= 2 &&
    GameState.paddle.hasXenonite &&
    !GameState.fuel.isOverchargeShieldActive &&
    !GameState.fuel.shieldUsedThisStage &&
    GameState.fuel.current >= overchargeThreshold
  ) {
    GameState.fuel.isOverchargeShieldActive = true;
    _cb.addSystemLog("Aux Shield Ready!", "positive");
  }
}

/**
 * 연료 경고 플래그를 초기화하고 UI를 현재 상태로 강제 갱신.
 * 스테이지 초기화 시 호출.
 */
export function resetFuelUI() {
  _lowFuelWarned = false;
  _updateFuelUI();
}

// ─────────────────────────────────────────────
// 이벤트 훅 — 물리 레이어
// ─────────────────────────────────────────────

/**
 * 공 발사 시 물리 레이어에서 호출.
 */
export function onBallLaunch() {
  drainFuel(FUEL_COSTS.ballLaunch);
}

/**
 * 공을 놓쳤을 때 물리 레이어에서 호출.
 */
export function onBallMiss() {
  if (GameState.fuel.isOverchargeShieldActive) {
    GameState.fuel.isOverchargeShieldActive = false;
    GameState.fuel.shieldUsedThisStage = true;
    _cb.addSystemLog("Aux Shield Absorbed the hit!", "positive");
    return;
  }

  drainFuel(FUEL_COSTS.ballMiss, "Energy Pulse Lost..", "warning");
}

// ─────────────────────────────────────────────
// 이벤트 훅 — 아이템/스킬 레이어
// ─────────────────────────────────────────────

/**
 * 연료 아이템 획득 시 아이템 레이어에서 호출.
 */
export function onFuelItemPickup() {
  addFuel(FUEL_GAINS.fuelItem);
}

/**
 * 우주 쓰레기 획득 시 아이템 레이어에서 호출.
 */
export function onDebrisPickup() {
  drainFuel(15, "Space Debris Impact!", "warning");
}

/**
 * 스킬 사용 시 스킬 레이어에서 호출.
 * @param {'slow'|'laser'} skillName - 사용할 스킬 이름
 */
export function onSkillUse(skillName) {
  const costs = { slow: FUEL_COSTS.skillSlow, laser: FUEL_COSTS.skillLaser };
  drainFuel(costs[skillName] ?? 10);
}
