import { GameState } from "./state.js";
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

export function updateItems() {

	GameState.items.forEach(item => {
		item.y += item.vy;
		const paddle = GameState.paddle;

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

		const canvas = document.getElementById('game-canvas');
		if(item.y > canvas.height) {
			item.alive = false;
		}
	});
	GameState.items = GameState.items.filter(i => i.alive);
}

document.addEventListener('keydown', e => {
	if(GameState.status !== 'playing') return;
	const key = e.key.toUpperCase();

	if(key == 'S') {
		if(!GameState.unlockedSkills.includes('slow')) return;
		onSkillUse('slow');
		GameState.balls.forEach(b => {
			b.vy *= 0.5;
			b.vx *= 0.5;
		});
		setTimeout(() => {
			GameState.balls.forEach(b => {
				b.vy *= 2;
				b.vx *= 2;
			});
		}, 4000);
	}
	if(key == 'R') {
		if(!GameState.unlockedSkills.includes('laser')) return;
		onSkillUse('laser');

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
	}
});