import { GameState, STAGE_CONFIG, CANVAS_LAYOUT } from './state.js';
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
} from './fuelSystem.js';
import { showScreen } from './screen.js';
import { playSoundEffect } from './audio.js';

export const initStage = (stageNum) => {
  const config = STAGE_CONFIG[stageNum];
  if (!config) return;

  // 연료 콜백 주입
  registerFuelCallbacks({ addSystemLog, triggerGameOver });

  // 상태 초기화
  GameState.status = 'intro';
  GameState.currentStage = stageNum;
  GameState.score = 0;
  GameState.systemLog = [];
  GameState.fuel.max = config.maxFuel;
  GameState.fuel.current = config.startFuel;
  GameState.fuel.isOverchargeShieldActive = false;
  GameState.fuel.shieldUsedThisStage = false;
  GameState.lives = 3;
  GameState.hasResonanceTriggered = false;
  GameState.paddle.widthBoost = 1;
  GameState.paddle.hasXenonite = false;
  GameState.unlockedSkills = [...config.unlockedSkills];
  GameState.activeSkills = { slow: false, laser: false, laserStartTime: 0 };
  GameState.balls = [];
  GameState.items = [];

  // 증식 타이머 정리
  _clearProliferateTimer();

  // 게임 화면으로 전환
  showScreen('game-screen');
  window.resizeCanvas?.(); //resize 전에는 게임 화면이 display:none이므로 캔버스 크기가 0이었음. 강제 resize로 초기화.
  GameState.bricks = _generateBricks(stageNum); //캔버스 크기를 확정한 후 벽돌 생성하도록 수정(canvas.width가 0이어서 벽돌 너비가 이상하게 계산되는 문제 해결)

  // 스테이지별 배경 클래스 교체
  const gameScreen = document.getElementById('game-screen');
  gameScreen.className = `screen game-screen active ${config.backgroundClass}`;

  // 좌측 패널 텍스트 업데이트
  _updateSidebarUI(stageNum);

  // 연료 게이지 초기화
  resetFuelUI();

  // 버프 화면 이펙트 초기화
  const _multiballEl = document.getElementById('multiball-screen-effect');
  if (_multiballEl) _multiballEl.classList.remove('flash');

  // 점수 초기화
  _updateScoreUI();

  // 시스템 로그 초기화
  const logList = document.querySelector('.system-log-list');
  if (logList) logList.innerHTML = '';

  // 스킬 패널 업데이트
  _updateSkillsUI(stageNum);

  // 인트로 오버레이 표시
  _showIntroOverlay(stageNum);
};

