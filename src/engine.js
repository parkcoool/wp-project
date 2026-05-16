import { GameState } from "./state.js";
import { onBrickHit } from "./stageManager.js";
import { onBallLaunch, onBallMiss } from "./fuelSystem.js";

let canvas;
let ctx;
let animationId = null;

// 포인터(마우스/터치)로 패들을 조작합니다 (이전 키보드 입력 제거)

/**
 * 물리 엔진 초기화 및 이벤트 바인딩
 */
export function initEngine() {
  canvas = document.getElementById("game-canvas");
  ctx = canvas.getContext("2d");

  // index.js에서 호출할 수 있도록 전역 함수로 등록
  window.onCanvasResize = (w, h) => {
    // 캔버스 크기가 변할 때 패들을 화면 하단 중앙에 재배치
    GameState.paddle.y = h - GameState.paddle.h - 30;
    GameState.paddle.x = (w - GameState.paddle.w) / 2;
  };

  window.startGameLoop = () => {
    // 게임 시작 시 초기 공 생성 (패들 정중앙에 부착)
    if (GameState.paddle.y === 0) {
      GameState.paddle.y = canvas.height - GameState.paddle.h - 30;
      GameState.paddle.x = (canvas.width - GameState.paddle.w) / 2;
    }
    GameState.balls = [{
      x: GameState.paddle.x + GameState.paddle.w / 2,
      y: GameState.paddle.y - 10,
      vx: 0,
      vy: 0,
      r: 8,
      isLaunched: false // 스페이스바로 발사하기 전 상태
    }];

    if (!animationId) {
      loop();
    }
  };

  // 포인터(마우스/터치) 이벤트 리스너 등록: 패들 이동 및 클릭으로 발사
  canvas.addEventListener("pointermove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    GameState.paddle.x = x - GameState.paddle.w / 2;
    // 경계 처리
    if (GameState.paddle.x < 0) GameState.paddle.x = 0;
    if (GameState.paddle.x + GameState.paddle.w > canvas.width) GameState.paddle.x = canvas.width - GameState.paddle.w;
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
    if (!ball.isLaunched) {
      // 발사 전에는 패들을 따라다님
      ball.x = paddle.x + paddle.w / 2;
      ball.y = paddle.y - ball.r;
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
            y: paddle.y - ball.r,
            vx: 0, vy: 0, r: 8, isLaunched: false
         });
      }
      return;
    }

    // 패들 충돌
    if (
      ball.vy > 0 && // 공이 아래로 떨어질 때만
      ball.y + ball.r > paddle.y &&
      ball.y - ball.r < paddle.y + paddle.h &&
      ball.x + ball.r > paddle.x &&
      ball.x - ball.r < paddle.x + paddle.w
    ) {
      ball.vy *= -1;
      // 맞은 위치에 따라 튕기는 각도(vx) 변경
      const hitPoint = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
      ball.vx = hitPoint * 6; // 최대 속도 조절
      ball.y = paddle.y - ball.r; 
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
  ctx.fillStyle = "#e94560";
  ctx.fillRect(p.x, p.y, p.w, p.h);

  // 2. 아스트로파지(벽돌) 그리기
  GameState.bricks.forEach(brick => {
    if (brick.alive) {
      // 내구도(hp)나 타입에 따라 색상 다르게 표시
      ctx.fillStyle = brick.hp === 3 ? "#FF7A1A" : brick.hp === 2 ? "#FFC857" : "#59C3FF";
      ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
      ctx.strokeStyle = "#1a1a2e";
      ctx.strokeRect(brick.x, brick.y, brick.w, brick.h);
    }
  });

  // 3. 공(에너지 펄스/타우메바) 그리기
  GameState.balls.forEach(ball => {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fillStyle = "#EAF4FF";
    ctx.fill();
    ctx.closePath();
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