const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const levelDisplay = document.getElementById('levelDisplay');
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const finalScoreElement = document.getElementById('finalScore');

// Game settings
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
let gameLoopId;
let isPlaying = false;
let isTransitioning = false;
let hasWon = false;
let score = 0;
let currentLevel = 1;
let frames = 0;

// Levels Configuration
const levelsConfig = [
    { emojis: ['👾', '👽'], speed: 2, wave: false, ufoChance: 0 },
    { emojis: ['🤖', '👻'], speed: 2.5, wave: false, ufoChance: 0 },
    { emojis: ['👾', '🤖'], speed: 3, wave: false, ufoChance: 0.002 },
    { emojis: ['🎃', '🤡'], speed: 3.5, wave: true, ufoChance: 0.004 },
    { emojis: ['👹', '💀'], speed: 4.5, wave: true, ufoChance: 0.006 }
];

// Player Ship
const player = {
    x: GAME_WIDTH / 2,
    y: GAME_HEIGHT - 60,
    width: 50,
    height: 50,
    speed: 7,
    weaponType: 'normal'
};

// Arrays for entities
let bullets = [];
let aliens = [];
let particles = [];
let ufos = [];
let powerups = [];
let floatingTexts = [];

// Input handling
const keys = {
    ArrowLeft: false,
    ArrowRight: false,
    ArrowUp: false,
    ArrowDown: false,
    Space: false
};

window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowLeft') keys.ArrowLeft = true;
    if (e.code === 'ArrowRight') keys.ArrowRight = true;
    if (e.code === 'ArrowUp') keys.ArrowUp = true;
    if (e.code === 'ArrowDown') keys.ArrowDown = true;
    if (e.code === 'Space') {
        if (!keys.Space) {
            keys.Space = true;
            shoot();
        }
        e.preventDefault(); // Prevent scrolling
    }
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft') keys.ArrowLeft = false;
    if (e.code === 'ArrowRight') keys.ArrowRight = false;
    if (e.code === 'ArrowUp') keys.ArrowUp = false;
    if (e.code === 'ArrowDown') keys.ArrowDown = false;
    if (e.code === 'Space') keys.Space = false;
});

// Audio System (Web Audio API)
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();
let musicInterval;
let ufoOscillator = null;
let ufoGain = null;

function playSound(type) {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'shoot') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'explosion') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
    } else if (type === 'powerup') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(800, audioCtx.currentTime + 0.1);
        osc.frequency.linearRampToValueAtTime(1200, audioCtx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    }
}

function playSequence(notesSequence, speed = 150) {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    let time = audioCtx.currentTime;
    for (let i = 0; i < notesSequence.length; i++) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.frequency.setValueAtTime(notesSequence[i], time);
        gain.gain.setValueAtTime(0.05, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + (speed/1000));
        
        osc.start(time);
        osc.stop(time + (speed/1000));
        time += (speed/1000);
    }
}

function playLevelComplete() {
    playSequence([392.00, 523.25, 659.25, 783.99], 150); // G, C, E, G
}

function playVictory() {
    playSequence([523.25, 659.25, 783.99, 1046.50, 783.99, 1046.50, 1567.98], 120); 
}

function playGameOver() {
    playSequence([392.00, 311.13, 261.63, 196.00], 300); // Descending sad notes
}

function startUfoSound() {
    if (ufoOscillator) return;
    if(audioCtx.state === 'suspended') audioCtx.resume();
    ufoOscillator = audioCtx.createOscillator();
    ufoGain = audioCtx.createGain();
    ufoOscillator.type = 'sine';
    ufoOscillator.frequency.value = 800;
    
    // Create a wobble effect
    const lfo = audioCtx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 5; // 5 wobbles per second
    const lfoGain = audioCtx.createGain();
    lfoGain.gain.value = 200; // Pitch modulation depth
    lfo.connect(lfoGain);
    lfoGain.connect(ufoOscillator.frequency);
    lfo.start();

    ufoOscillator.connect(ufoGain);
    ufoGain.connect(audioCtx.destination);
    ufoGain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    ufoOscillator.start();
}

function stopUfoSound() {
    if (ufoOscillator) {
        ufoOscillator.stop();
        ufoOscillator.disconnect();
        ufoGain.disconnect();
        ufoOscillator = null;
        ufoGain = null;
    }
}

