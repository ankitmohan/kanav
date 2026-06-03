const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score-display');
const posDisplay = document.getElementById('pos-display');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

const pixelCarImg = new Image();
let transparentCarCanvas = null;

pixelCarImg.onload = function() {
    transparentCarCanvas = document.createElement('canvas');
    transparentCarCanvas.width = pixelCarImg.width;
    transparentCarCanvas.height = pixelCarImg.height;
    const offCtx = transparentCarCanvas.getContext('2d');
    offCtx.drawImage(pixelCarImg, 0, 0);
    
    try {
        const imgData = offCtx.getImageData(0, 0, transparentCarCanvas.width, transparentCarCanvas.height);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
            let r = data[i], g = data[i+1], b = data[i+2];
            let max = Math.max(r, g, b);
            let min = Math.min(r, g, b);
            
            // Remove gray border pixels: low saturation, medium-to-high brightness
            // We keep pure white (> 240) for the racing stripes, and dark black (< 80) for the tires.
            if (max - min < 20 && max > 80 && max < 240) {
                data[i+3] = 0; // Make transparent
            }
        }
        offCtx.putImageData(imgData, 0, 0);
    } catch(e) {
        console.log("Could not remove background: ", e);
    }
};
pixelCarImg.src = 'pixel_ferrari.png';

// Race Configuration
const MAX_LAPS = 1;
const MAX_SPEED = 6; 
const GRASS_SPEED = 1.5; 
const ACCELERATION = 0.1;
const STEER_SPEED = 0.05; 

let gameLoop;
let isPlaying = false;
let raceFinished = false;

// Generate a perfectly smooth oval track so AI NEVER goes on the grass
const rawWaypoints = [];
// Bottom straight (moving right)
for (let x = 800; x <= 1800; x += 50) rawWaypoints.push({x: x, y: 1500});
// Right curve (semi-circle)
for (let angle = Math.PI/2; angle >= -Math.PI/2; angle -= 0.1) {
    rawWaypoints.push({x: 1800 + Math.cos(angle) * 500, y: 1000 + Math.sin(angle) * 500});
}
// Top straight (moving left)
for (let x = 1800; x >= 800; x -= 50) rawWaypoints.push({x: x, y: 500});
// Left curve (semi-circle)
for (let angle = -Math.PI/2; angle >= -3*Math.PI/2; angle -= 0.1) {
    rawWaypoints.push({x: 800 + Math.cos(angle) * 500, y: 1000 + Math.sin(angle) * 500});
}

let trackPoints = []; 
let cars = [];

function generateTrackPoints() {
    trackPoints = [];
    for (let i = 0; i < rawWaypoints.length; i++) {
        let p1 = rawWaypoints[i];
        let p2 = rawWaypoints[(i + 1) % rawWaypoints.length];
        let dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        let steps = Math.max(1, Math.floor(dist / 20));
        for (let j = 0; j < steps; j++) {
            trackPoints.push({
                x: p1.x + (p2.x - p1.x) * (j / steps),
                y: p1.y + (p2.y - p1.y) * (j / steps),
                index: trackPoints.length
            });
        }
    }
}

const keys = {
    ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false,
    w: false, s: false, a: false, d: false
};
document.addEventListener('keydown', (e) => { if (keys.hasOwnProperty(e.key)) keys[e.key] = true; });
document.addEventListener('keyup', (e) => { if (keys.hasOwnProperty(e.key)) keys[e.key] = false; });

function setupRace() {
    generateTrackPoints();
    raceFinished = false;
    
    const colors = ['red', 'blue', 'green', 'yellow', 'purple'];
    
    cars = [];
    for(let i = 0; i < 5; i++) {
        cars.push({
            id: i,
            isPlayer: i === 0,
            color: colors[i],
            x: 850, 
            y: 1500 - 60 + i * 30,
            angle: 0, 
            speed: 0,
            laps: 0,
            targetIndex: 10,
            lapProgress: 1, 
            totalProgress: 0
        });
    }
    scoreDisplay.textContent = `Laps: 0 / ${MAX_LAPS}`;
    posDisplay.textContent = `Position: 1st`;
}

function normalizeAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
}

function getClosestTrackPoint(car) {
    let minDist = Infinity;
    let closestIndex = 0;
    for (let i = 0; i < trackPoints.length; i++) {
        let pt = trackPoints[i];
        let d = Math.hypot(pt.x - car.x, pt.y - car.y);
        if (d < minDist) {
            minDist = d;
            closestIndex = i;
        }
    }
    return { index: closestIndex, distance: minDist };
}

function update() {
    if (!isPlaying) return;

    cars.forEach(car => {
        let closest = getClosestTrackPoint(car);
        let onGrass = closest.distance > 110;
        let currentMaxSpeed = onGrass ? GRASS_SPEED : MAX_SPEED;

        // --- MOVEMENT ---
        if (car.isPlayer) {
            if (keys.ArrowUp || keys.w) car.speed += ACCELERATION;
            else car.speed -= ACCELERATION;
            if (keys.ArrowLeft || keys.a) car.angle -= STEER_SPEED;
            if (keys.ArrowRight || keys.d) car.angle += STEER_SPEED;
        } else {
            car.speed += ACCELERATION;
            let lookAhead = 15;
            car.targetIndex = (closest.index + lookAhead) % trackPoints.length;
            let target = trackPoints[car.targetIndex];
            let laneOffset = (car.id - 2) * 30; 
            let trackDir = Math.atan2(
                trackPoints[(closest.index+5)%trackPoints.length].y - trackPoints[closest.index].y,
                trackPoints[(closest.index+5)%trackPoints.length].x - trackPoints[closest.index].x
            );
            let targetAngleToSteer = Math.atan2(
                target.y + Math.cos(trackDir)*laneOffset - car.y, 
                target.x - Math.sin(trackDir)*laneOffset - car.x
            );
            
            let diff = normalizeAngle(targetAngleToSteer - car.angle);
            
            if (diff > STEER_SPEED) car.angle += STEER_SPEED;
            else if (diff < -STEER_SPEED) car.angle -= STEER_SPEED;
        }

        if (car.speed > currentMaxSpeed) car.speed -= ACCELERATION * 2;
        if (car.speed < 0) car.speed = 0;

        car.x += Math.cos(car.angle) * car.speed;
        car.y += Math.sin(car.angle) * car.speed;

        // --- LAP LOGIC ---
        let progress = closest.index;
        if (car.lapProgress > trackPoints.length - 20 && progress < 20) {
            car.laps++;
            if (car.isPlayer) scoreDisplay.textContent = `Laps: ${car.laps} / ${MAX_LAPS}`;
            if (car.laps >= MAX_LAPS && !raceFinished) endRace(car);
        }
        car.lapProgress = progress;
        car.totalProgress = car.laps * trackPoints.length + progress;
    });

    let sortedCars = [...cars].sort((a, b) => b.totalProgress - a.totalProgress);
    let playerPos = sortedCars.findIndex(c => c.isPlayer) + 1;
    let suffix = "th";
    if (playerPos === 1) suffix = "st";
    else if (playerPos === 2) suffix = "nd";
    else if (playerPos === 3) suffix = "rd";
    posDisplay.textContent = `Position: ${playerPos}${suffix}`;
    
    // --- COLLISION LOGIC ---
    const playerCar = cars[0];
    for (let i = 1; i < cars.length; i++) {
        let ai = cars[i];
        let dist = Math.hypot(playerCar.x - ai.x, playerCar.y - ai.y);
        if (dist < 28) { 
            endRace(null, "CRASH! You hit another car!");
            return;
        }
    }

    draw();
    if (!raceFinished) {
        gameLoop = requestAnimationFrame(update);
    }
}

function drawTrackPath(ctx) {
    ctx.beginPath();
    ctx.moveTo(rawWaypoints[0].x, rawWaypoints[0].y);
    for (let i = 1; i < rawWaypoints.length; i++) {
        ctx.lineTo(rawWaypoints[i].x, rawWaypoints[i].y);
    }
    ctx.closePath();
}

