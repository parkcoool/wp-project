/**
 * @module state
 * @description 전역 게임 상태, 설정 상수, 레이아웃 상수를 한 곳에서 관리하는 단일 진실의 원천.
 */

// ─────────────────────────────────────────────
// 스테이지별 설정값
// ─────────────────────────────────────────────
export const STAGE_CONFIG = {
  1: {
    name: "태양이 죽어가고 있다",
    rows: 5,
    cols: 10,
    maxFuel: 100,
    startFuel: 100,
    unlockedSkills: [],
    // 벽돌 HP 배분: [row 0..4] → 각 행의 HP
    rowHp: [1, 1, 1, 1, 1],
    proliferate: false,
    proliferateInterval: null,
    maxAliveBricks: 50,
    backgroundClass: "bg-stage01",
    introText:
      '"태양의 빛이 점점 약해지고 있습니다.\n원인은 태양 에너지를 흡수하며 증식하는 미생물, 아스트로파지.\n\n이대로라면 지구는 긴 겨울과 식량 부족 속에서 멸망하게 됩니다.\n인류는 마지막 희망을 걸고 헤일메리호를 출격시켰습니다.\n\n당신의 첫 임무는 태양 주변에 퍼진 아스트로파지를 제거하고\n사라져가는 태양의 빛을 되찾는 것입니다."',
    skillUnlockText: null,
    ballName: "에너지 펄스",
  },
  2: {
    name: "타우 세티로, 로키와 함께",
    rows: 6,
    cols: 10,
    maxFuel: 80,
    startFuel: 80,
    unlockedSkills: ["slow"],
    rowHp: [1, 1, 1, 1, 2, 2],
    proliferate: false,
    proliferateInterval: null,
    maxAliveBricks: 60,
    backgroundClass: "bg-stage02",
    introText:
      "\"태양이 죽어가는 원인을 조사하던 인류는 유일하게 이상 현상이 발견되지 않은 항성계, 타우 세티를 발견합니다. 헤일메리호는 인류 생존의 단서를 찾기 위해 머나먼 타우 세티로 향하게 됩니다.\n\n긴 항해 끝에 당신은 외계 생명체 '로키'와 조우하고, 아스트로파지에 맞서기 위한 새로운 기술과 지원을 얻게 됩니다. 하지만 목적지까지의 우주는 결코 안전하지 않습니다. 미지의 위험을 돌파하며 인류의 희망을 이어가세요.\"",
    skillUnlockText: "슬로우 스킬이 해금됐다. [S]키로 사용.",
    ballName: "에너지 펄스",
  },
  3: {
    name: "아스트로파지 파괴",
    rows: 5,
    cols: 10,
    maxFuel: 60,
    startFuel: 60,
    unlockedSkills: ["slow", "laser"],
    rowHp: [3, 3, 2, 2, 2],
    proliferate: true,
    proliferateInterval: 15000, // 15초마다 증식
    maxAliveBricks: 40,
    backgroundClass: "bg-stage03",
    introText:
      '"긴 항해 끝에 헤일메리호는 아스트로파지가 대량 증식하고 있는 중심 구역에 도달합니다. 이곳을 파괴하지 못한다면 태양은 끝내 빛을 잃고 인류 역시 멸망하게 됩니다.\n\n당신은 타우메바를 이용해 증식하는 아스트로파지를 제거하고 헤일메리 프로젝트의 마지막 임무를 완수해야 합니다."',
    skillUnlockText: "레이저 스킬이 해금됐다. [R]키로 사용.",
    ballName: "타우메바",
  },
};

// ─────────────────────────────────────────────
// 연료 관련 상수
// ─────────────────────────────────────────────
export const FUEL_COSTS = {
  ballLaunch: 5, // 공 발사 시 감소
  ballMiss: 30, // 공 놓칠 시 대폭 감소
  skillSlow: 15, // 슬로우 스킬 사용
  skillLaser: 20, // 레이저 스킬 사용
};

export const FUEL_GAINS = {
  fuelItem: 20, // 연료 아이템 획득
};

// 연료 경고 임계치 (%)
export const FUEL_WARNING_THRESHOLD = 25;

// ─────────────────────────────────────────────
// 캔버스 레이아웃 상수
// ─────────────────────────────────────────────
export const CANVAS_LAYOUT = {
  brickOffsetX: 51, // 벽돌 그리드 시작 X (캔버스 내부 기준)
  brickOffsetY: 79, // 벽돌 그리드 시작 Y
  brickAreaWidth: 600, // 벽돌 전체 영역 너비
  brickHeight: 43, // 벽돌 한 개 높이
  brickGapX: 4, // 벽돌 간 X 간격
  brickGapY: 4, // 벽돌 간 Y 간격
  brickRadius: 8, // 벽돌 모서리 둥글기 (px)
};

// ─────────────────────────────────────────────
// 전역 게임 상태 (런타임 중 변경되는 값)
// ─────────────────────────────────────────────
export const GameState = {
  // 게임 흐름
  status: "idle", // 'idle' | 'intro' | 'playing' | 'paused' | 'gameover' | 'stageclear' | 'clear'
  currentStage: 1,
  score: 0,
  systemLog: [],

  // 연료
  fuel: {
    current: 100,
    max: 100,
  },

  /**
   * @type {Array<{
   *   row: number, col: number,
   *   x: number, y: number, w: number, h: number,
   *   hp: number, maxHp: number,
   *   type: 'normal'|'tough'|'armored',
   *   alive: boolean
   * }>}
   */
  bricks: [],

  /** @type {Array<{x: number, y: number, vx: number, vy: number, r: number}>} */
  balls: [],

  /** @type {{x: number, y: number, w: number, h: number}} */
  paddle: { x: 0, y: 0, w: 160, h: 107 },

  /** @type {Array<{x: number, y: number, vy: number, type: 'fuel'|'debris', alive: boolean}>} */
  items: [],

  // 해금된 스킬 목록
  unlockedSkills: [],

  // 스킬 활성 상태
  activeSkills: {
    slow: false,
    laser: false,
  },

  // 증식 타이머 핸들 (내부용)
  _proliferateTimer: null,
};
