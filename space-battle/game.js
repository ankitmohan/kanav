const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Audio setup for cool laser sounds!
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playLaserSound() {
    // Only play if the browser lets us
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.type = 'square'; // Sounds like a retro game
    
    // Sweep the frequency down fast to make a "pew" sound!
    oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);
    
    // Make it fade out quickly
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.1);
}

function playExplosionSound() {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    
    // Create white noise for an explosion
    const bufferSize = audioCtx.sampleRate * 0.2; // 0.2 seconds of noise
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1; // Random white noise
    }
    
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    
    const gainNode = audioCtx.createGain();
    
    // Lowpass filter to make it sound muffled/bassy like an explosion
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1000;
    
    // Fade out
    gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
    
    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    noise.start();
}

// Spaceship object
const ship = {
    x: canvas.width / 2,
    y: canvas.height - 150, // Spawn lower on the screen!
    width: 150, // Size of the ship
    height: 150,
    speed: 7, // How fast it moves
    dx: 0,
    dy: 0,
    image: new Image(),
    lastShotTime: 0,
    shotCooldown: 250 // Milliseconds between shots
};

// Load the image that you attached!
// We're now using the transparent version!
ship.image.src = 'spaceship_transparent.png';

// Lasers!
const lasers = [];

// Explosions!
const explosions = [];
const boomImage = new Image();
boomImage.src = 'boom_transparent.png'; // Using the fixed transparent image

// Evil Aliens!
const aliens = [];
const alienImages = [];
for (let i = 1; i <= 5; i++) {
    const img = new Image();
    img.src = `alien${i}_transparent.png`;
    alienImages.push(img);
}

// Twinkling stars for the background
const stars = [];
for (let i = 0; i < 150; i++) {
    stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 2,
        speed: Math.random() * 0.5 + 0.1
    });
}

function drawStars() {
    ctx.fillStyle = 'white';
    stars.forEach(star => {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fill();
        star.y += star.speed; // Move stars down slowly to look like we're flying up
        if (star.y > canvas.height) {
            star.y = 0;
            star.x = Math.random() * canvas.width;
        }
    });
}

function drawShip() {
    // If the image is loaded, draw it!
    if (ship.image.complete && ship.image.naturalHeight !== 0) {
        ctx.drawImage(ship.image, ship.x - ship.width / 2, ship.y - ship.height / 2, ship.width, ship.height);
    } else {
        // Just in case the image isn't there yet, draw a cool blue triangle
        ctx.fillStyle = '#00aaff';
        ctx.beginPath();
        ctx.moveTo(ship.x, ship.y - ship.height / 2);
        ctx.lineTo(ship.x + ship.width / 2, ship.y + ship.height / 2);
        ctx.lineTo(ship.x - ship.width / 2, ship.y + ship.height / 2);
        ctx.closePath();
        ctx.fill();
    }
}

function moveShip() {
    ship.x += ship.dx;
    ship.y += ship.dy;

    // Keep the spaceship inside the screen!
    if (ship.x - ship.width / 2 < 0) ship.x = ship.width / 2;
    if (ship.x + ship.width / 2 > canvas.width) ship.x = canvas.width - ship.width / 2;
    if (ship.y - ship.height / 2 < 0) ship.y = ship.height / 2;
    if (ship.y + ship.height / 2 > canvas.height) ship.y = canvas.height - ship.height / 2;
}

function drawLasers() {
    ctx.fillStyle = '#ff0055'; // Cool pink/red lasers
    lasers.forEach(laser => {
        // Draw a glowing laser beam
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff0055';
        ctx.fillRect(laser.x - 3, laser.y, 6, 25);
        ctx.shadowBlur = 0; // Reset shadow for other things
    });
}

function moveLasers() {
    for (let i = lasers.length - 1; i >= 0; i--) {
        lasers[i].y -= lasers[i].speed;
        
        // Remove laser if it goes off the top of the screen
        if (lasers[i].y < -30) {
            lasers.splice(i, 1);
        }
    }
}

let formationOffsetX = 0;
let formationOffsetY = 0;
let formationDirection = 1; 

