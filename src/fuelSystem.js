// 연료 관련 로직 (stageManager랑 순환참조 문제로 콜백으로 분리)

import { GameState, FUEL_COSTS, FUEL_GAINS, FUEL_WARNING_THRESHOLD } from "./state.js";

const _cb = {
  addSystemLog: (_msg, _type) => {},
  triggerGameOver: () => {},
};

export function registerFuelCallbacks(callbacks) {
  if (callbacks.addSystemLog) _cb.addSystemLog = callbacks.addSystemLog;
  if (callbacks.triggerGameOver) _cb.triggerGameOver = callbacks.triggerGameOver;
}

let _lowFuelWarned = false;

const _clampFuel = () => {
  GameState.fuel.current = Math.max(0, Math.min(GameState.fuel.max, GameState.fuel.current));
};

const _updateFuelUI = () => {
  const pct =
    GameState.fuel.max > 0 ? Math.round((GameState.fuel.current / GameState.fuel.max) * 100) : 0;

  // 퍼센트 텍스트
  const textEl = document.querySelector(".fuel-percent-text");
  if (textEl) textEl.textContent = `${pct}% REMAINING`;

  // SVG 바늘 회전 (-90도: Empty, +90도: Full)
  const needle = document.getElementById("fuel-needle");
  if (needle) {
    const angle = -90 + (pct / 100) * 180;
    needle.setAttribute("transform", `rotate(${angle} 100 100)`);
  }

  // 연료 호 색상 및 길이
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
};

export const drainFuel = (amount, logMsg = null, logType = "normal") => {
  if (GameState.status !== "playing") return;

  GameState.fuel.current -= amount;
  _clampFuel();
  _updateFuelUI();

  if (logMsg) _cb.addSystemLog(logMsg, logType);

  if (GameState.fuel.current <= 0) {
    _cb.triggerGameOver();
  }
};

export const addFuel = (amount) => {
  if (GameState.status !== "playing") return;

  GameState.fuel.current += amount;
  _clampFuel();
  _updateFuelUI();
  _cb.addSystemLog(`Fuel +${amount}`, "positive");

  const overchargeThreshold = Math.ceil(GameState.fuel.max * 0.8);
  if (
    GameState.currentStage >= 2 &&
    GameState.paddle.hasXenonite &&
    !GameState.fuel.isOverchargeShieldActive &&
    !GameState.fuel.shieldUsedThisStage &&
    GameState.fuel.current >= overchargeThreshold
  ) {
    GameState.fuel.isOverchargeShieldActive = true;
    _cb.addSystemLog("Rocky Shield Ready!", "positive");
    const _shieldEl = document.getElementById("shield-screen-effect");
    if (_shieldEl) {
      _shieldEl.classList.remove("absorbed");
      _shieldEl.classList.add("active");
    }
  }
};

export const resetFuelUI = () => {
  _lowFuelWarned = false;
  _updateFuelUI();
  const _shieldEl = document.getElementById("shield-screen-effect");
  if (_shieldEl) _shieldEl.classList.remove("active", "absorbed");
};

export const onBallLaunch = () => {
  drainFuel(FUEL_COSTS.ballLaunch);
};

export const onBallMiss = () => {
  if (GameState.fuel.isOverchargeShieldActive) {
    GameState.fuel.isOverchargeShieldActive = false;
    GameState.fuel.shieldUsedThisStage = true;
    _cb.addSystemLog("Rocky Shield Absorbed the hit!", "positive");
    const _shieldEl = document.getElementById("shield-screen-effect");
    if (_shieldEl) {
      _shieldEl.classList.remove("active", "absorbed");
      void _shieldEl.offsetWidth;
      _shieldEl.classList.add("absorbed");
      setTimeout(() => _shieldEl.classList.remove("absorbed"), 500);
    }
    return;
  }

  drainFuel(FUEL_COSTS.ballMiss, "Energy Pulse Lost..", "warning");
};

export const onFuelItemPickup = () => {
  addFuel(FUEL_GAINS.fuelItem);
};

export const onDebrisPickup = () => {
  drainFuel(15, "Space Debris Impact!", "warning");
};

export const onSkillUse = (skillName) => {
  const costs = { slow: FUEL_COSTS.skillSlow, laser: FUEL_COSTS.skillLaser };
  drainFuel(costs[skillName] ?? 10);
};