const notes = [261.63, 329.63, 392.00, 523.25]; // C, E, G, C
let noteIdx = 0;

function startMusic() {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    if(musicInterval) clearInterval(musicInterval);
    
    musicInterval = setInterval(() => {
        if(!isPlaying || isTransitioning) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.frequency.value = notes[noteIdx] / 2; // Bass
        gain.gain.setValueAtTime(0.03, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
        
        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
        
        noteIdx = (noteIdx + 1) % notes.length;
    }, 250);
}

function stopMusic() {
    if(musicInterval) clearInterval(musicInterval);
}


// Setup Level
function initLevel(isNewGame) {
    if (isNewGame) {
        score = 0;
        currentLevel = 1;
        hasWon = false;
        startMusic();
    } else {
        currentLevel++;
    }
    
    isTransitioning = false;
    scoreElement.innerText = score;
    levelDisplay.innerText = currentLevel;
    bullets = [];
    aliens = [];
    particles = [];
    ufos = [];
    powerups = [];
    floatingTexts = [];
    
    // Reset player
    player.x = GAME_WIDTH / 2;
    player.y = GAME_HEIGHT - 60;
    player.weaponType = 'normal';
    
    stopUfoSound();
    
    const config = levelsConfig[currentLevel - 1];
    
    // Create aliens
    const rows = 4;
    const cols = 8;
    for(let r = 0; r < rows; r++) {
        for(let c = 0; c < cols; c++) {
            aliens.push({
                x: c * 70 + 100,
                initialX: c * 70 + 100,
                y: r * 60 + 50,
                baseY: r * 60 + 50,
                width: 40,
                height: 40,
                emoji: config.emojis[r % config.emojis.length],
                speedX: config.speed,
                direction: 1
            });
        }
    }
}

function triggerLevelComplete() {
    isTransitioning = true;
    bullets = [];
    stopUfoSound();
    
    if (currentLevel >= 5) {
        hasWon = true;
        playVictory();
        setTimeout(() => {
            gameOver(); // Ends game showing victory score
        }, 5000);
    } else {
        playLevelComplete();
        setTimeout(() => {
            initLevel(false);
        }, 3000);
    }
}

// Shoot a bullet
function shoot() {
    if (!isPlaying || isTransitioning) return;
    playSound('shoot');
    
    if (player.weaponType === 'normal') {
        bullets.push({
            x: player.x,
            y: player.y - 20,
            vx: 0,
            vy: -10,
            width: 6,
            height: 20,
            color: '#00f3ff'
        });
    } else if (player.weaponType === 'spread') {
        // Center bullet
        bullets.push({ x: player.x, y: player.y - 20, vx: 0, vy: -10, width: 6, height: 20, color: '#00f3ff' });
        // Left bullet
        bullets.push({ x: player.x, y: player.y - 20, vx: -3, vy: -9, width: 6, height: 20, color: '#ff00ff' });
        // Right bullet
        bullets.push({ x: player.x, y: player.y - 20, vx: 3, vy: -9, width: 6, height: 20, color: '#ff00ff' });
    }
}

function createExplosion(x, y, color) {
    playSound('explosion');
    for (let i = 0; i < 15; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            life: 1.0,
            color: color
        });
    }
}

function createFloatingText(x, y, text, color) {
    floatingTexts.push({
        x: x,
        y: y,
        text: text,
        color: color,
        life: 1.0
    });
}

// Spawn Entities
function trySpawnEntities() {
    const config = levelsConfig[currentLevel - 1];
    
    // Spawn UFO
    if (Math.random() < config.ufoChance && ufos.length === 0) {
        ufos.push({
            x: -50,
            y: 40,
            speedX: 3,
            emoji: '🛸'
        });
        startUfoSound();
    }
    
    // Spawn Powerup (Star) - rare chance, max 1 on screen
    if (Math.random() < 0.001 && powerups.length === 0 && player.weaponType === 'normal') {
        powerups.push({
            x: Math.random() * (GAME_WIDTH - 100) + 50,
            y: -30,
            speedY: 2,
            emoji: '⭐'
        });
    }
}