let score = 0;
let lives = 3;
let isGameOver = false;

function createAlienWave() {
    formationOffsetY = 0; // Reset height for new wave!
    
    // Calculate how to center the 8 columns perfectly
    const numCols = 8;
    const spacingX = 120;
    const totalFormationWidth = (numCols - 1) * spacingX;
    const startX = (canvas.width - totalFormationWidth) / 2;

    for (let row = 0; row < 5; row++) {
        for (let col = 0; col < numCols; col++) {
            // Target slot in the formation (centered perfectly!)
            const tx = startX + col * spacingX;
            const ty = row * 110 + 250; // Pushed down significantly so the grid is lower!
            
            // Start off-screen
            const spawnX = Math.random() > 0.5 ? -200 : canvas.width + 200;
            const spawnY = -100 - Math.random() * 200;
            
            aliens.push({
                x: spawnX,
                y: spawnY,
                tx: tx,
                ty: ty,
                width: 100,
                height: 100,
                image: alienImages[row],
                state: 'ENTER' // States: 'ENTER', 'IDLE', 'DIVE'
            });
        }
    }
}

// Create the very first wave!
createAlienWave();

function drawAliens() {
    aliens.forEach(alien => {
        if (alien.image && alien.image.complete && alien.image.naturalHeight !== 0) {
            ctx.drawImage(alien.image, alien.x - alien.width / 2, alien.y - alien.height / 2, alien.width, alien.height);
        } else {
            // Fallback green scary circle
            ctx.fillStyle = '#00ff55';
            ctx.beginPath();
            ctx.arc(alien.x, alien.y, alien.width / 2, 0, Math.PI * 2);
            ctx.fill();
        }
    });
}

function moveAndCheckAliens() {
    // Move the global formation offset
    formationOffsetX += 2 * formationDirection;
    if (formationOffsetX > 100 || formationOffsetX < -100) {
        formationDirection *= -1;
        // Removed the Space Invaders dropping so it feels purely like Galaga again!
    }
    
    for (let i = aliens.length - 1; i >= 0; i--) {
        let alien = aliens[i];
        
        // Save old position to calculate exact momentum for explosions!
        let oldX = alien.x;
        let oldY = alien.y;
        
        // Galaga Brains!
        if (alien.state === 'ENTER') {
            // Swoop into formation using smooth math (lerp)
            let targetX = alien.tx + formationOffsetX;
            let targetY = alien.ty + formationOffsetY;
            alien.x += (targetX - alien.x) * 0.05;
            alien.y += (targetY - alien.y) * 0.05;
            
            // If they are really close to their slot, lock in
            let distToTarget = Math.abs(targetX - alien.x) + Math.abs(targetY - alien.y);
            if (distToTarget < 5) {
                alien.state = 'IDLE';
            }
        } 
        else if (alien.state === 'IDLE') {
            // Stay in formation
            alien.x = alien.tx + formationOffsetX;
            alien.y = alien.ty + formationOffsetY;
            
            // Random chance to break formation and dive bomb!
            if (Math.random() < 0.0002) { // Extremely low chance so very few dive at once!
                alien.state = 'DIVE';
            }
        }
        else if (alien.state === 'DIVE') {
            // Dive down slowly, and slightly steer towards the player
            alien.y += 4; // Slow diving speed
            alien.x += (ship.x - alien.x) * 0.01; 
            
            // If they miss and fly off the bottom, wrap back to the top
            if (alien.y > canvas.height + 100) {
                alien.y = -100;
                alien.state = 'ENTER'; // Go back to formation
            }
        }

        // Calculate momentum for explosions
        let alienDx = alien.x - oldX;
        let alienDy = alien.y - oldY;

        // Check collision with lasers
        let hit = false;
        for (let j = lasers.length - 1; j >= 0; j--) {
            let laser = lasers[j];
            
            let dx = alien.x - laser.x;
            let dy = alien.y - laser.y;
            let distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < alien.width / 2) {
                // Boom! Alien destroyed!
                playExplosionSound();
                explosions.push({
                    x: alien.x,
                    y: alien.y,
                    dx: alienDx, // Keep their exact momentum!
                    dy: alienDy,
                    timer: 15
                });
                score += 10; // Earn points!
                aliens.splice(i, 1);
                lasers.splice(j, 1);
                hit = true;
                break; 
            }
        }
        if (hit) continue; // Skip to next alien if this one blew up
        
        // Check if the alien crashed into the spaceship!
        let shipDx = alien.x - ship.x;
        let shipDy = alien.y - ship.y;
        let shipDistance = Math.sqrt(shipDx * shipDx + shipDy * shipDy);
        
        // Use 0.6 multiplier to make the collision box slightly smaller than the image so it feels fair
        if (shipDistance < (alien.width / 2 + ship.width / 2) * 0.6) {
            // Crash!
            playExplosionSound();
            explosions.push({
                x: alien.x,
                y: alien.y,
                dx: alienDx,
                dy: alienDy,
                timer: 15
            });
            aliens.splice(i, 1); // Destroy the alien that hit us
            lives--; // Lose a life
            
            if (lives <= 0) {
                isGameOver = true;
            }
        }
    }
    
    // Did you defeat them all?
    if (aliens.length === 0) {
        createAlienWave();
    }
}

