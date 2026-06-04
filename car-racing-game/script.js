const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const carImage = new Image();
carImage.src = 'f1-car-transparent.png';

// Grass Texture (Reduced noise)
const grassCanvas = document.createElement('canvas');
grassCanvas.width = 150;
grassCanvas.height = 150;
const gCtx = grassCanvas.getContext('2d');
gCtx.fillStyle = '#27ae60'; 
gCtx.fillRect(0, 0, 150, 150);
for (let i = 0; i < 500; i++) { // Reduced from 4000 for less noise
    gCtx.fillStyle = Math.random() > 0.5 ? '#2ecc71' : '#229954';
    gCtx.fillRect(Math.random() * 150, Math.random() * 150, 2, 8); 
}
const grassPattern = ctx.createPattern(grassCanvas, 'repeat');

// Asphalt Texture (Reduced noise)
const asphaltCanvas = document.createElement('canvas');
asphaltCanvas.width = 100;
asphaltCanvas.height = 100;
const aCtx = asphaltCanvas.getContext('2d');
aCtx.fillStyle = '#2c3e50';
aCtx.fillRect(0, 0, 100, 100);
for (let i = 0; i < 600; i++) { // Reduced from 3000 for less noise
    let grey = Math.floor(Math.random() * 20) + 30; // Closer to asphalt color
    aCtx.fillStyle = `rgba(${grey}, ${grey}, ${grey}, 0.5)`;
    aCtx.fillRect(Math.random() * 100, Math.random() * 100, 1.5, 1.5); 
}
const asphaltPattern = ctx.createPattern(asphaltCanvas, 'repeat');
// ----------------------------

let keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false, w: false, a: false, s: false, d: false };

document.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = true;
});
document.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = false;
});

const waypoints = [
    {x: 600, y: 1500}, // Start line
    {x: 1200, y: 1500},
    {x: 1500, y: 1200}, 
    {x: 1500, y: 800},  
    {x: 1200, y: 500},  
    {x: 800, y: 800},   
    {x: 500, y: 500},   
    {x: 200, y: 800},   
    {x: 100, y: 1500}
];

function distToSegmentSquared(p, v, w) {
  let l2 = (w.x - v.x)**2 + (w.y - v.y)**2;
  if (l2 === 0) return (p.x - v.x)**2 + (p.y - v.y)**2;
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return (p.x - (v.x + t * (w.x - v.x)))**2 + (p.y - (v.y + t * (w.y - v.y)))**2;
}

function getDistToTrack(x, y) {
    let minDistSq = Infinity;
    for (let i = 0; i < waypoints.length; i++) {
        let v = waypoints[i];
        let w = waypoints[(i + 1) % waypoints.length];
        let distSq = distToSegmentSquared({x, y}, v, w);
        if (distSq < minDistSq) minDistSq = distSq;
    }
    return Math.sqrt(minDistSq);
}

class Car {
    constructor(x, y, color, isPlayer, offsetX, offsetY, hueRotate = 0, name) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.name = name;
        this.isPlayer = isPlayer;
        this.hueRotate = hueRotate;
        this.angle = 0; 
        this.speed = 0;
        this.maxSpeed = 5.0; 
        this.turnSpeed = 0.12; 
        this.targetWaypoint = 1;
        this.offsetX = offsetX;
        this.offsetY = offsetY;
        
