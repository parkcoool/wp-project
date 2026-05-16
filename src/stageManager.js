/**
 * @module stageManager
 * @description 스테이지 초기화, 벽돌 배치, 게임 흐름(오버/클리어), 시스템 로그, 점수 UI를 담당.
 */

import { GameState, STAGE_CONFIG, CANVAS_LAYOUT } from "./state.js";
import {
  resetFuelUI,
  registerFuelCallbacks,
  onBallLaunch,
  onBallMiss,
  addFuel,
  drainFuel,
  onFuelItemPickup,
  onDebrisPickup,
  onSkillUse,
} from "./fuelSystem.js";
import { showScreen } from "./screen.js";

// ─────────────────────────────────────────────
// 스테이지 초기화
// ─────────────────────────────────────────────

/**
 * 특정 스테이지를 초기화하고 인트로 화면을 표시.
 * @param {number} stageNum - 1 | 2 | 3
 */
export function initStage(stageNum) {
  const config = STAGE_CONFIG[stageNum];
  if (!config) return;

  // 연료 콜백 주입 (순환 참조 방지용)
  registerFuelCallbacks({ addSystemLog, triggerGameOver });

  // 상태 초기화
  GameState.status = "intro";
  GameState.currentStage = stageNum;
  GameState.score = 0;
  GameState.systemLog = [];
  GameState.fuel.max = config.maxFuel;
  GameState.fuel.current = config.startFuel;
  GameState.unlockedSkills = [...config.unlockedSkills];
  GameState.activeSkills = { slow: false, laser: false };
  GameState.balls = [];
  GameState.items = [];
  GameState.bricks = _generateBricks(stageNum);

  // 증식 타이머 정리
  _clearProliferateTimer();

  // 게임 화면으로 전환
  showScreen("game-screen");

  // 스테이지별 배경 클래스 교체
  const gameScreen = document.getElementById("game-screen");
  gameScreen.className = `screen game-screen active ${config.backgroundClass}`;

  // 좌측 패널 텍스트 업데이트
  _updateSidebarUI(stageNum);

  // 연료 게이지 초기화
  resetFuelUI();

  // 점수 초기화
  _updateScoreUI();

  // 시스템 로그 초기화
  const logList = document.querySelector(".system-log-list");
  if (logList) logList.innerHTML = "";

  // 스킬 패널 업데이트
  _updateSkillsUI(stageNum);

  // 인트로 오버레이 표시
  _showIntroOverlay(stageNum);
}

// ─────────────────────────────────────────────
// 벽돌 생성
// ─────────────────────────────────────────────

/**
 * 스테이지 설정에 따라 bricks 배열을 생성.
 * @param {number} stageNum
 * @returns {Array}
 */
function _generateBricks(stageNum) {
  const config = STAGE_CONFIG[stageNum];
  const { brickOffsetX, brickOffsetY, brickAreaWidth, brickHeight, brickGapX, brickGapY } =
    CANVAS_LAYOUT;
  const { rows, cols, rowHp } = config;

  const brickW = (brickAreaWidth - brickGapX * (cols - 1)) / cols; // ≈ 56.4px

  const bricks = [];
  for (let row = 0; row < rows; row++) {
    const hp = rowHp[row] ?? 1;
    const type = hp >= 3 ? "armored" : hp === 2 ? "tough" : "normal";

    for (let col = 0; col < cols; col++) {
      bricks.push({
        row,
        col,
        x: brickOffsetX + col * (brickW + brickGapX),
        y: brickOffsetY + row * (brickHeight + brickGapY),
        w: brickW,
        h: brickHeight,
        hp,
        maxHp: hp,
        type,
        alive: true,
      });
    }
  }
  return bricks;
}

// ─────────────────────────────────────────────
// 별돌 피격/파괴
// ─────────────────────────────────────────────

/**
 * 공이 벽돌에 맞았을 때 물리 레이어에서 호출.
 * @param {number} brickIndex - GameState.bricks 배열 인덱스
 * @returns {boolean} 벽돌이 파괴되었으면 true
 */
export function onBrickHit(brickIndex) {
  const brick = GameState.bricks[brickIndex];
  if (!brick || !brick.alive) return false;

  brick.hp -= 1;
  addSystemLog("Astrophage Hit!", "normal");

  if (brick.hp <= 0) {
    brick.alive = false;
    GameState.score += _getScoreForBrick(brick);
    _updateScoreUI();
    addSystemLog("Astrophage Destroyed!", "positive");

    // 아이템 드롭 (외부 등록 콜백)
    if (typeof window.onBrickDestroyed === "function") {
      window.onBrickDestroyed(brick);
    }

    _checkStageClear();
    return true;
  }
  return false;
}