// Update game state
function update() {
    frames++;
    
    // Always update visual effects (particles and floating text)
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].x += particles[i].vx;
        particles[i].y += particles[i].vy;
        particles[i].life -= 0.05;
        if (particles[i].life <= 0) particles.splice(i, 1);
    }
    
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        floatingTexts[i].y -= 1;
        floatingTexts[i].life -= 0.02;
        if (floatingTexts[i].life <= 0) floatingTexts.splice(i, 1);
    }

    if (isTransitioning) return; // Stop updating entities if transitioning

    const config = levelsConfig[currentLevel - 1];
    
    // Player movement
    if (keys.ArrowLeft && player.x > 30) player.x -= player.speed;
    if (keys.ArrowRight && player.x < GAME_WIDTH - 30) player.x += player.speed;
    if (keys.ArrowUp && player.y > GAME_HEIGHT / 2) player.y -= player.speed;
    if (keys.ArrowDown && player.y < GAME_HEIGHT - 30) player.y += player.speed;

    // Bullets movement
    for (let i = bullets.length - 1; i >= 0; i--) {
        bullets[i].x += bullets[i].vx;
        bullets[i].y += bullets[i].vy;
        if (bullets[i].y < 0 || bullets[i].x < 0 || bullets[i].x > GAME_WIDTH) {
            bullets.splice(i, 1);
        }
    }

    // Alien movement & collision
    let edgeHit = false;
    for (let alien of aliens) {
        alien.x += alien.speedX * alien.direction;
        if (config.wave) {
            // Using initialX ensures the wave is perfectly smooth regardless of direction
            alien.y = alien.baseY + Math.sin(frames * 0.05 + alien.initialX * 0.05) * 20;
        }
        if (alien.x > GAME_WIDTH - 30 || alien.x < 30) {
            edgeHit = true;
        }
    }

    if (edgeHit) {
        for (let alien of aliens) {
            alien.direction *= -1;
            alien.baseY += 20;
            alien.y = alien.baseY;
            if (alien.baseY > player.y - 40) {
                gameOver();
                return;
            }
        }
    }
    
    trySpawnEntities();
    
    // UFO Logic
    for (let i = ufos.length - 1; i >= 0; i--) {
        ufos[i].x += ufos[i].speedX;
        if (ufos[i].x > GAME_WIDTH + 50) {
            ufos.splice(i, 1);
            if (ufos.length === 0) stopUfoSound();
        }
    }
    
    // Powerup Logic
    for (let i = powerups.length - 1; i >= 0; i--) {
        powerups[i].y += powerups[i].speedY;
        
        // Check collision with player
        if (Math.abs(powerups[i].x - player.x) < 40 && Math.abs(powerups[i].y - player.y) < 40) {
            playSound('powerup');
            player.weaponType = 'spread';
            createFloatingText(player.x, player.y - 40, 'TRIPLE LASER!', '#ffff00');
            powerups.splice(i, 1);
        } else if (powerups[i].y > GAME_HEIGHT + 30) {
            powerups.splice(i, 1); // Remove if off screen
        }
    }

    // Bullet Collisions
    for (let i = bullets.length - 1; i >= 0; i--) {
        let bulletHit = false;
        
        // UFO collision
        for (let j = ufos.length - 1; j >= 0; j--) {
            let b = bullets[i];
            let u = ufos[j];
            if (Math.abs(b.x - u.x) < 30 && Math.abs(b.y - u.y) < 25) {
                createExplosion(u.x, u.y, '#39ff14');
                createFloatingText(u.x, u.y, '+50', '#39ff14');
                ufos.splice(j, 1);
                if (ufos.length === 0) stopUfoSound();
                bulletHit = true;
                score += 50; // Bonus points!
                scoreElement.innerText = score;
                break;
            }
        }
        
        if (bulletHit) {
            bullets.splice(i, 1);
            continue;
        }
        
        // Alien collision
        for (let j = aliens.length - 1; j >= 0; j--) {
            let b = bullets[i];
            let a = aliens[j];
            if (Math.abs(b.x - a.x) < 25 && Math.abs(b.y - a.y) < 25) {
                createExplosion(a.x, a.y, '#ff00ff');
                aliens.splice(j, 1);
                bulletHit = true;
                score += 10;
                scoreElement.innerText = score;
                break;
            }
        }
        
        if (bulletHit) {
            bullets.splice(i, 1);
        }
    }

    // Next level condition
    if (aliens.length === 0) {
        triggerLevelComplete();
    }
}