const _generateBricks = (stageNum) => {
  const config = STAGE_CONFIG[stageNum];
  const { brickOffsetX, brickOffsetY, brickHeight, brickGapX, brickGapY } =
    CANVAS_LAYOUT;
  const { rows, cols, rowHp } = config;

  const canvas = document.getElementById('game-canvas');
  const brickAreaWidth = canvas.width - brickOffsetX * 2; //하드 코딩되었던 brickAreaWidth를 캔버스 크기에 맞게 동적으로 계산하도록 수정

  const brickW = (brickAreaWidth - brickGapX * (cols - 1)) / cols; // ≈ 56.4px

  const bricks = [];
  for (let row = 0; row < rows; row++) {
    const hp = rowHp[row] ?? 1;
    const type = hp >= 3 ? 'armored' : hp === 2 ? 'tough' : 'normal';

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
};

export const onBrickHit = (brickIndex) => {
  const brick = GameState.bricks[brickIndex];
  if (!brick || !brick.alive) return false;

  brick.hp -= 1;
  addSystemLog('Astrophage Hit!', 'normal');

  if (brick.hp <= 0) {
    playSoundEffect('crashAstrophage');
    brick.alive = false;
    GameState.score += _getScoreForBrick(brick);
    _updateScoreUI();
    addSystemLog('Astrophage Destroyed!', 'positive');

    if (
      GameState.currentStage >= 2 &&
      !GameState.paddle.hasXenonite &&
      (brick.type === 'tough' || brick.type === 'armored')
    ) {
      GameState.paddle.widthBoost = 1.4;
      GameState.paddle.w *= GameState.paddle.widthBoost;
      GameState.paddle.h *= GameState.paddle.widthBoost;
      GameState.paddle.hasXenonite = true;
      addSystemLog('Xenonite Buff Activation', 'positive');
    }

    // 아이템 드롭 (외부 등록 콜백)
    if (typeof window.onBrickDestroyed === 'function') {
      window.onBrickDestroyed(brick);
    }

    _checkStageClear();
    return true;
  }
  playSoundEffect('hitAstrophage');
  return false;
};

const _getScoreForBrick = (brick) => {
  const base = { normal: 10, tough: 20, armored: 30 };
  return (base[brick.type] ?? 10) * GameState.currentStage;
};

const _checkStageClear = () => {
  const aliveCount = GameState.bricks.filter((b) => b.alive).length;
  if (aliveCount > 0) return;

  _clearProliferateTimer();

  if (GameState.currentStage < 3) {
    GameState.status = 'stageclear';
    addSystemLog('Stage Clear!', 'positive');
    _showOverlay('stage-clear-overlay');
  } else {
    GameState.status = 'clear';
    addSystemLog('Mission Complete! Earth is saved.', 'positive');
    _showOverlay('mission-clear-overlay');
  }
};

export const triggerGameOver = () => {
  if (GameState.status === 'gameover') return;
  GameState.status = 'gameover';
  _clearProliferateTimer();
  addSystemLog('Mission Failed..', 'danger');
  _showOverlay('game-over-overlay');
};

const _startProliferateTimer = () => {
  const config = STAGE_CONFIG[GameState.currentStage];
  if (!config.proliferate) return;

  GameState._proliferateTimer = setInterval(
    _proliferateAstrophage,
    config.proliferateInterval,
  );
};

const _clearProliferateTimer = () => {
  if (GameState._proliferateTimer) {
    clearInterval(GameState._proliferateTimer);
    GameState._proliferateTimer = null;
  }
};

// 파괴된 벽돌 1~2개를 랜덤으로 부활시킴
const _proliferateAstrophage = () => {
  if (GameState.status !== 'playing') return;

  const config = STAGE_CONFIG[GameState.currentStage];
  const deadBricks = GameState.bricks.filter((b) => !b.alive);
  const aliveCount = GameState.bricks.filter((b) => b.alive).length;

  if (deadBricks.length === 0 || aliveCount >= config.maxAliveBricks) return;

  const reviveCount = Math.min(
    Math.floor(Math.random() * 2) + 1,
    deadBricks.length,
  );

  for (let i = 0; i < reviveCount; i++) {
    const idx = Math.floor(Math.random() * deadBricks.length);
    const brick = deadBricks.splice(idx, 1)[0];
    brick.hp = 1;
    brick.maxHp = 1;
    brick.type = 'normal';
    brick.alive = true;
    addSystemLog('Astrophage Proliferating!', 'warning');
  }
};

export const startPlaying = () => {
  GameState.status = 'playing';

  _hideOverlay('stage-intro-overlay');
  _hideOverlay('pause-overlay');

  _startProliferateTimer();

  addSystemLog('Mission Start', 'normal');

  if (typeof window.startGameLoop === 'function') {
    window.startGameLoop();
  }
};

export const pauseGame = () => {
  if (GameState.status !== 'playing') return;

  GameState.status = 'paused';
  _showOverlay('pause-overlay');
};

export const resumeGame = () => {
  if (GameState.status !== 'paused') return;

  GameState.status = 'playing';
  _hideOverlay('pause-overlay');
};

export const exitGameToMenu = () => {
  GameState.status = 'idle';
  _clearProliferateTimer();
  _hideOverlay('pause-overlay');
  _hideOverlay('stage-intro-overlay');
  _hideOverlay('game-over-overlay');
  _hideOverlay('stage-clear-overlay');
  _hideOverlay('mission-clear-overlay');
  showScreen('menu-screen');
};

export const goToNextStage = () => {
  const next = GameState.currentStage + 1;
  if (next > 3) return;
  initStage(next);
};

export const addSystemLog = (message, type = 'normal') => {
  const entry = { message, type, time: Date.now() };
  GameState.systemLog.push(entry);

  const logList = document.querySelector('.system-log-list');
  if (!logList) return;

  const p = document.createElement('p');
  p.className = `log-entry log-${type}`;
  p.textContent = `> ${message}`;
  logList.appendChild(p);

  // 최대 50줄 유지
  while (logList.children.length > 50) {
    logList.removeChild(logList.firstChild);
  }
  logList.scrollTop = logList.scrollHeight;
};

const _updateScoreUI = () => {
  const el = document.querySelector('.score-value');
  if (el) el.textContent = String(GameState.score).padStart(7, '0');
};

const _updateSidebarUI = (stageNum) => {
  const config = STAGE_CONFIG[stageNum];
  const numEl = document.querySelector('.game-stage-number');
  const nameEl = document.querySelector('.game-stage-name');
  if (numEl) numEl.textContent = `STAGE 0${stageNum}`;
  if (nameEl) nameEl.textContent = config.name;
};

const _updateSkillsUI = (stageNum) => {
  const config = STAGE_CONFIG[stageNum];
  const skillsContainer = document.querySelector('.skills-list');
  if (!skillsContainer) return;

  skillsContainer.innerHTML = '';

  const skillMeta = {
    slow: {
      label: '슬로우',
      key: `[${GameState.skillKeys.slow ?? 'S'}]`,
      color: '#59C3FF',
    },
    laser: {
      label: '레이저',
      key: `[${GameState.skillKeys.laser ?? 'R'}]`,
      color: '#FF7A1A',
    },
  };

  if (config.unlockedSkills.length === 0) {
    skillsContainer.innerHTML = '<p class="no-skill-text">해금된 스킬 없음</p>';
    return;
  }

  config.unlockedSkills.forEach((skillId) => {
    const meta = skillMeta[skillId];
    if (!meta) return;
    const item = document.createElement('div');
    item.className = 'skill-item';
    item.innerHTML = `
      <div class="skill-icon-ring" id="skill-ring-${skillId}">
        <span class="skill-key" style="color:${meta.color}">${meta.key}</span>
      </div>
      <p class="skill-label">${meta.label}</p>
    `;
    skillsContainer.appendChild(item);
  });
};

document.addEventListener('skillkeyschange', () => {
  _updateSkillsUI(GameState.currentStage);
});

const _showIntroOverlay = (stageNum) => {
  const config = STAGE_CONFIG[stageNum];
  const overlay = document.getElementById('stage-intro-overlay');
  if (!overlay) return;

  overlay.querySelector('.intro-stage-label').textContent =
    `STAGE 0${stageNum}`;
  overlay.querySelector('.intro-text').textContent = config.introText;

  const skillLine = overlay.querySelector('.intro-skill-unlock');
  if (skillLine) {
    const skillUnlockText = (config.skillUnlockText ?? '')
      .replace('[S]', `[${GameState.skillKeys.slow ?? 'S'}]`)
      .replace('[R]', `[${GameState.skillKeys.laser ?? 'R'}]`);
    skillLine.textContent = skillUnlockText;
    skillLine.style.display = skillUnlockText ? 'block' : 'none';
  }

  overlay.classList.add('active');
};

const _showOverlay = (id) => {
  document.getElementById(id)?.classList.add('active');
};

const _hideOverlay = (id) => {
  document.getElementById(id)?.classList.remove('active');
};

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
  pauseGame,
  resumeGame,
  exitGameToMenu,
};
