import { APPEARANCE_PRESETS, GameState, CANVAS_LAYOUT } from "./state.js";
import { onBrickHit, addSystemLog } from "./stageManager.js";
import { onBallLaunch, onBallMiss } from "./fuelSystem.js";
import { playSoundEffect } from "./audio.js";
import { updateItems, drawItems } from "./itemSkill.js";

let canvas;
let ctx;
let animationId = null;
let lastPointerX = null;
let brickShards = [];
let resonanceWaves = [];
let previousCanvasSize = { width: 0, height: 0 };
const BALL_RADIUS = 10;
const BRICK_SHARD_GRAVITY = 0.145;
const BRICK_SHARD_DRAG = 0.982;
const BRICK_SHARD_LIFE = 46;
const BRICK_DUST_DRAG = 0.94;
const BRICK_SPARK_DRAG = 0.965;
const MAX_BRICK_SHARDS = 200;
const BRICK_TYPE_STYLES = {
  normal: {
    alpha: 0.9,
    lightness: 0,
  },
  tough: {
    alpha: 0.92,
    lightness: 0,
  },
  armored: {
    alpha: 0.94,
    lightness: 0,
  },
};
const paddleImage = new Image();
paddleImage.src = new URL("../assets/images/sprites/hail-mary.png", import.meta.url).href;

const paddleImageXenonite = new Image();
paddleImageXenonite.src = new URL(
  "../assets/images/sprites/hail-mary_xenonite.png",
  import.meta.url,
).href;