// Draw game state
function draw() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Draw Player (Rotated & Neon)
    ctx.font = '40px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(-Math.PI / 4);
    ctx.shadowColor = '#00f3ff';
    ctx.shadowBlur = 20;
    ctx.fillText('🚀', 0, 0);
    ctx.restore();

    // Draw Aliens (Neon)
    ctx.shadowColor = '#ff00ff';
    ctx.shadowBlur = 15;
    for (let alien of aliens) {
        ctx.fillText(alien.emoji, alien.x, alien.y);
    }
    
    // Draw UFOs (Neon)
    ctx.shadowColor = '#39ff14';
    ctx.shadowBlur = 25;
    for (let ufo of ufos) {
        ctx.fillText(ufo.emoji, ufo.x, ufo.y);
    }
    
    // Draw Powerups (Neon)
    ctx.shadowColor = '#ffff00';
    ctx.shadowBlur = 20;
    for (let p of powerups) {
        ctx.fillText(p.emoji, p.x, p.y);
    }

    // Draw Bullets
    for (let b of bullets) {
        ctx.fillStyle = b.color;
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 10;
        
        // Rotate bullet drawing if it has horizontal velocity (spread shot)
        if (b.vx !== 0) {
            ctx.save();
            ctx.translate(b.x, b.y);
            const angle = Math.atan2(b.vy, b.vx) + Math.PI / 2; // Add 90 degrees to point up
            ctx.rotate(angle);
            ctx.fillRect(-b.width/2, 0, b.width, b.height);
            ctx.restore();
        } else {
            ctx.fillRect(b.x - b.width/2, b.y, b.width, b.height);
        }
    }

    // Draw Particles
    for (let p of particles) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
    
    // Draw Floating Texts
    ctx.font = '20px Outfit';
    for (let ft of floatingTexts) {
        ctx.fillStyle = ft.color;
        ctx.globalAlpha = ft.life;
        ctx.shadowColor = ft.color;
        ctx.shadowBlur = 10;
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.globalAlpha = 1.0;
    }
    
    ctx.shadowBlur = 0; // Reset
    
    // Draw Level Complete Overlay on Canvas
    if (isTransitioning) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        
        ctx.font = '50px Outfit';
        ctx.textAlign = 'center';
        
        if (hasWon) {
            ctx.fillStyle = '#39ff14';
            ctx.shadowColor = '#39ff14';
            ctx.shadowBlur = 20;
            ctx.fillText('YOU SAVED THE GALAXY!', GAME_WIDTH/2, GAME_HEIGHT/2 - 20);
            ctx.font = '30px Outfit';
            ctx.fillText('Final Score: ' + score, GAME_WIDTH/2, GAME_HEIGHT/2 + 30);
        } else {
            ctx.fillStyle = '#00f3ff';
            ctx.shadowColor = '#00f3ff';
            ctx.shadowBlur = 20;
            ctx.fillText('LEVEL ' + currentLevel + ' COMPLETE!', GAME_WIDTH/2, GAME_HEIGHT/2);
        }
        ctx.shadowBlur = 0;
    }
}

function gameLoop() {
    if (!isPlaying) return;
    update();
    draw();
    gameLoopId = requestAnimationFrame(gameLoop);
}

function startGame() {
    startBtn.blur();
    restartBtn.blur();
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    isPlaying = true;
    initLevel(true); // true means it's a new game (resets score to 0)
    gameLoop();
}

function gameOver() {
    isPlaying = false;
    stopMusic();
    stopUfoSound();
    cancelAnimationFrame(gameLoopId);
    
    if (!hasWon) {
        playGameOver();
        document.querySelector('#gameOverScreen h2').innerText = 'GAME OVER';
    } else {
        document.querySelector('#gameOverScreen h2').innerText = 'VICTORY!';
    }
    
    finalScoreElement.innerText = score;
    gameOverScreen.classList.remove('hidden');
}

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

// Draw initial state before starting
ctx.fillStyle = 'rgba(0, 0, 0, 1)';
ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