        this.waypointsPassed = 0;
        this.lap = 1;
        this.distToNext = 0;
    }

    update() {
        let target = waypoints[this.targetWaypoint];
        let tx = target.x + this.offsetX;
        let ty = target.y + this.offsetY;
        let dx = tx - this.x;
        let dy = ty - this.y;
        this.distToNext = Math.sqrt(dx*dx + dy*dy);
        
        let hitTarget = false;
        if (this.targetWaypoint === 0) {
            // The finish line is exactly at x=600. Must physically cross it!
            if (this.x >= 600) {
                hitTarget = true;
            }
        } else {
            // For other corners, start turning early
            if (this.distToNext < 300) {
                hitTarget = true;
            }
        }

        if (hitTarget) {
            this.targetWaypoint = (this.targetWaypoint + 1) % waypoints.length;
            this.waypointsPassed++;
            if (this.targetWaypoint === 1) {
                this.lap++;
            }
        }

        if (this.isPlayer) {
            if (keys.ArrowUp || keys.w) {
                this.speed += 0.3;
                if (this.speed > this.maxSpeed) this.speed = this.maxSpeed;
            } else if (keys.ArrowDown || keys.s) {
                this.speed -= 0.3;
                if (this.speed < -this.maxSpeed / 2) this.speed = -this.maxSpeed / 2;
            } else {
                this.speed *= 0.95;
            }

            if (Math.abs(this.speed) > 0.5) {
                if (keys.ArrowLeft || keys.a) this.angle -= this.turnSpeed;
                if (keys.ArrowRight || keys.d) this.angle += this.turnSpeed;
            }
        } else {
            this.speed += 0.2;
            if (this.speed > this.maxSpeed) this.speed = this.maxSpeed;

            let targetAngle = Math.atan2(dy, dx);
            let angleDiff = targetAngle - this.angle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            
            if (angleDiff > this.turnSpeed) this.angle += this.turnSpeed;
            else if (angleDiff < -this.turnSpeed) this.angle -= this.turnSpeed;
            else this.angle = targetAngle;
        }

        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;

        let dist = getDistToTrack(this.x, this.y);
        if (dist > 125) {
            this.speed *= 0.8; 
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        ctx.rotate(Math.PI);
        
        // Add brightness and saturation to make colors pop, plus the hue shift!
        ctx.filter = `hue-rotate(${this.hueRotate}deg) brightness(1.4) saturate(1.8)`;
        
        ctx.drawImage(carImage, -40, -15, 80, 30);

        ctx.filter = 'none';
        
        ctx.restore();
    }
}

let cars = [];
cars.push(new Car(550, 1470, 'red', true, 0, -30, 0, 'You (Red)'));       
cars.push(new Car(450, 1530, 'blue', false, -30, 30, 220, 'Blue'));  
cars.push(new Car(350, 1470, 'lime', false, -60, -30, 100, 'Green')); 
cars.push(new Car(250, 1530, 'yellow', false, -90, 30, 60, 'Yellow')); 
cars.push(new Car(150, 1470, '#9b59b6', false, -120, -30, 280, 'Purple')); 

let raceState = 'countdown'; // 'countdown', 'racing', 'finished'
let countdownTime = 3;
let lastTime = null;
let timerAccumulator = 0;
let winnerName = null;
let currentLeaderboard = cars; // Initialize to start grid order

function checkBumperCollisions() {
    for (let i = 0; i < cars.length; i++) {
        for (let j = i + 1; j < cars.length; j++) {
            let c1 = cars[i];
            let c2 = cars[j];
            let dx = c1.x - c2.x;
            let dy = c1.y - c2.y;
            let dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist < 45) {
                let overlap = 45 - dist;
                let pushX = (dx / dist) * overlap * 0.5;
                let pushY = (dy / dist) * overlap * 0.5;
                
                c1.x += pushX;
                c1.y += pushY;
                c2.x -= pushX;
                c2.y -= pushY;
                
                c1.speed *= 0.9;
                c2.speed *= 0.9;
            }
        }
    }
}