function drawMinimap() {
    const scale = 0.05;
    const offsetX = canvas.width - 170;
    const offsetY = 70;
    
    ctx.fillStyle = 'rgba(50,50,50,0.8)';
    ctx.fillRect(offsetX, offsetY, 150, 150);
    
    ctx.save();
    ctx.translate(offsetX - 50, offsetY + 20);
    ctx.scale(scale, scale);
    
    ctx.lineWidth = 40;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#ffffff';
    drawTrackPath(ctx);
    ctx.stroke();
    
    cars.forEach(car => {
        ctx.fillStyle = car.color;
        ctx.beginPath();
        ctx.arc(car.x, car.y, 80, 0, Math.PI*2);
        ctx.fill();
    });
    ctx.restore();
}

function drawCar(car) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    
    const imgToDraw = transparentCarCanvas ? transparentCarCanvas : pixelCarImg;
    ctx.drawImage(imgToDraw, -25, -15, 50, 30);
    
    if (!car.isPlayer) {
        ctx.globalCompositeOperation = 'hue';
        ctx.fillStyle = car.color;
        ctx.fillRect(-25, -15, 50, 30);
        ctx.globalCompositeOperation = 'source-over';
    }
    
    ctx.restore();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    const playerCar = cars[0];
    
    const zoom = 1.8;
    let camX = canvas.width / 2 - playerCar.x * zoom;
    let camY = canvas.height / 2 - playerCar.y * zoom;
    ctx.translate(camX, camY);
    ctx.scale(zoom, zoom);

    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(-2000, -2000, 7000, 7000);

    ctx.lineJoin = 'round';
    
    ctx.lineWidth = 230;
    ctx.strokeStyle = '#e74c3c';
    ctx.setLineDash([20, 20]);
    drawTrackPath(ctx);
    ctx.stroke();
    
    ctx.lineWidth = 220;
    ctx.strokeStyle = '#ffffff';
    ctx.setLineDash([]);
    drawTrackPath(ctx);
    ctx.stroke();
    
    ctx.lineWidth = 200;
    ctx.strokeStyle = '#606060';
    drawTrackPath(ctx);
    ctx.stroke();
    
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ffffff';
    ctx.setLineDash([20, 30]);
    drawTrackPath(ctx);
    ctx.stroke();
    ctx.setLineDash([]);
    
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    for(let i = 0; i < 5; i++) {
        let gridX = 850;
        let gridY = 1500 - 60 + i * 30;
        ctx.strokeRect(gridX - 25, gridY - 15, 50, 30);
    }
    
    ctx.save();
    ctx.translate(rawWaypoints[0].x, rawWaypoints[0].y);
    ctx.fillStyle = '#ffffff';
    for (let c = -5; c < 5; c++) { 
        for (let r = -1; r < 1; r++) {
            if ((r + c) % 2 === 0) ctx.fillStyle = '#ffffff';
            else ctx.fillStyle = '#000000';
            ctx.fillRect(r * 10, c * 20, 10, 20); 
        }
    }
    ctx.restore();

    cars.forEach(car => drawCar(car));
    ctx.restore();

    drawMinimap();
}

function endRace(winningCar, crashMessage = null) {
    isPlaying = false;
    raceFinished = true;
    cancelAnimationFrame(gameLoop);
    gameOverScreen.classList.remove('hidden');
    
    const title = document.querySelector('#game-over h2');
    const msg = document.querySelector('#game-over p');
    
    if (crashMessage) {
        title.textContent = "💥 TOTALLED! 💥";
        msg.textContent = crashMessage;
    } else if (winningCar.isPlayer) {
        title.textContent = "🏆 YOU WON! 🏆";
        msg.textContent = "You are the champion!";
    } else {
        title.textContent = "🏁 Race Over!";
        msg.textContent = `The ${winningCar.color} car won! Try again!`;
    }
    
    document.getElementById('restart-btn').textContent = "Race Again!";
    draw();
}

function startGame() {
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    setupRace();
    isPlaying = true;
    update();
}

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

document.querySelector('#start-screen p').innerHTML = "Up Arrow to Drive <br> Don't crash!";
startBtn.disabled = false;
setupRace();
draw();
