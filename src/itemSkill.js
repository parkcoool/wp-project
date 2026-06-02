import { GameState, FUEL_COSTS } from "./state.js";
import { onFuelItemPickup, onDebrisPickup, onSkillUse } from "./fuelSystem.js";
import { addSystemLog } from "./stageManager.js";

window.onBrickDestroyed = function(brick) {
	const roll = Math.random();
	const stage = GameState.currentStage;

	const debrisChance = stage === 1 ? 0.1 : stage === 2 ? 0.15 : 0.2;
	if(roll < 0.2) {
		GameState.items.push( {
			x: brick.x + brick.w /2 - 12,
			y: brick.y,
			vy: 2,
			type: 'fuel',
			alive: true,
			w: brick.w,
			h: brick.h,
		});
	}
	else if (roll < 0.2 + debrisChance) {
		GameState.items.push({
			x: brick.x + brick.w / 2 - 12,
			y: brick.y,
			vy: 2,
			type: 'debris',
			alive: true,
			w: brick.w,
			h: brick.h,
		})
	}
}

const canvas = document.getElementById('game-canvas');

export function updateItems() {
	const paddle = GameState.paddle;

	GameState.items.forEach(item => {
		item.y += item.vy;

		if(
			item.x + item.w > paddle.x &&
			item.x < paddle.x + paddle.w &&
			item.y + item.h > paddle.y &&
			item.y < paddle.y + paddle.h 
		) {
			item.alive = false;
			if(item.type === 'fuel') {
				onFuelItemPickup();
			} else {
				onDebrisPickup();
			}
		}
		
		if(item.y > canvas.height) {
			item.alive = false;
		}
	});
	GameState.items = GameState.items.filter(i => i.alive);
}

document.addEventListener('keydown', e => {
	if(GameState.status !== 'playing') return;
	const key = e.key.toUpperCase();

	if(key === (GameState.skillKeys.slow ?? 'S')) {
		if(!GameState.balls.some(b => b.isLaunched)) return;
		if(!GameState.unlockedSkills.includes('slow')) return;
		if(GameState.fuel.current <= FUEL_COSTS.skillSlow) return;
		if(GameState.activeSkills.slow) return;
		

		// 쿨타임 오버레이 추가
		const ring = document.getElementById('skill-ring-slow');
		const overlay = document.createElement('div');
		overlay.className = 'skill-cooldown-overlay';
		ring?.appendChild(overlay);

		const totalTime = 4000;
		const startTime = Date.now();

		// 쿨타임 게이지 업데이트
		const interval = setInterval(() => {
			const progress = (Date.now() - startTime) / totalTime;
			overlay.style.background = `conic-gradient(
			transparent ${progress*360}deg,
			rgba(0,0,0,0.6) ${progress*360}deg
			)`;
			if(progress >= 1) clearInterval(interval);
		}, 50);


		GameState.balls.forEach(b => {
			if(!b.isLaunched) return;
			b.originVx = b.vx;
			b.originVy = b.vy;
			b.vy *= 0.5;
			b.vx *= 0.5;
		});
		onSkillUse('slow');
		GameState.activeSkills.slow = true;
		addSystemLog("Time Slow Active", "warning");

		const screenEffect = document.getElementById('slow-screen-effect');
		screenEffect?.classList.add('active');

		setTimeout(() => {
			GameState.balls.forEach(b => {
				if(!b.isLaunched) return;
				if(b.originVx === undefined) return;

				// 현재 방향은 유지하고 속도 크기만 2배로 복구
    			const speed = Math.hypot(b.vx, b.vy); // 현재 속도 크기
    			const originalSpeed = Math.hypot(b.originVx, b.originVy); // 원래 속도 크기
    			const ratio = originalSpeed / speed; // 복구 비율

				b.vy *= ratio;
				b.vx *= ratio;
				b.originVx = undefined;
				b.originVy = undefined;
			});
			GameState.activeSkills.slow = false;
			addSystemLog("Time Slow Ended", "normal");
			overlay?.remove();
			screenEffect?.classList.remove('active');
		}, 4000);
		
	}
	if(key === (GameState.skillKeys.laser ?? 'R')) {
		if(!GameState.balls.some(b => b.isLaunched)) return;
		if(!GameState.unlockedSkills.includes('laser')) return;
		if(GameState.fuel.current <= FUEL_COSTS.skillLaser) return;
		if(GameState.activeSkills.laser) return;
		onSkillUse('laser');
		GameState.activeSkills.laser = true;
		GameState.activeSkills.laserStartTime = Date.now();
		addSystemLog("Laser Fired!", "warning");

		// 쿨타임 오버레이 추가
		const ring = document.getElementById('skill-ring-laser');
		const overlay = document.createElement('div');
		overlay.className = 'skill-cooldown-overlay';
		ring?.appendChild(overlay);

		const totalTime = 4000;
		const startTime = Date.now();

		// 쿨타임 게이지 업데이트
		const interval = setInterval(() => {
			const progress = (Date.now() - startTime) / totalTime;
			overlay.style.background = `conic-gradient(
			transparent ${progress*360}deg,
			rgba(0,0,0,0.6) ${progress*360}deg
			)`;
			if(progress >= 1) clearInterval(interval);
		}, 50);



		const paddle = GameState.paddle;
		const centerX = paddle.x + paddle.w / 2;
		const laserWidth = 40;

		GameState.bricks.forEach((brick, index) => {
			if(!brick.alive) return;
			
			if(
				brick.x + brick.w > centerX - laserWidth / 2 &&
				brick.x < centerX + laserWidth / 2
			) {
				for(let i = 0; i < brick.maxHp; i++) {
					window.gameAPI.onBrickHit(index);
				}
			}
		});
		setTimeout(() => {
			GameState.activeSkills.laser = false;
		}, 500);
	}
});

export function drawItems(ctx) {
	GameState.items.forEach(item => {
		if(!item.alive) return;

	const cx = item.x + item.w / 2;
    const cy = item.y + item.h / 2;
    const r = item.w / 2;

    if (item.type === 'fuel') {
      // 파란 빛나는 원
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(0.3, '#59C3FF');
      gradient.addColorStop(1, '#0066ff');

      ctx.shadowColor = '#59C3FF';
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.shadowBlur = 0;

    } else {
      // 회색 불규칙한 형태
      ctx.shadowColor = '#888888';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#666666';
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r * 0.6, cy - r * 0.4);
      ctx.lineTo(cx + r, cy + r * 0.3);
      ctx.lineTo(cx + r * 0.3, cy + r);
      ctx.lineTo(cx - r * 0.5, cy + r * 0.7);
      ctx.lineTo(cx - r, cy - r * 0.2);
      ctx.lineTo(cx - r * 0.4, cy - r * 0.8);
      ctx.closePath();
      ctx.fill();

      // 하이라이트
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath();
      ctx.arc(cx - r * 0.2, cy - r * 0.3, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  });
}
