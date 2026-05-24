import { GameState, FUEL_COSTS } from "./state.js";
import { onFuelItemPickup, onDebrisPickup, onSkillUse } from "./fuelSystem.js";

window.onBrickDestroyed = function(brick) {
	const roll = Math.random();

	if(roll < 0.2) {
		GameState.items.push( {
			x: brick.x + brick.w /2 - 12,
			y: brick.y,
			vy: 3,
			type: 'fuel',
			alive: true,
			w: brick.w,
			h: brick.h,
		});
	}
	else if (roll < 0.3) {
		GameState.items.push({
			x: brick.x + brick.w / 2 - 12,
			y: brick.y,
			vy: 3,
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

	if(key === 'S') {
		if(!GameState.balls.some(b => b.isLaunched)) return;
		if(!GameState.unlockedSkills.includes('slow')) return;
		if(GameState.fuel.current < FUEL_COSTS.skillSlow) return;
		if(GameState.activeSkills.slow) return;
		onSkillUse('slow');
		GameState.activeSkills.slow = true;
		GameState.balls.forEach(b => {
			b.vy *= 0.5;
			b.vx *= 0.5;
		});
		setTimeout(() => {
			GameState.balls.forEach(b => {
				b.vy *= 2;
				b.vx *= 2;
			});
			GameState.activeSkills.slow = false;
		}, 4000);
		
	}
	if(key === 'R') {
		if(!GameState.balls.some(b => b.isLaunched)) return;
		if(!GameState.unlockedSkills.includes('laser')) return;
		if(GameState.fuel.current < FUEL_COSTS.skillLaser) return;
		if(GameState.activeSkills.laser) return;
		onSkillUse('laser');
		GameState.activeSkills.laser = true;

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

	// 	if(item.type === 'fuel') {
	// 		ctx.fillStyle = '#FFC857';
	// 		ctx.shadowColor = '#FFC857';
	// 	}
	// 	else {
	// 		ctx.fillStyle = '#FF4444';
	// 		ctx.styleColor = '#FF4444';
	// 	}

	// 	// 네모 그리기
	// 	ctx.shadowBlur = 10;
	// 	ctx.fillRect(item.x, item.y, item.w, item.h);
	// 	ctx.shadowBlur = 0;

	// 	// 아이콘 그리기
	// 	ctx.fillStyle = '#fff';
	// 	ctx.font = '14px monospace';
	// 	ctx.textAlign = 'center';
	// 	ctx.fillText(
	// 		item.type === 'fuel' ? '⚡' : '🗑',
	// 		item.x + item.w / 2,
	// 		item.y + item.h - 4
	// 	);
	// });
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