function drawRoundedRect(ctx, x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function getBrickStyle(brick) {
  const typeStyle = BRICK_TYPE_STYLES[brick.type] ?? BRICK_TYPE_STYLES.normal;
  const skin =
    APPEARANCE_PRESETS.bricks[GameState.appearance.brickSkin] ??
    APPEARANCE_PRESETS.bricks.astrophage;
  const damageRatio = brick.maxHp > 1 ? 1 - brick.hp / brick.maxHp : 0;
  const lightness = Math.round(80 * damageRatio);
  const alpha = Math.max(typeStyle.alpha - damageRatio * 0.06, 0.84);
  const [baseR, baseG, baseB] = skin.baseRgb;
  const [strokeR, strokeG, strokeB] = skin.strokeRgb;
  const [glowR, glowG, glowB] = skin.glowRgb;

  return {
    fill: `rgba(${baseR + lightness}, ${baseG + lightness}, ${baseB + lightness}, ${alpha})`,
    stroke: `rgba(${strokeR}, ${strokeG}, ${strokeB}, ${0.26 + damageRatio * 0.22})`,
    glow: `rgba(${glowR}, ${glowG}, ${glowB}, ${0.12 + damageRatio * 0.12})`,
  };
}

function getTransparentColor(hexColor) {
  const hex = hexColor.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, 0)`;
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function colorWithAlpha(color, alpha) {
  return color.replace(/rgba?\(([^)]+)\)/, (_, values) => {
    const parts = values.split(",").map((part) => part.trim());
    return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
  });
}

function createShardPoints(w, h, chip) {
  const inset = chip ? 0.12 : 0.18;
  const left = -w / 2;
  const right = w / 2;
  const top = -h / 2;
  const bottom = h / 2;

  return [
    { x: left + randomBetween(-w * 0.08, w * inset), y: top + randomBetween(-h * 0.08, h * inset) },
    { x: right - randomBetween(0, w * inset), y: top + randomBetween(-h * 0.12, h * 0.22) },
    { x: right + randomBetween(-w * 0.1, w * 0.08), y: bottom - randomBetween(0, h * inset) },
    {
      x: randomBetween(left + w * 0.2, right - w * 0.08),
      y: bottom + randomBetween(-h * 0.08, h * 0.12),
    },
    {
      x: left + randomBetween(-w * 0.08, w * 0.2),
      y: randomBetween(top + h * 0.25, bottom - h * 0.08),
    },
  ];
}

function createBrickShards(brick, style, impactX, impactY) {
  const cols = 5;
  const rows = 3;
  const shardW = brick.w / cols;
  const shardH = brick.h / rows;
  const centerX = brick.x + brick.w / 2;
  const centerY = brick.y + brick.h / 2;
  const impactAngle = Math.atan2(centerY - impactY, centerX - impactX);
  const highlight = colorWithAlpha(style.stroke, 0.62);
  const shadow = "rgba(6, 11, 22, 0.45)";

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (Math.random() < 0.16 && !(row === 1 && col === 2)) continue;
      if (brickShards.length >= MAX_BRICK_SHARDS) continue;

      const x = brick.x + col * shardW;
      const y = brick.y + row * shardH;
      const shardCenterX = x + shardW * randomBetween(0.35, 0.65);
      const shardCenterY = y + shardH * randomBetween(0.32, 0.68);
      const awayFromCenter = Math.atan2(shardCenterY - centerY, shardCenterX - centerX);
      const awayFromImpact = Math.atan2(shardCenterY - impactY, shardCenterX - impactX);
      const impactDistance = Math.hypot(shardCenterX - impactX, shardCenterY - impactY);
      const proximityBoost = clamp(1 - impactDistance / Math.max(brick.w, brick.h), 0, 1.2);
      const speed = randomBetween(1.4, 3.4) + proximityBoost * 2.2;
      const angle = awayFromCenter * 0.45 + awayFromImpact * 0.55 + randomBetween(-0.42, 0.42);
      const maxLife = BRICK_SHARD_LIFE + Math.floor(Math.random() * 16);
      const widthScale = randomBetween(0.72, 1.08);
      const heightScale = randomBetween(0.62, 1.04);

      brickShards.push({
        type: "chunk",
        x: shardCenterX,
        y: shardCenterY,
        w: Math.max(shardW * widthScale, 5),
        h: Math.max(shardH * heightScale, 5),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - randomBetween(0.4, 2.2),
        rotation: randomBetween(-0.75, 0.75),
        spin: randomBetween(-0.18, 0.18) + proximityBoost * randomBetween(-0.05, 0.05),
        life: maxLife,
        maxLife,
        points: createShardPoints(
          Math.max(shardW * widthScale, 5),
          Math.max(shardH * heightScale, 5),
          false,
        ),
        fill: style.fill,
        stroke: style.stroke,
        glow: style.glow,
        highlight,
        shadow,
      });
    }
  }

  for (let i = 0; i < 12 && brickShards.length < MAX_BRICK_SHARDS; i += 1) {
    const angle = impactAngle + Math.PI + randomBetween(-1.25, 1.25);
    const speed = randomBetween(2.6, 7.2);
    const size = randomBetween(2.2, 6.5);
    const maxLife = Math.floor(randomBetween(22, 42));

    brickShards.push({
      type: "chip",
      x: impactX + randomBetween(-brick.w * 0.12, brick.w * 0.12),
      y: impactY + randomBetween(-brick.h * 0.12, brick.h * 0.12),
      w: size * randomBetween(1.1, 1.9),
      h: size,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - randomBetween(0.8, 2.8),
      rotation: randomBetween(-Math.PI, Math.PI),
      spin: randomBetween(-0.42, 0.42),
      life: maxLife,
      maxLife,
      points: createShardPoints(size * randomBetween(1.1, 1.9), size, true),
      fill: colorWithAlpha(style.fill, 0.92),
      stroke: colorWithAlpha(style.stroke, 0.55),
      glow: style.glow,
      highlight,
      shadow,
    });
  }

  for (let i = 0; i < 14 && brickShards.length < MAX_BRICK_SHARDS; i += 1) {
    const angle = randomBetween(0, Math.PI * 2);
    const speed = randomBetween(0.7, 3.8);
    const maxLife = Math.floor(randomBetween(18, 34));

    brickShards.push({
      type: Math.random() < 0.28 ? "spark" : "dust",
      x: impactX + randomBetween(-brick.w * 0.18, brick.w * 0.18),
      y: impactY + randomBetween(-brick.h * 0.18, brick.h * 0.18),
      radius: randomBetween(0.9, 2.4),
      length: randomBetween(7, 16),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - randomBetween(0.1, 1.4),
      rotation: angle,
      spin: randomBetween(-0.06, 0.06),
      life: maxLife,
      maxLife,
      fill: Math.random() < 0.36 ? highlight : colorWithAlpha(style.fill, 0.72),
      stroke: highlight,
      glow: style.glow,
    });
  }
}

function updateBrickShards() {
  for (let i = brickShards.length - 1; i >= 0; i -= 1) {
    const shard = brickShards[i];
    shard.x += shard.vx;
    shard.y += shard.vy;
    const drag =
      shard.type === "dust"
        ? BRICK_DUST_DRAG
        : shard.type === "spark"
          ? BRICK_SPARK_DRAG
          : BRICK_SHARD_DRAG;
    const gravity = shard.type === "spark" ? BRICK_SHARD_GRAVITY * 0.42 : BRICK_SHARD_GRAVITY;
    shard.vx *= drag;
    shard.vy = shard.vy * drag + gravity;
    shard.rotation += shard.spin;
    shard.life -= 1;

    if (shard.life <= 0) {
      // swap-and-pop: O(1) 제거, splice O(n) 대비 성능 개선
      brickShards[i] = brickShards[brickShards.length - 1];
      brickShards.pop();
    }
  }
}

function drawBrickShards() {
  if (brickShards.length === 0) return;

  ctx.save();
  ctx.shadowBlur = 0;

  // dust — 원형, shadow 없음, transform 없음 (한 번에 배치 처리)
  for (let i = 0; i < brickShards.length; i += 1) {
    const shard = brickShards[i];
    if (shard.type !== "dust") continue;
    const alpha = shard.life / shard.maxLife;
    ctx.globalAlpha = alpha * 0.72;
    ctx.fillStyle = shard.fill;
    ctx.beginPath();
    ctx.arc(shard.x, shard.y, shard.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // spark — 선분, shadow 없음, setTransform 대신 수동 좌표 계산
  ctx.lineWidth = 1.2;
  for (let i = 0; i < brickShards.length; i += 1) {
    const shard = brickShards[i];
    if (shard.type !== "spark") continue;
    const alpha = shard.life / shard.maxLife;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = shard.stroke;
    const cos = Math.cos(shard.rotation);
    const sin = Math.sin(shard.rotation);
    ctx.beginPath();
    ctx.moveTo(shard.x + cos * (-shard.length * 0.42), shard.y + sin * (-shard.length * 0.42));
    ctx.lineTo(shard.x + cos * (shard.length * 0.58), shard.y + sin * (shard.length * 0.58));
    ctx.stroke();
  }

  // chunk / chip — 다각형, shadow 적용, setTransform으로 save/restore 대체
  for (let i = 0; i < brickShards.length; i += 1) {
    const shard = brickShards[i];
    if (shard.type !== "chunk" && shard.type !== "chip") continue;
    const alpha = shard.life / shard.maxLife;
    ctx.globalAlpha = alpha;
    ctx.shadowColor = shard.glow;
    ctx.shadowBlur = 7 * alpha;

    const cos = Math.cos(shard.rotation);
    const sin = Math.sin(shard.rotation);
    ctx.setTransform(cos, sin, -sin, cos, shard.x, shard.y);

    const pts = shard.points;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let j = 1; j < pts.length; j += 1) ctx.lineTo(pts[j].x, pts[j].y);
    ctx.closePath();
    ctx.fillStyle = shard.fill;
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = shard.stroke;
    ctx.lineWidth = shard.type === "chip" ? 0.8 : 1.1;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-shard.w * 0.28, -shard.h * 0.24);
    ctx.lineTo(shard.w * 0.18, -shard.h * 0.1);
    ctx.strokeStyle = shard.highlight;
    ctx.lineWidth = 0.8;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-shard.w * 0.32, shard.h * 0.2);
    ctx.lineTo(shard.w * 0.26, shard.h * 0.26);
    ctx.strokeStyle = shard.shadow;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.restore();
}

function drawBallTail(ball, style) {
  if (!ball.isLaunched) return;

  const angle = Math.atan2(ball.vy, ball.vx) + Math.PI;
  const tailLength = ball.r * 2.8;
  const tailWidth = ball.r * 0.7;
  const tailX = ball.x + Math.cos(angle) * tailLength;
  const tailY = ball.y + Math.sin(angle) * tailLength;
  const perpX = Math.cos(angle + Math.PI / 2) * tailWidth;
  const perpY = Math.sin(angle + Math.PI / 2) * tailWidth;
  const tailGradient = ctx.createLinearGradient(ball.x, ball.y, tailX, tailY);

  tailGradient.addColorStop(0, style.fill);
  tailGradient.addColorStop(1, getTransparentColor(style.fill));

  ctx.beginPath();
  ctx.moveTo(ball.x + perpX, ball.y + perpY);
  ctx.lineTo(tailX, tailY);
  ctx.lineTo(ball.x - perpX, ball.y - perpY);
  ctx.closePath();
  ctx.fillStyle = tailGradient;
  ctx.fill();
}

function drawBall(ball) {
  const style =
    APPEARANCE_PRESETS.balls[GameState.appearance.ballSkin] ??
    APPEARANCE_PRESETS.balls["pulse-energy"];

  ctx.save();
  ctx.shadowColor = style.glow;
  ctx.shadowBlur = style.shape === "singularity" ? 22 : 16;
  drawBallTail(ball, style);

  if (style.shape === "pulse") {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fillStyle = style.fill;
    ctx.fill();
    ctx.closePath();
    ctx.restore();
    return;
  }

  if (style.shape === "sun") {
    ctx.strokeStyle = style.glow;
    ctx.lineWidth = 2;
    for (let i = 0; i < 10; i += 1) {
      const angle = (Math.PI * 2 * i) / 10;
      ctx.beginPath();
      ctx.moveTo(
        ball.x + Math.cos(angle) * ball.r * 1.15,
        ball.y + Math.sin(angle) * ball.r * 1.15,
      );
      ctx.lineTo(
        ball.x + Math.cos(angle) * ball.r * 1.65,
        ball.y + Math.sin(angle) * ball.r * 1.65,
      );
      ctx.stroke();
    }
  }

  const gradient = ctx.createRadialGradient(
    ball.x - ball.r * 0.3,
    ball.y - ball.r * 0.35,
    ball.r * 0.1,
    ball.x,
    ball.y,
    ball.r,
  );
  gradient.addColorStop(0, style.core);
  gradient.addColorStop(style.shape === "singularity" ? 0.45 : 0.28, style.fill);
  gradient.addColorStop(1, style.glow);

  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();

  if (style.shape === "core" || style.shape === "singularity") {
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2;
    ctx.strokeStyle = style.core;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r * 1.35, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (style.shape === "singularity") {
    ctx.fillStyle = style.core;
    ctx.beginPath();
    ctx.arc(ball.x + ball.r * 0.2, ball.y - ball.r * 0.18, ball.r * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.closePath();
  ctx.restore();
}

// ── 분열 에너지 파동 ──
function triggerResonanceWave(x, y) {
  for (let i = 0; i < 3; i++) {
    resonanceWaves.push({
      x,
      y,
      r: 8 + i * 18,
      maxR: 160 + i * 25,
      speed: 3.5 + i * 0.8,
      alpha: 1,
    });
  }
}

function updateResonanceWaves() {
  for (let i = resonanceWaves.length - 1; i >= 0; i--) {
    const w = resonanceWaves[i];
    w.r += w.speed;
    w.alpha = Math.max(0, 1 - w.r / w.maxR);
    if (w.alpha <= 0) resonanceWaves.splice(i, 1);
  }
}

function drawResonanceWaves() {
  resonanceWaves.forEach((w) => {
    ctx.save();
    ctx.globalAlpha = w.alpha * 0.75;
    ctx.strokeStyle = "#9B5CFF";
    ctx.lineWidth = 2 * w.alpha + 0.5;
    ctx.shadowColor = "#9B5CFF";
    ctx.shadowBlur = 18 * w.alpha;
    ctx.beginPath();
    ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });
}

function getPaddleHeight() {
  const imageRatio = paddleImage.naturalWidth
    ? paddleImage.naturalHeight / paddleImage.naturalWidth
    : 2 / 3;
  return GameState.paddle.w * imageRatio;
}

function syncPaddleSize() {
  GameState.paddle.h = getPaddleHeight();
}

function syncPaddleWidth(canvasWidth = canvas?.width ?? 0) {
  GameState.paddle.w = clamp(canvasWidth * 0.18, 92, 160) * (GameState.paddle.widthBoost ?? 1);
  syncPaddleSize();
}

function getPaddleHitbox(paddle) {
  return {
    x: paddle.x,
    y: paddle.y + paddle.h * 0.36,
    w: paddle.w * 0.96,
    h: paddle.h * 0.28,
  };
}

function getAttachedBallY(paddle, ballRadius) {
  return getPaddleHitbox(paddle).y - ballRadius - 12;
}

function getPaddleSensitivityMultiplier() {
  const sensitivity = Number(GameState.controls?.paddleSensitivity ?? 1);
  const normalizedSensitivity = (Math.min(Math.max(sensitivity, 1), 100) - 1) / 99;
  return 1 + normalizedSensitivity * 2;
}

function createResonanceBalls(sourceBall) {
  triggerResonanceWave(sourceBall.x, sourceBall.y);
  const speed = Math.max(Math.hypot(sourceBall.vx, sourceBall.vy), 5);
  const baseAngle = Math.atan2(sourceBall.vy, sourceBall.vx);
  const spread = Math.PI / 9;

  return [spread, -spread].map((angleOffset) => ({
    x: sourceBall.x,
    y: sourceBall.y,
    vx: Math.cos(baseAngle + angleOffset) * speed,
    vy: Math.sin(baseAngle + angleOffset) * speed,
    r: sourceBall.r,
    isLaunched: true,
    combo: 0,
  }));
}

// 포인터(마우스/터치)로 패들을 조작합니다 (이전 키보드 입력 제거)

/**
 * 물리 엔진 초기화 및 이벤트 바인딩
 */
export function initEngine() {
  canvas = document.getElementById("game-canvas");
  ctx = canvas.getContext("2d");
  syncPaddleWidth(canvas.width);
  paddleImage.addEventListener("load", () => syncPaddleWidth(canvas.width));
  paddleImageXenonite.addEventListener("load", () => syncPaddleWidth(canvas.width));

  // index.js에서 호출할 수 있도록 전역 함수로 등록
  window.onCanvasResize = (w, h) => {
    const previousWidth = previousCanvasSize.width || w;
    const previousHeight = previousCanvasSize.height || h;
    const scaleX = previousWidth > 0 ? w / previousWidth : 1;
    const scaleY = previousHeight > 0 ? h / previousHeight : 1;

    GameState.bricks.forEach((brick) => {
      brick.x *= scaleX;
      brick.y *= scaleY;
      brick.w *= scaleX;
      brick.h *= scaleY;
    });

    GameState.balls.forEach((ball) => {
      ball.x *= scaleX;
      ball.y *= scaleY;
    });

    GameState.items.forEach((item) => {
      item.x *= scaleX;
      item.y *= scaleY;
    });

    syncPaddleWidth(w);
    // 캔버스 크기가 변할 때 패들을 화면 하단 중앙에 재배치
    GameState.paddle.y = h - GameState.paddle.h - 30;
    GameState.paddle.x = clamp(GameState.paddle.x * scaleX, 0, Math.max(w - GameState.paddle.w, 0));
    previousCanvasSize = { width: w, height: h };
  };

  window.startGameLoop = () => {
    //lastPointerX = null;
    const rect = canvas.getBoundingClientRect();
    const paddleCenterX = rect.left + GameState.paddle.x + GameState.paddle.w / 2;
    const paddleCenterY = rect.top + GameState.paddle.y + GameState.paddle.h / 2;
    lastPointerX = paddleCenterX - rect.left;
    brickShards = [];
    resonanceWaves = [];
    // 게임 시작 시 초기 공 생성 (패들 정중앙에 부착)
    if (GameState.paddle.y === 0) {
      GameState.paddle.y = canvas.height - GameState.paddle.h - 30;
      GameState.paddle.x = (canvas.width - GameState.paddle.w) / 2;
    }
    GameState.balls = [
      {
        x: GameState.paddle.x + GameState.paddle.w / 2,
        y: getAttachedBallY(GameState.paddle, BALL_RADIUS),
        vx: 0,
        vy: 0,
        r: BALL_RADIUS,
        isLaunched: false, // 스페이스바로 발사하기 전 상태
        combo: 0,
      },
    ];

    if (!animationId) {
      loop();
    }
  };

  // 포인터(마우스/터치) 이벤트 리스너 등록: 패들 이동 및 클릭으로 발사
  canvas.addEventListener("pointermove", (e) => {
    if (GameState.status !== "playing") {
      lastPointerX = null;
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (lastPointerX === null) {
      GameState.paddle.x = x - GameState.paddle.w / 2;
      lastPointerX = x;
    } else {
      const pointerDelta = x - lastPointerX;
      const controlDirection = GameState.controls?.isPaddleInverted ? -1 : 1;
      lastPointerX = x;
      GameState.paddle.x += pointerDelta * controlDirection * getPaddleSensitivityMultiplier();
    }
    // 경계 처리
    if (GameState.paddle.x < 0) GameState.paddle.x = 0;
    if (GameState.paddle.x + GameState.paddle.w > canvas.width)
      GameState.paddle.x = canvas.width - GameState.paddle.w;
  });

  canvas.addEventListener("pointerleave", () => {
    lastPointerX = null;
  });

  canvas.addEventListener("pointerdown", (e) => {
    if (GameState.status === "playing") {
      GameState.balls.forEach((ball) => {
        if (!ball.isLaunched) {
          ball.isLaunched = true;
          const speed = 7.07;
          ball.vx = 0; // 초기 x 속도
          ball.vy = -speed; // 초기 y 속도
          playSoundEffect("pulseShot");
          onBallLaunch();
        }
      });
    }
  });
}

/**
 * 물리 연산 업데이트 (매 프레임 실행)
 */
function updatePhysics() {
  const { width, height } = canvas;
  const paddle = GameState.paddle;

  // 1. 패들 위치 경계 처리 (포인터로 직접 설정됨)
  if (paddle.x < 0) paddle.x = 0;
  if (paddle.x + paddle.w > width) paddle.x = width - paddle.w;

  // 2. 공 이동 및 충돌 처리
  for (let i = GameState.balls.length - 1; i >= 0; i--) {
    const ball = GameState.balls[i];
    const paddleHitbox = getPaddleHitbox(paddle);
    if (!ball.isLaunched) {
      // 발사 전에는 패들을 따라다님
      ball.x = paddle.x + paddle.w / 2;
      ball.y = getAttachedBallY(paddle, ball.r);
      return;
    }

    ball.x += ball.vx;
    ball.y += ball.vy;

    // 벽 충돌 (좌/우)
    if (ball.x - ball.r < 0 || ball.x + ball.r > width) {
      ball.vx *= -1;
      ball.x = ball.x - ball.r < 0 ? ball.r : width - ball.r; // 벽에 끼임 방지
    }
    // 벽 충돌 (상단)
    if (ball.y - ball.r < 0) {
      ball.vy *= -1;
      ball.y = ball.r;
    }

    // 바닥에 떨어짐 (Miss)
    if (ball.y - ball.r > height) {
      GameState.balls.splice(i, 1); // 배열에서 공 제거

      // 남은 공이 없을 때만 연료 감소 처리
      if (GameState.balls.length === 0) {
        onBallMiss();
      }

      // 공이 다 떨어지면 새로 생성 (임시 로직 - 나중에 생명력 개념 추가 가능)
      if (GameState.balls.length === 0 && GameState.status === "playing") {
        GameState.balls.push({
          x: paddle.x + paddle.w / 2,
          y: getAttachedBallY(paddle, ball.r),
          vx: 0,
          vy: 0,
          r: BALL_RADIUS,
          isLaunched: false,
          combo: 0,
        });
      }
      return;
    }

    // 패들 충돌
    if (
      ball.vy > 0 && // 공이 아래로 떨어질 때만
      ball.y + ball.r > paddleHitbox.y &&
      ball.y - ball.r < paddleHitbox.y + paddleHitbox.h &&
      ball.x + ball.r > paddleHitbox.x &&
      ball.x - ball.r < paddleHitbox.x + paddleHitbox.w
    ) {
      // 반사 각도를 이용해 속도의 크기(에너지)를 보존하도록 조정
      const hitPoint = (ball.x - (paddleHitbox.x + paddleHitbox.w / 2)) / (paddleHitbox.w / 2);
      const maxAngle = Math.PI / 3; // 패들 끝에서 약 60도까지 각도 변경 허용
      const angle = hitPoint * maxAngle;
      const prevSpeed = Math.hypot(ball.vx, ball.vy) || 6; // 속도 보존, 0일 경우 기본값 사용
      const minSpeed = 4;
      const speed = Math.max(prevSpeed, minSpeed);

      ball.vx = Math.sin(angle) * speed;
      ball.vy = -Math.cos(angle) * speed; // 항상 위로 반사
      ball.y = paddleHitbox.y - ball.r;
      ball.combo = 0;
    }

    // 아스트로파지(벽돌) 충돌
    GameState.bricks.forEach((brick, brickIndex) => {
      if (!brick.alive) return;

      // 간단한 원-사각형 충돌 판정
      if (
        ball.x + ball.r > brick.x &&
        ball.x - ball.r < brick.x + brick.w &&
        ball.y + ball.r > brick.y &&
        ball.y - ball.r < brick.y + brick.h
      ) {
        // 충돌이 발생했으면 상하/좌우 방향을 비교해 반사 방향 결정
        const overlapX =
          Math.min(ball.x + ball.r, brick.x + brick.w) - Math.max(ball.x - ball.r, brick.x);
        const overlapY =
          Math.min(ball.y + ball.r, brick.y + brick.h) - Math.max(ball.y - ball.r, brick.y);

        if (overlapX < overlapY) {
          ball.vx *= -1;
          if (ball.x < brick.x) {
            ball.x = brick.x - ball.r;
          } else {
            ball.x = brick.x + brick.w + ball.r;
          }
        } else {
          ball.vy *= -1;
          if (ball.y < brick.y) {
            ball.y = brick.y - ball.r;
          } else {
            ball.y = brick.y + brick.h + ball.r;
          }
        }

        const brickStyle = getBrickStyle(brick);
        const wasDestroyed = onBrickHit(brickIndex); // 벽돌 체력/점수 로직 호출
        const prevCombo = ball.combo || 0;
        ball.combo = prevCombo + 1;
        if (
          GameState.currentStage >= 2 &&
          GameState.paddle.hasXenonite &&
          !GameState.hasResonanceTriggered &&
          ball.combo >= 4 &&
          prevCombo < 4
        ) {
          GameState.balls.push(...createResonanceBalls(ball));
          GameState.hasResonanceTriggered = true;
          addSystemLog("Combo accomplished! Multi-ball added", "positive");
          const _multiballEl = document.getElementById("multiball-screen-effect");
          if (_multiballEl) {
            _multiballEl.classList.remove("flash");
            void _multiballEl.offsetWidth;
            _multiballEl.classList.add("flash");
            setTimeout(() => _multiballEl.classList.remove("flash"), 500);
          }
        }
        if (wasDestroyed) {
          createBrickShards(brick, brickStyle, ball.x, ball.y);
        }
      }
    });
  }
}

function drawLaserEffect(ctx) {
  if (!GameState.activeSkills.laser) return;

  const elapsed = Date.now() - GameState.activeSkills.laserStartTime;
  const progress = Math.min(elapsed / 500, 1.0);
  const alpha = 1.0 - progress;

  const paddle = GameState.paddle;
  const centerX = paddle.x + paddle.w / 2;
  const beamHalfWidth = 20;

  ctx.save();

  const outerGlow = ctx.createLinearGradient(
    centerX - beamHalfWidth * 3,
    0,
    centerX + beamHalfWidth * 3,
    0,
  );
  outerGlow.addColorStop(0, "rgba(255,122,26,0)");
  outerGlow.addColorStop(0.3, "rgba(255,122,26,0.18)");
  outerGlow.addColorStop(0.5, "rgba(255,122,26,0.35)");
  outerGlow.addColorStop(0.7, "rgba(255,122,26,0.18)");
  outerGlow.addColorStop(1, "rgba(255,122,26,0)");
  ctx.globalAlpha = alpha;
  ctx.fillStyle = outerGlow;
  ctx.fillRect(centerX - beamHalfWidth * 3, 0, beamHalfWidth * 6, paddle.y);

  const midGrad = ctx.createLinearGradient(centerX - beamHalfWidth, 0, centerX + beamHalfWidth, 0);
  midGrad.addColorStop(0, "rgba(255,122,26,0)");
  midGrad.addColorStop(0.2, "rgba(255,122,26,0.7)");
  midGrad.addColorStop(0.5, "rgba(255,200,80,0.95)");
  midGrad.addColorStop(0.8, "rgba(255,122,26,0.7)");
  midGrad.addColorStop(1, "rgba(255,122,26,0)");
  ctx.shadowColor = "#FF7A1A";
  ctx.shadowBlur = 20;
  ctx.fillStyle = midGrad;
  ctx.fillRect(centerX - beamHalfWidth, 0, beamHalfWidth * 2, paddle.y);

  const coreGrad = ctx.createLinearGradient(centerX - 2, 0, centerX + 2, 0);
  coreGrad.addColorStop(0, "rgba(255,255,240,0)");
  coreGrad.addColorStop(0.5, "rgba(255,255,255,0.98)");
  coreGrad.addColorStop(1, "rgba(255,255,240,0)");
  ctx.shadowColor = "#FFFFFF";
  ctx.shadowBlur = 10;
  ctx.fillStyle = coreGrad;
  ctx.fillRect(centerX - 2, 0, 4, paddle.y);

  ctx.restore();
}

function drawLaserFlash(ctx) {
  if (!GameState.activeSkills.laser) return;

  const elapsed = Date.now() - GameState.activeSkills.laserStartTime;
  if (elapsed > 80) return;

  const t = elapsed / 80;
  const alpha = (1 - t) * (1 - t) * 0.45;

  const paddle = GameState.paddle;
  const centerX = paddle.x + paddle.w / 2;

  ctx.save();
  ctx.globalAlpha = alpha;

  const flashGrad = ctx.createRadialGradient(
    centerX,
    paddle.y,
    0,
    centerX,
    paddle.y,
    canvas.width * 0.6,
  );
  flashGrad.addColorStop(0, "rgba(255,240,200,1)");
  flashGrad.addColorStop(0.15, "rgba(255,180,80,0.8)");
  flashGrad.addColorStop(0.5, "rgba(255,122,26,0.3)");
  flashGrad.addColorStop(1, "rgba(255,122,26,0)");

  ctx.fillStyle = flashGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.restore();
}

/**
 * 렌더링 (매 프레임 화면 그리기)
 */
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 1. 패들(헤일메리호) 그리기
  const p = GameState.paddle;
  syncPaddleSize();
  const currentPaddleImage = GameState.paddle.hasXenonite ? paddleImageXenonite : paddleImage;
  if (currentPaddleImage.complete) {
    ctx.save();
    ctx.shadowColor = "rgba(0, 255, 157, 0.85)";
    ctx.shadowBlur = 8;
    ctx.drawImage(currentPaddleImage, p.x, p.y, p.w, p.h);
    ctx.restore();
  } else {
    ctx.fillStyle = "#e94560";
    ctx.fillRect(p.x, p.y, p.w, p.h);
  }

  // 2. 아스트로파지(벽돌) 그리기
  GameState.bricks.forEach((brick) => {
    if (brick.alive) {
      const style = getBrickStyle(brick);
      const radius = CANVAS_LAYOUT.brickRadius;

      ctx.save();
      ctx.shadowColor = style.glow;
      ctx.shadowBlur = 10;
      drawRoundedRect(ctx, brick.x, brick.y, brick.w, brick.h, radius);
      ctx.fillStyle = style.fill;
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = style.stroke;
      ctx.stroke();

      drawRoundedRect(
        ctx,
        brick.x + 1,
        brick.y + 1,
        brick.w - 2,
        brick.h - 2,
        Math.max(radius - 2, 0),
      );
      ctx.strokeStyle = "rgba(6, 11, 22, 0.32)";
      ctx.stroke();
      ctx.restore();
    }
  });

  // 레이저 빔 이펙트 (벽돌 위, 공 아래)
  drawLaserEffect(ctx);

  // 3. 공(에너지 펄스/타우메바) 그리기
  GameState.balls.forEach((ball) => {
    drawBall(ball);
  });
  drawResonanceWaves();

  // 4. 파괴된 벽돌 파편 그리기
  drawBrickShards();

  // 5. 아이템 그리기
  drawItems(ctx);

  // 발동 섬광 (최상단 레이어)
  drawLaserFlash(ctx);
}

/**
 * 메인 루프
 */
function loop() {
  if (GameState.status === "playing") {
    updatePhysics();
    updateItems();
    updateResonanceWaves();
  }
  updateBrickShards();

  // 상태와 무관하게 화면은 계속 렌더링 (일시정지 화면 등을 위해)
  draw();
  animationId = requestAnimationFrame(loop);
}