/**
 * 벽돌 타입과 스테이지에 따라 파괴 점수를 계산.
 * @param {{ type: string }} brick
 * @returns {number}
 */
function _getScoreForBrick(brick) {
  const base = { normal: 10, tough: 20, armored: 30 };
  return (base[brick.type] ?? 10) * GameState.currentStage;
}

// ─────────────────────────────────────────────
// 스테이지 클리어 / 게임 오버
// ─────────────────────────────────────────────

/**
 * 살아있는 벽돌이 없으면 스테이지 또는 미션 클리어를 판정.
 */
function _checkStageClear() {
  const aliveCount = GameState.bricks.filter((b) => b.alive).length;
  if (aliveCount > 0) return;

  _clearProliferateTimer();

  if (GameState.currentStage < 3) {
    GameState.status = "stageclear";
    addSystemLog("Stage Clear!", "positive");
    _showOverlay("stage-clear-overlay");
  } else {
    GameState.status = "clear";
    addSystemLog("Mission Complete! Earth is saved.", "positive");
    _showOverlay("mission-clear-overlay");
  }
}

/**
 * 게임 오버를 트리거. 연료 고갈 시 fuelSystem에서 호출.
 */
export function triggerGameOver() {
  if (GameState.status === "gameover") return;
  GameState.status = "gameover";
  _clearProliferateTimer();
  addSystemLog("Mission Failed..", "danger");
  _showOverlay("game-over-overlay");
}

// ─────────────────────────────────────────────
// 스테이지 3 증식 기믹
// ─────────────────────────────────────────────

/**
 * 스테이지 설정에 증식(proliferate)가 활성화된 경우 증식 타이머를 시작.
 */
function _startProliferateTimer() {
  const config = STAGE_CONFIG[GameState.currentStage];
  if (!config.proliferate) return;

  GameState._proliferateTimer = setInterval(_proliferateAstrophage, config.proliferateInterval);
}

/**
 * 증식 타이머를 정리.
 */
function _clearProliferateTimer() {
  if (GameState._proliferateTimer) {
    clearInterval(GameState._proliferateTimer);
    GameState._proliferateTimer = null;
  }
}

/**
 * 파괴된 벽돌 중 1~2개를 무작위로 부활시켜 아스트로파지 증식을 구현.
 */
function _proliferateAstrophage() {
  if (GameState.status !== "playing") return;

  const config = STAGE_CONFIG[GameState.currentStage];
  const deadBricks = GameState.bricks.filter((b) => !b.alive);
  const aliveCount = GameState.bricks.filter((b) => b.alive).length;

  if (deadBricks.length === 0 || aliveCount >= config.maxAliveBricks) return;

  // 1~2개 랜덤 부활
  const reviveCount = Math.min(Math.floor(Math.random() * 2) + 1, deadBricks.length);

  for (let i = 0; i < reviveCount; i++) {
    const idx = Math.floor(Math.random() * deadBricks.length);
    const brick = deadBricks.splice(idx, 1)[0];
    brick.hp = 1;
    brick.maxHp = 1;
    brick.type = "normal";
    brick.alive = true;
    addSystemLog("Astrophage Proliferating!", "warning");
  }
}

// ─────────────────────────────────────────────
// 게임 시작 (인트로 → playing)
// ─────────────────────────────────────────────

/**
 * 인트로 오버레이에서 "임무 시작" 버튼 클릭 시 호출. 게임 상태를 playing으로 전환.
 */
export function startPlaying() {
  GameState.status = "playing";
  _hideOverlay("stage-intro-overlay");

  // 스테이지 3 증식 타이머 시작
  _startProliferateTimer();

  addSystemLog("Mission Start", "normal");

  // 게임 루프 시작 (외부 등록 콜백)
  if (typeof window.startGameLoop === "function") {
    window.startGameLoop();
  }
}

// ─────────────────────────────────────────────
// 다음 스테이지 진행
// ─────────────────────────────────────────────

/**
 * 현재 스테이지의 다음 스테이지를 초기화. 스테이지 3 이후에는 아무 동작 없음.
 */
export function goToNextStage() {
  const next = GameState.currentStage + 1;
  if (next > 3) return;
  initStage(next);
}

// ─────────────────────────────────────────────
// 시스템 로그
// ─────────────────────────────────────────────