function drawExplosions() {
    for (let i = explosions.length - 1; i >= 0; i--) {
        let exp = explosions[i];
        
        // Move the explosion!
        exp.x += exp.dx;
        exp.y += exp.dy;
        
        if (boomImage.complete && boomImage.naturalHeight !== 0) {
            // Make it grow and fade slightly based on the timer
            let size = 100 + (15 - exp.timer) * 5;
            ctx.globalAlpha = exp.timer / 15; // Fade out
            
            ctx.drawImage(boomImage, exp.x - size / 2, exp.y - size / 2, size, size);
            
            // Reset alpha
            ctx.globalAlpha = 1.0;
        }
        
        exp.timer--;
        if (exp.timer <= 0) {
            explosions.splice(i, 1);
        }
    }
}

function drawUI() {
    ctx.fillStyle = 'white';
    ctx.font = '30px "Inter", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${score}`, 20, 50);
    
    ctx.textAlign = 'right';
    let livesText = '❤️'.repeat(lives);
    ctx.fillText(`Lives: ${livesText}`, canvas.width - 20, 50);
    
    if (isGameOver) {
        ctx.fillStyle = 'red';
        ctx.font = '80px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2);
        
        ctx.fillStyle = 'white';
        ctx.font = '40px "Inter", sans-serif';
        ctx.fillText('Refresh the page to try again!', canvas.width / 2, canvas.height / 2 + 60);
    }
}

function update() {
    if (isGameOver) {
        // Draw the final frame and Game Over text, then stop updating
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawStars();
        drawExplosions();
        drawUI();
        return; 
    }

    // Clear the screen to draw the next frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    drawStars();
    drawShip();
    drawLasers();
    drawAliens();
    drawExplosions();
    drawUI();
    
    moveLasers();
    moveAndCheckAliens();
    moveShip();
    
    // Ask the browser to draw the next frame
    requestAnimationFrame(update);
}

// Listen for arrow keys and spacebar!
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') ship.dx = ship.speed;
    else if (e.key === 'ArrowLeft') ship.dx = -ship.speed;
    else if (e.key === 'ArrowUp') ship.dy = -ship.speed;
    else if (e.key === 'ArrowDown') ship.dy = ship.speed;
    
    // Pew pew! Shoot laser when Space is pressed
    if (e.code === 'Space') {
        const currentTime = Date.now();
        // Check if we have fewer than 3 lasers and enough time has passed!
        if (lasers.length < 3 && currentTime - ship.lastShotTime > ship.shotCooldown) {
            lasers.push({
                x: ship.x,
                y: ship.y - ship.height / 2, // Comes out of the front
                speed: 15
            });
            playLaserSound();
            ship.lastShotTime = currentTime;
        }
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') ship.dx = 0;
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') ship.dy = 0;
});

// Handle window resizing
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

// Start the game loop!
update();