function drawTrack() {
    ctx.fillStyle = grassPattern;
    ctx.fillRect(-1000, -1000, 4000, 4000);

    ctx.beginPath();
    ctx.moveTo(waypoints[0].x, waypoints[0].y);
    for (let i = 1; i < waypoints.length; i++) {
        ctx.lineTo(waypoints[i].x, waypoints[i].y);
    }
    ctx.closePath();
    
    ctx.strokeStyle = '#e74c3c'; 
    ctx.lineWidth = 270;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.strokeStyle = 'white';
    ctx.lineWidth = 270;
    ctx.setLineDash([60, 60]);
    ctx.stroke();
    ctx.setLineDash([]); 

    ctx.beginPath();
    ctx.moveTo(waypoints[0].x, waypoints[0].y);
    for (let i = 1; i < waypoints.length; i++) {
        ctx.lineTo(waypoints[i].x, waypoints[i].y);
    }
    ctx.closePath();
    ctx.strokeStyle = asphaltPattern;
    ctx.lineWidth = 250; 
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(waypoints[0].x, waypoints[0].y);
    for (let i = 1; i < waypoints.length; i++) {
        ctx.lineTo(waypoints[i].x, waypoints[i].y);
    }
    ctx.closePath();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 4;
    ctx.setLineDash([30, 30]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Starting Line
    ctx.save();
    ctx.translate(600, 1500); 
    ctx.fillStyle = 'white';
    for (let i = -12; i <= 12; i++) {
        if (i % 2 === 0) ctx.fillRect(-10, i * 10, 10, 10);
    }
    ctx.fillStyle = 'black';
    for (let i = -12; i <= 12; i++) {
        if (i % 2 !== 0) ctx.fillRect(-10, i * 10, 10, 10);
    }
    
    // F1 Grid Boxes
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 4;
    ctx.strokeRect(-95, -45, 90, 30); 
    ctx.strokeRect(-195, 15, 90, 30);  
    ctx.strokeRect(-295, -45, 90, 30); 
    ctx.strokeRect(-395, 15, 90, 30);  
    ctx.strokeRect(-495, -45, 90, 30); 
    
    ctx.restore();
}

function drawMiniMap() {
    let mapWidth = 200;
    let mapHeight = 200;
    let mapX = canvas.width - mapWidth - 20;
    let mapY = 20;
    let scale = mapWidth / 2000;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(mapX, mapY, mapWidth, mapHeight);

    ctx.beginPath();
    ctx.moveTo(mapX + waypoints[0].x * scale, mapY + waypoints[0].y * scale);
    for (let i = 1; i < waypoints.length; i++) {
        ctx.lineTo(mapX + waypoints[i].x * scale, mapY + waypoints[i].y * scale);
    }
    ctx.closePath();
    ctx.strokeStyle = '#95a5a6';
    ctx.lineWidth = 12;
    ctx.lineJoin = 'round';
    ctx.stroke();

    cars.forEach(car => {
        let cx = mapX + car.x * scale;
        let cy = mapY + car.y * scale;
        
        ctx.beginPath();
        ctx.arc(cx, cy, car.isPlayer ? 6 : 4, 0, Math.PI * 2);
        ctx.fillStyle = car.color;
        ctx.fill();
        
        if (car.isPlayer) {
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    });
}

function drawLeaderboard(sortedCars) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(20, 20, 260, 230);
    
    ctx.fillStyle = 'white';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('🏆 Live Rankings', 40, 55);
    
    ctx.font = 'bold 20px Arial';
    for (let i = 0; i < sortedCars.length; i++) {
        let car = sortedCars[i];
        let y = 95 + (i * 32);
        
        ctx.fillStyle = car.color;
        if (car.color === 'lime') ctx.fillStyle = '#2ecc71';
        
        let text = `${i + 1}. ${car.name} - Lap ${car.lap > 2 ? 2 : car.lap}/2`;
        ctx.fillText(text, 40, y);
    }
}

function gameLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    let dt = timestamp - lastTime;
    lastTime = timestamp;

    if (raceState === 'countdown') {
        timerAccumulator += dt;
        if (timerAccumulator > 1000) {
            timerAccumulator -= 1000;
            countdownTime--;
            if (countdownTime < 0) {
                raceState = 'racing';
            }
        }
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    
    let player = cars[0];
    ctx.translate(canvas.width / 2 - player.x, canvas.height / 2 - player.y);

    drawTrack();
    
    if (raceState === 'racing') {
        cars.forEach(car => {
            car.update();
        });
        checkBumperCollisions();
        
        // Sort for leaderboard
        currentLeaderboard = [...cars].sort((a, b) => {
            if (a.waypointsPassed !== b.waypointsPassed) {
                return b.waypointsPassed - a.waypointsPassed;
            }
            return a.distToNext - b.distToNext;
        });

        // Win condition! (Lap 3 means they finished lap 2)
        if (currentLeaderboard[0].lap > 2) {
            raceState = 'finished';
            winnerName = currentLeaderboard[0].name;
        }
    }

    cars.forEach(car => {
        car.draw(ctx);
    });

    ctx.restore();
    
    drawMiniMap();
    drawLeaderboard(currentLeaderboard);
    
    if (raceState === 'countdown') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#f1c40f'; 
        ctx.font = 'bold 120px Comic Sans MS, Arial';
        ctx.textAlign = 'center';
        
        let text = countdownTime > 0 ? countdownTime : "GO!";
        ctx.shadowColor = "black";
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 5;
        ctx.shadowOffsetY = 5;
        ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 40);
        ctx.shadowColor = "transparent";
    }

    if (raceState === 'finished') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#f1c40f'; 
        ctx.font = 'bold 80px Comic Sans MS, Arial';
        ctx.textAlign = 'center';
        ctx.fillText('🏁 RACE FINISHED! 🏁', canvas.width / 2, canvas.height / 2 - 40);
        
        ctx.fillStyle = 'white';
        ctx.font = 'bold 45px Comic Sans MS, Arial';
        ctx.fillText(`WINNER: ${winnerName}`, canvas.width / 2, canvas.height / 2 + 40);
        
        ctx.font = '24px Comic Sans MS, Arial';
        ctx.fillText('Refresh the page to race again!', canvas.width / 2, canvas.height / 2 + 100);
        return; 
    }

    requestAnimationFrame(gameLoop);
}

// Start the game!
requestAnimationFrame(gameLoop);