/**
 * 시스템 로그에 메시지 추가.
 * @param {string} message
 * @param {'normal'|'warning'|'danger'|'positive'} type
 */
export function addSystemLog(message, type = "normal") {
  const entry = { message, type, time: Date.now() };
  GameState.systemLog.push(entry);

  const logList = document.querySelector(".system-log-list");
  if (!logList) return;

  const p = document.createElement("p");
  p.className = `log-entry log-${type}`;
  p.textContent = `> ${message}`;
  logList.appendChild(p);

  // 최대 50줄 유지
  while (logList.children.length > 50) {
    logList.removeChild(logList.firstChild);
  }
  logList.scrollTop = logList.scrollHeight;
}

// ─────────────────────────────────────────────
// UI 업데이트 헬퍼
// ─────────────────────────────────────────────

/**
 * 현재 점수를 7자리 0-패딩 형식으로 UI에 갱신.
 */
function _updateScoreUI() {
  const el = document.querySelector(".score-value");
  if (el) el.textContent = String(GameState.score).padStart(7, "0");
}

/**
 * 좌측 사이드바의 스테이지 번호·이름을 갱신.
 * @param {number} stageNum
 */
function _updateSidebarUI(stageNum) {
  const config = STAGE_CONFIG[stageNum];
  const numEl = document.querySelector(".game-stage-number");
  const nameEl = document.querySelector(".game-stage-name");
  if (numEl) numEl.textContent = `STAGE 0${stageNum}`;
  if (nameEl) nameEl.textContent = config.name;
}

/**
 * 스킬 패널을 해당 스테이지의 해금 스킬로 갱신.
 * @param {number} stageNum
 */
function _updateSkillsUI(stageNum) {
  const config = STAGE_CONFIG[stageNum];
  const skillsContainer = document.querySelector(".skills-list");
  if (!skillsContainer) return;

  skillsContainer.innerHTML = "";

  const skillMeta = {
    slow: { label: "슬로우", key: "[S]", color: "#59C3FF" },
    laser: { label: "레이저", key: "[D]", color: "#FF7A1A" },
  };

  if (config.unlockedSkills.length === 0) {
    skillsContainer.innerHTML = '<p class="no-skill-text">해금된 스킬 없음</p>';
    return;
  }

  config.unlockedSkills.forEach((skillId) => {
    const meta = skillMeta[skillId];
    if (!meta) return;
    const item = document.createElement("div");
    item.className = "skill-item";
    item.innerHTML = `
      <div class="skill-icon-ring">
        <span class="skill-key" style="color:${meta.color}">${meta.key}</span>
      </div>
      <p class="skill-label">${meta.label}</p>
    `;
    skillsContainer.appendChild(item);
  });
}

/**
 * 스테이지 인트로 오버레이를 텍스트와 함께 표시.
 * @param {number} stageNum
 */
function _showIntroOverlay(stageNum) {
  const config = STAGE_CONFIG[stageNum];
  const overlay = document.getElementById("stage-intro-overlay");
  if (!overlay) return;

  overlay.querySelector(".intro-stage-label").textContent = `STAGE 0${stageNum}`;
  overlay.querySelector(".intro-text").textContent = config.introText;

  const skillLine = overlay.querySelector(".intro-skill-unlock");
  if (skillLine) {
    skillLine.textContent = config.skillUnlockText ?? "";
    skillLine.style.display = config.skillUnlockText ? "block" : "none";
  }

  overlay.classList.add("active");
}

/**
 * 지정한 오버레이를 표시.
 * @param {string} id - 오버레이 요소의 id
 */
function _showOverlay(id) {
  document.getElementById(id)?.classList.add("active");
}

/**
 * 지정한 오버레이를 숨김.
 * @param {string} id - 오버레이 요소의 id
 */
function _hideOverlay(id) {
  document.getElementById(id)?.classList.remove("active");
}

// ─────────────────────────────────────────────
// 전역 API
// ─────────────────────────────────────────────

/**
 * ES 모듈 import 없이 접근할 수 있는 전역 게임 API.
 * ES 모듈로 직접 import하는 방식을 권장.
 */
window.gameAPI = {
  getState: () => GameState,
  getBricks: () => GameState.bricks,
  onBrickHit,
  triggerGameOver,
  addSystemLog,
  onBallLaunch,
  onBallMiss,
  addFuel,
  drainFuel,
  onFuelItemPickup,
  onDebrisPickup,
  onSkillUse,
};
