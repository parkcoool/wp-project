import { APPEARANCE_PRESETS, GameState, CANVAS_LAYOUT } from "./state.js";
import { onBrickHit } from "./stageManager.js";
import { onBallLaunch, onBallMiss } from "./fuelSystem.js";

let canvas;
let ctx;
let animationId = null;
let lastPointerX = null;
const BALL_RADIUS = 10;
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

function drawBall(ball) {
  const style =
    APPEARANCE_PRESETS.balls[GameState.appearance.ballSkin] ??
    APPEARANCE_PRESETS.balls["pulse-energy"];

  ctx.save();
  ctx.shadowColor = style.glow;
  ctx.shadowBlur = style.shape === "singularity" ? 22 : 16;

  if (style.shape === "pulse") {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fillStyle = style.fill;
    ctx.fill();
    ctx.closePath();
    ctx.restore();
    return;
  }

  if (style.shape === "comet" && ball.isLaunched) {
    const angle = Math.atan2(ball.vy, ball.vx) + Math.PI;
    const tailLength = ball.r * 2.8;
    const tailX = ball.x + Math.cos(angle) * tailLength;
    const tailY = ball.y + Math.sin(angle) * tailLength;
    const tailGradient = ctx.createLinearGradient(ball.x, ball.y, tailX, tailY);
    tailGradient.addColorStop(0, style.fill);
    tailGradient.addColorStop(1, "rgba(125, 235, 255, 0)");
    ctx.beginPath();
    ctx.moveTo(ball.x, ball.y - ball.r * 0.7);
    ctx.lineTo(tailX, tailY);
    ctx.lineTo(ball.x, ball.y + ball.r * 0.7);
    ctx.closePath();
    ctx.fillStyle = tailGradient;
    ctx.fill();
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

function getPaddleHeight() {
  const imageRatio = paddleImage.naturalWidth
    ? paddleImage.naturalHeight / paddleImage.naturalWidth
    : 2 / 3;
  return GameState.paddle.w * imageRatio;
}

function syncPaddleSize() {
  GameState.paddle.h = getPaddleHeight();
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

// 포인터(마우스/터치)로 패들을 조작합니다 (이전 키보드 입력 제거)

/**
 * 물리 엔진 초기화 및 이벤트 바인딩
 */
export function initEngine() {
  canvas = document.getElementById("game-canvas");
  ctx = canvas.getContext("2d");
  syncPaddleSize();
  paddleImage.addEventListener("load", syncPaddleSize);

  // index.js에서 호출할 수 있도록 전역 함수로 등록
  window.onCanvasResize = (w, h) => {
    syncPaddleSize();
    // 캔버스 크기가 변할 때 패들을 화면 하단 중앙에 재배치
    GameState.paddle.y = h - GameState.paddle.h - 30;
    GameState.paddle.x = (w - GameState.paddle.w) / 2;
  };

  window.startGameLoop = () => {
    lastPointerX = null;
    // 게임 시작 시 초기 공 생성 (패들 정중앙에 부착)
    if (GameState.paddle.y === 0) {
      GameState.paddle.y = canvas.height - GameState.paddle.h - 30;
      GameState.paddle.x = (canvas.width - GameState.paddle.w) / 2;
    }
    GameState.balls = [{
      x: GameState.paddle.x + GameState.paddle.w / 2,
      y: getAttachedBallY(GameState.paddle, BALL_RADIUS),
      vx: 0,
      vy: 0,
      r: BALL_RADIUS,
      isLaunched: false // 스페이스바로 발사하기 전 상태
    }];

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
      lastPointerX = x;
    } else {
      const pointerDelta = x - lastPointerX;
      const controlDirection = GameState.controls?.isPaddleInverted ? -1 : 1;
      lastPointerX = x;
      GameState.paddle.x += pointerDelta * controlDirection * getPaddleSensitivityMultiplier();
    }
    // 경계 처리
    if (GameState.paddle.x < 0) GameState.paddle.x = 0;
    if (GameState.paddle.x + GameState.paddle.w > canvas.width) GameState.paddle.x = canvas.width - GameState.paddle.w;
  });

  canvas.addEventListener("pointerleave", () => {
    lastPointerX = null;
  });

  canvas.addEventListener("pointerdown", (e) => {
    if (GameState.status === "playing") {
      GameState.balls.forEach(ball => {
        if (!ball.isLaunched) {
          ball.isLaunched = true;
          ball.vx = 5;  // 초기 x 속도
          ball.vy = -5; // 초기 y 속도
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
  for(let i=GameState.balls.length-1; i>=0; i--) {
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
      onBallMiss(); 
      
      // 공이 다 떨어지면 새로 생성 (임시 로직 - 나중에 생명력 개념 추가 가능)
      if (GameState.balls.length === 0 && GameState.status === "playing") {
         GameState.balls.push({
            x: paddle.x + paddle.w / 2,
            y: getAttachedBallY(paddle, ball.r),
            vx: 0, vy: 0, r: BALL_RADIUS, isLaunched: false
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
      ball.vy *= -1;
      const hitPoint = (ball.x - (paddleHitbox.x + paddleHitbox.w / 2)) / (paddleHitbox.w / 2);
      ball.vx = hitPoint * 6; // 최대 속도 조절
      ball.y = paddleHitbox.y - ball.r; 
    }

    // 아스트로파지(벽돌) 충돌
    GameState.bricks.forEach((brick, brickIndex) => {
      if (!brick.alive) return;

      // 간단한 AABB 사각형 충돌 판정
      if (
        ball.x + ball.r > brick.x &&
        ball.x - ball.r < brick.x + brick.w &&
        ball.y + ball.r > brick.y &&
        ball.y - ball.r < brick.y + brick.h
      ) {
        ball.vy *= -1; // 일단 무조건 반전 (세밀한 상하좌우 판정은 추후 고도화)
        onBrickHit(brickIndex); // 벽돌 체력/점수 로직 호출
      }
    });
  }
}

/**
 * 렌더링 (매 프레임 화면 그리기)
 */
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 1. 패들(헤일메리호) 그리기
  const p = GameState.paddle;
  syncPaddleSize();
  if (paddleImage.complete) {
    ctx.save();
    ctx.shadowColor = "rgba(0, 255, 157, 0.85)";
    ctx.shadowBlur = 8;
    ctx.drawImage(paddleImage, p.x, p.y, p.w, p.h);
    ctx.restore();
  } else {
    ctx.fillStyle = "#e94560";
    ctx.fillRect(p.x, p.y, p.w, p.h);
  }

  // 2. 아스트로파지(벽돌) 그리기
  GameState.bricks.forEach(brick => {
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

      drawRoundedRect(ctx, brick.x + 1, brick.y + 1, brick.w - 2, brick.h - 2, Math.max(radius - 2, 0));
      ctx.strokeStyle = "rgba(6, 11, 22, 0.32)";
      ctx.stroke();
      ctx.restore();
    }
  });

  // 3. 공(에너지 펄스/타우메바) 그리기
  GameState.balls.forEach(ball => {
    drawBall(ball);
  });
}

/**
 * 메인 루프
 */
function loop() {
  if (GameState.status === "playing") {
    updatePhysics();
  }
  
  // 상태와 무관하게 화면은 계속 렌더링 (일시정지 화면 등을 위해)
  draw();
  animationId = requestAnimationFrame(loop);
}
