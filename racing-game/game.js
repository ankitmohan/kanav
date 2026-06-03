const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('start-screen');
const winScreen = document.getElementById('win-screen');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const posDisplay = document.getElementById('pos-display');
const distDisplay = document.getElementById('dist-display');

const CANVAS_W = 400;
const CANVAS_H = 600;
const ROAD_W = 400;

let cars = [];
const CAR_COLORS = ['#FF0000', '#0000FF', '#00FF00', '#FFFF00', '#800080']; 
let skidMarks = [];
let grassPattern = null;
let carSprite = null;
let rearCarImg = null;

const carImg = new Image();
carImg.src = 'car_transparent.png?' + Date.now();
carImg.onload = () => { carSprite = carImg; };

const rearImg = new Image();
rearImg.src = 'rear_transparent.png?' + Date.now();
rearImg.onload = () => { rearCarImg = rearImg; };

let isRacing = false;
let keys = {};
let totalLaps = 19;
let raceMode = 'sprint';
let countdownTimer = 0;
let isCountdown = false;
let isFormationLap = true;
let particles = [];
let gridStarts = [];
let sceneryParkedCars = [];
window.addEventListener('keydown', e => {
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) e.preventDefault();
    keys[e.key] = true;
});
window.addEventListener('keyup', e => keys[e.key] = false);

const waypoints = [
    {x: 0, y: 0},           
    {x: 6750, y: 0},        
    {x: 9000, y: -2250},     
    {x: 9000, y: -6750},    
    {x: 6750, y: -9000},    
    {x: -6750, y: -9000},   
    {x: -9000, y: -6750},   
    {x: -9000, y: -2250},    
    {x: -6750, y: 0},       
    {x: 0, y: 0}            
];

class Car {
    constructor(id, color, startX, startY) {
        this.id = id;
        this.color = color;
        this.x = startX;
        this.y = startY;
        this.angle = 0; 
        this.speed = 0;
        this.isPlayer = (id === 0);
        this.maxSpeed = this.isPlayer ? 10 : (9.2 + Math.random() * 0.6); // Random max speed between 9.2 and 9.8
        this.acceleration = this.isPlayer ? 0.2 : (0.18 + Math.random() * 0.04); // Random acceleration
        this.turnSpeed = this.isPlayer ? 0.06 : 0.12;
        
        this.trackOffset = 0; // AI Lane offset
        this.targetOffset = 0; // The lane they want to be in
        this.isParked = false;
        
        this.width = 40; 
        this.height = 24; 
        
        this.targetWaypoint = 1;
        this.laps = 0;
        
        this.steerAngle = 0;
        this.isAccelerating = false;
        this.isBraking = false;
        
        this.lapsSincePit = 0;
        this.isInPit = false;
        this.pitTimer = 0;
        this.tireHealth = 100;
    }
}

function initGame() {
    if (!grassPattern) {
        const pCanv = document.createElement('canvas');
        pCanv.width = 100; pCanv.height = 100;
        const pCtx = pCanv.getContext('2d');
        pCtx.fillStyle = '#4CAF50';
        pCtx.fillRect(0,0,100,100);
        pCtx.fillStyle = '#45a049';
        for(let i=0; i<300; i++) pCtx.fillRect(Math.random()*100, Math.random()*100, 2, 2);
        pCtx.fillStyle = '#388E3C';
        for(let i=0; i<150; i++) pCtx.fillRect(Math.random()*100, Math.random()*100, 3, 3);
        grassPattern = ctx.createPattern(pCanv, 'repeat');
    }
    
    skidMarks = [];
    particles = [];
    cars = [];
    gridStarts = [];
    isFormationLap = true;
    isCountdown = false;
    countdownTimer = 0;
    
    sceneryParkedCars = [];
    const colors = ['#2196F3', '#4CAF50', '#FFEB3B', '#9C27B0', '#FFFFFF', '#000000', '#FF5722', '#795548'];
    for(let px = -1900; px < -100; px += 200) {
        for(let py = -2900; py < -1600; py += 300) {
            for(let cx = 0; cx < 4; cx++) {
                if (Math.random() > 0.4) {
                    sceneryParkedCars.push({
                        x: px + 10 + cx*35,
                        y: py + 20 + Math.random()*20,
                        color: colors[Math.floor(Math.random()*colors.length)]
                    });
                }
            }
        }
    }
    
    for (let i = 0; i < 20; i++) {
        let row = Math.floor(i / 2); // 10 rows, 2 cars each
        let col = i % 2; // 0 (left) or 1 (right)
        
        let baseX = -60 - (row * 70); 
        let baseY = col === 0 ? -80 : 80; 
        
        gridStarts.push({x: baseX, y: baseY});
        
        let laneIndex = i % 8; // 8 distinct lanes
        let offset = -140 + laneIndex * 40; 
        
        // Use Red as base, drawing logic will handle the 10 distinct colors!
        let c = new Car(i, '#FF0000', baseX, baseY);
        c.trackOffset = offset;
        c.targetOffset = offset;
        cars.push(c);
    }
}

function distToSegment(p, v, w) {
    let l2 = (w.x - v.x)**2 + (w.y - v.y)**2;
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}

function getMinDistToTrack(x, y) {
    let minDist = Infinity;
    for(let i=0; i<waypoints.length-1; i++) {
        let d = distToSegment({x,y}, waypoints[i], waypoints[i+1]);
        if (d < minDist) minDist = d;
    }
    return minDist;
}

function drawCar(car) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    
    // Draw the car directly on the canvas

    if (car.isAccelerating) {
        ctx.fillStyle = '#FF9800';
        ctx.beginPath();
        ctx.moveTo(-20, 0);
        ctx.lineTo(-25 - Math.random()*8, -3);
        ctx.lineTo(-30 - Math.random()*8, 0);
        ctx.lineTo(-25 - Math.random()*8, 3);
        ctx.fill();
        ctx.fillStyle = '#FFEB3B';
        ctx.beginPath();
        ctx.moveTo(-20, 0);
        ctx.lineTo(-23 - Math.random()*4, -1);
        ctx.lineTo(-26 - Math.random()*4, 0);
        ctx.lineTo(-23 - Math.random()*4, 1);
        ctx.fill();
    }

    if (carSprite) {
        if (!car.isPlayer) {
            let hue = (car.id % 10) * 36; // 10 distinct colors, repeated twice!
            if (hue > 0) ctx.filter = `hue-rotate(${hue}deg)`;
        }
        
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 4;
        ctx.shadowOffsetY = 4;
        
        ctx.drawImage(carSprite, -45, -18, 90, 36);
        
        ctx.shadowColor = 'transparent';
        ctx.filter = 'none';
    } else {
        ctx.fillStyle = car.color;
        ctx.fillRect(-20, -6, 40, 12);
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(-15, -4, 30, 3);
        ctx.fillStyle = car.color;
        ctx.fillRect(15, -12, 5, 24);
        ctx.fillRect(-20, -12, 6, 24);
        ctx.fillStyle = '#111';
        ctx.save(); ctx.translate(12, -11); ctx.rotate(car.steerAngle); ctx.fillRect(-4, -3, 8, 6); ctx.restore();
        ctx.save(); ctx.translate(12, 11); ctx.rotate(car.steerAngle); ctx.fillRect(-4, -3, 8, 6); ctx.restore();
        ctx.fillRect(-18, -14, 10, 6);
        ctx.fillRect(-18, 8, 10, 6);
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'white';
        ctx.fillRect(-5, -2, 6, 4);
    }

    ctx.restore();
}

function hasPassedWaypoint(car, prevWp, targetWp) {
    let dx = targetWp.x - prevWp.x;
    let dy = targetWp.y - prevWp.y;
    let len2 = dx*dx + dy*dy;
    if (len2 === 0) return true;
    let dot = ((car.x - prevWp.x) * dx + (car.y - prevWp.y) * dy) / len2;
    return dot >= 0.95; 
}

function update() {
    if (!isRacing) return;

    if (isCountdown) {
        countdownTimer -= 16;
        if (countdownTimer <= 0) {
            isCountdown = false;
        }
        if (countdownTimer > 1000) {
            return; // Skip physics until GO!
        }
    }

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 16;
        if (p.life <= 0) particles.splice(i, 1);
    }

    const player = cars[0];

    for (let car of cars) {
        let distToRoad = getMinDistToTrack(car.x, car.y);
        let isOnRoad = distToRoad < ROAD_W/2;
        let friction = isOnRoad ? 0.02 : 0.04; 
        
        car.steerAngle = 0;
        car.isAccelerating = false;
        car.isBraking = false;
        
        if (car.isParked) {
            car.speed = 0;
            continue;
        }

        if (car.isInPit) {
            car.speed = 0;
            car.pitTimer -= 16;
            if (car.pitTimer <= 0) {
                car.isInPit = false;
                car.lapsSincePit = 0;
                car.tireHealth = 100;
            }
            continue; 
        }

        if (raceMode === 'gp') {
            car.tireHealth = Math.max(0, 100 - (car.lapsSincePit / 22) * 100);
            if (car.isPlayer) {
                let tireEl = document.getElementById('tire-display');
                tireEl.innerText = `Tires: ${Math.round(car.tireHealth)}%`;
                if (car.tireHealth === 0) tireEl.style.color = '#ff5252';
                else if (car.tireHealth < 30) tireEl.style.color = '#ff9800';
                else tireEl.style.color = '#ffeb3b';
            }
            
            if (!car.isInPit && car.lapsSincePit > 0 && car.x >= 3150 && car.x <= 3600 && car.y >= 225 && car.y <= 375) {
                if (Math.abs(car.speed) < 25) { 
                    car.isInPit = true;
                    car.pitTimer = 3000; 
                    car.speed = 0;
                }
            }
        }

        let actAsAI = false;
        if (car.isPlayer && isFormationLap) actAsAI = true;

        if (car.isPlayer && !actAsAI) {
            if (keys['ArrowUp']) { car.speed += car.acceleration; car.isAccelerating = true; }
            if (keys['ArrowDown']) { car.speed -= car.acceleration; car.isBraking = true; }
            
            if (Math.abs(car.speed) > 0.5) {
                let turnDir = car.speed > 0 ? 1 : -1;
                if (keys['ArrowLeft']) { car.angle -= car.turnSpeed * turnDir; car.steerAngle = -0.4; }
                if (keys['ArrowRight']) { car.angle += car.turnSpeed * turnDir; car.steerAngle = 0.4; }
            }
        } else {
            // Dynamic Overtaking & Racing Line Logic
            if (Math.random() < 0.05 && !car.isInPit && !isFormationLap) {
                // Slowly drift towards the optimal racing line (center) if not overtaking
                car.targetOffset = car.targetOffset * 0.95;
            }
            
            // Formation Lap Tire Warming (Zig-Zag)
            if (isFormationLap && car.targetWaypoint < waypoints.length - 1) {
                let laneIndex = car.id % 8;
                let baseOffset = -140 + laneIndex * 40;
                // Oscillate wildly left and right to warm up tires!
                car.targetOffset = baseOffset + Math.sin(Date.now() / 300 + car.id) * 50;
            }
            
            // Smoothly steer towards the target lane
            car.trackOffset += (car.targetOffset - car.trackOffset) * 0.05;

            let target = waypoints[car.targetWaypoint];
            let currentOffset = car.trackOffset;
            
            // Formation Lap Grid Parking
            if (isFormationLap && car.targetWaypoint === waypoints.length - 1) {
                target = gridStarts[car.id];
                currentOffset = 0; // Steer directly into the grid box
            }
            
            // AI Pit Logic
            if (raceMode === 'gp' && car.targetWaypoint === 1 && car.lapsSincePit >= 20) {
                target = { x: 3375, y: 300 }; // Steer into the pit box!
                currentOffset = 0; // Ignore lane offset to hit the box perfectly
            }
            
            let prevWp = waypoints[car.targetWaypoint - 1] || waypoints[waypoints.length - 1];
            
            let roadAngle = Math.atan2(target.y - prevWp.y, target.x - prevWp.x);
            let perpAngle = roadAngle + Math.PI/2;
            
            let targetX = target.x + Math.cos(perpAngle) * currentOffset;
            let targetY = target.y + Math.sin(perpAngle) * currentOffset;
            
            let targetAngle = Math.atan2(targetY - car.y, targetX - car.x);
            
            let angleDiff = targetAngle - car.angle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            
            if (Math.abs(car.speed) > 0.5) {
                if (angleDiff > 0.1) { car.angle += car.turnSpeed; car.steerAngle = 0.4; }
                else if (angleDiff < -0.1) { car.angle -= car.turnSpeed; car.steerAngle = -0.4; }
            }
            
            if (Math.abs(angleDiff) > 0.4) {
                car.speed -= car.acceleration;
                car.isBraking = true;
            } else {
                car.speed += car.acceleration;
                car.isAccelerating = true;
            }
            
            // Grid Parking Stop Logic
            if (isFormationLap && car.targetWaypoint === waypoints.length - 1) {
                let distToGrid = Math.hypot(target.x - car.x, target.y - car.y);
                if (distToGrid < 15) {
                    car.speed = 0;
                    car.isParked = true;
                }
            }
            
            prevWp = waypoints[car.targetWaypoint - 1];
            if (hasPassedWaypoint(car, prevWp, target)) {
                car.targetWaypoint++;
                if (car.targetWaypoint >= waypoints.length) {
                    car.targetWaypoint = 1;
                    car.laps++;
                }
            }
        }
        
        let currentMaxSpeed = car.maxSpeed;
        if (isFormationLap) {
            currentMaxSpeed = 4.5;
            if (car.targetWaypoint === waypoints.length - 1) {
                let target = gridStarts[car.id];
                let distToGrid = Math.hypot(target.x - car.x, target.y - car.y);
                if (distToGrid < 300) currentMaxSpeed = 2.0;
                if (distToGrid < 100) currentMaxSpeed = 0.5;
            }
        }
        if (car.isPlayer && raceMode === 'gp' && car.lapsSincePit >= 22) {
            currentMaxSpeed = car.maxSpeed * 0.3; // Very slow!
        }
        
        car.speed *= (1 - friction);
        if (car.speed > currentMaxSpeed) car.speed = currentMaxSpeed;
        if (car.speed < -currentMaxSpeed/2) car.speed = -currentMaxSpeed/2;
        
        car.x += Math.cos(car.angle) * car.speed;
        car.y += Math.sin(car.angle) * car.speed;
        
        // Record skid marks if turning hard or braking
        if ((Math.abs(car.steerAngle) > 0 || car.isBraking) && Math.abs(car.speed) > 4 && isOnRoad) {
            skidMarks.push({ x: car.x, y: car.y, angle: car.angle });
            if (skidMarks.length > 500) skidMarks.shift();
        }
        
        if (car.isPlayer) {
            let pTarget = waypoints[car.targetWaypoint];
            let prevWp = waypoints[car.targetWaypoint - 1];
            if (hasPassedWaypoint(car, prevWp, pTarget)) {
                car.targetWaypoint++;
                if (car.targetWaypoint >= waypoints.length) {
                    car.targetWaypoint = 1;
                    car.laps++;
                    car.lapsSincePit++;
                    if (car.isPlayer && car.laps >= totalLaps) {
                        endRace();
                    }
                }
            }
        }
        
        // Anti-Crash System & Smooth Jostling
        for (let other of cars) {
            if (other === car || other.isInPit || car.isInPit) continue;
            let dx = other.x - car.x;
            let dy = other.y - car.y;
            let dist = Math.hypot(dx, dy);
            
            let angleToOther = Math.atan2(dy, dx);
            let angleDiff = angleToOther - car.angle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            
            // Adaptive Cruise Control: Match speed if about to rear-end
            if (dist < 120 && Math.abs(angleDiff) < 0.5 && car.speed > other.speed) {
                car.speed = other.speed;
                car.isBraking = true;
                
                if (!car.isPlayer && !isFormationLap) {
                    // Overtake! Jump to a different lane to get around them
                    let dodge = Math.random() > 0.5 ? 60 : -60;
                    car.targetOffset = Math.max(-140, Math.min(140, car.trackOffset + dodge));
                }
            }
            
            let preventOverlap = true;
            if (isFormationLap && car.targetWaypoint === waypoints.length - 1) preventOverlap = false; // Disable jostling when parking
            
            // Smoothly prevent any overlap without crashing or fire
            if (preventOverlap && dist < 40 && dist > 0) {
                let overlap = 40 - dist;
                let nx = dx / dist;
                let ny = dy / dist;
                
                car.x -= (overlap / 2) * nx;
                car.y -= (overlap / 2) * ny;
                other.x += (overlap / 2) * nx;
                other.y += (overlap / 2) * ny;
            }
        }
    }
    
    if (isFormationLap) {
        let allParked = cars.every(c => c.isParked);
        if (allParked) {
            isFormationLap = false;
            isCountdown = true;
            countdownTimer = 6000;
            document.getElementById('skip-btn').style.display = 'none';
            cars.forEach(c => {
                c.laps = 0;
                c.targetWaypoint = 1;
                c.isParked = false;
                c.angle = 0;
                c.speed = 0;
            });
        }
    }
}

function draw() {
    ctx.fillStyle = '#333'; 
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    if (cars.length === 0) return;
    const player = cars[0];

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.save();
    
    // TOP DOWN CAMERA
    ctx.translate(CANVAS_W/2, CANVAS_H/2 + 150); 
    ctx.rotate(-player.angle - Math.PI/2);
    ctx.translate(-player.x, -player.y);

    ctx.fillStyle = grassPattern ? grassPattern : '#4CAF50';
    ctx.fillRect(-5000, -5000, 10000, 10000);

    // Spectator Grandstands (Main Straight)
    for (let x = -4000; x <= 4000; x += 1000) {
        ctx.fillStyle = '#444';
        ctx.fillRect(x, -700, 800, 300);
        ctx.fillStyle = '#C62828';
        for(let i=0; i<6; i++) ctx.fillRect(x + 10, -680 + i*40, 780, 20);
        ctx.fillStyle = '#EEE';
        ctx.fillRect(x - 20, -720, 840, 60);
    }
    
    // Spectator Parking Lot (Infield)
    ctx.fillStyle = '#555';
    ctx.fillRect(-2000, -3000, 2000, 1500);
    ctx.strokeStyle = '#FFF';
    ctx.lineWidth = 4;
    for(let px = -1900; px < -100; px += 200) {
        for(let py = -2900; py < -1600; py += 300) {
            ctx.strokeRect(px, py, 150, 200);
        }
    }
    for (let pc of sceneryParkedCars) {
        ctx.fillStyle = pc.color;
        ctx.fillRect(pc.x, pc.y, 25, 50);
    }

    // Kerbs (Red & White)
    ctx.beginPath();
    ctx.moveTo(waypoints[0].x, waypoints[0].y);
    for(let i=1; i<waypoints.length; i++) ctx.lineTo(waypoints[i].x, waypoints[i].y);
    ctx.strokeStyle = '#FF0000';
    ctx.lineWidth = ROAD_W + 20;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(waypoints[0].x, waypoints[0].y);
    for(let i=1; i<waypoints.length; i++) ctx.lineTo(waypoints[i].x, waypoints[i].y);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = ROAD_W + 20;
    ctx.setLineDash([20, 20]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Solid White Edge Lines
    ctx.beginPath();
    ctx.moveTo(waypoints[0].x, waypoints[0].y);
    for(let i=1; i<waypoints.length; i++) ctx.lineTo(waypoints[i].x, waypoints[i].y);
    ctx.strokeStyle = '#FFF';
    ctx.lineWidth = ROAD_W;
    ctx.stroke();

    // Draw Pit Lane
    if (raceMode === 'gp') {
        ctx.beginPath();
        ctx.moveTo(900, 300);
        ctx.lineTo(5850, 300);
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 150;
        ctx.lineCap = 'butt';
        ctx.stroke();

        ctx.fillStyle = '#FFEB3B';
        ctx.fillRect(3150, 225, 450, 150);
        ctx.fillStyle = '#111';
        ctx.font = 'bold 36px Arial';
        ctx.fillText('PIT AREA', 3220, 305);
    }

    // Gray Road
    ctx.beginPath();
    ctx.moveTo(waypoints[0].x, waypoints[0].y);
    for(let i=1; i<waypoints.length; i++) ctx.lineTo(waypoints[i].x, waypoints[i].y);
    ctx.strokeStyle = '#666';
    ctx.lineWidth = ROAD_W - 10;
    ctx.stroke();

    // Dashed Center Line
    ctx.beginPath();
    ctx.moveTo(waypoints[0].x, waypoints[0].y);
    for(let i=1; i<waypoints.length; i++) ctx.lineTo(waypoints[i].x, waypoints[i].y);
    ctx.strokeStyle = '#FFF';
    ctx.lineWidth = 4;
    ctx.setLineDash([30, 40]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw Start Line & Grid Boxes
    ctx.save();
    ctx.translate(waypoints[0].x, waypoints[0].y);
    let dx = waypoints[1].x - waypoints[0].x;
    let dy = waypoints[1].y - waypoints[0].y;
    let angle = Math.atan2(dy, dx);
    ctx.rotate(angle);
    
    ctx.fillStyle = 'white';
    ctx.fillRect(0, -ROAD_W/2, 20, ROAD_W);
    ctx.fillStyle = 'black';
    for(let i=0; i<ROAD_W; i+=20) {
        if ((i/20)%2===0) ctx.fillRect(0, -ROAD_W/2 + i, 10, 20);
        else ctx.fillRect(10, -ROAD_W/2 + i, 10, 20);
    }
    
    // Grid Boxes
    ctx.strokeStyle = '#FFF';
    ctx.lineWidth = 2;
    for (let pos of gridStarts) {
        ctx.strokeRect(pos.x - 25, pos.y - 17, 50, 34);
    }
    ctx.restore();

    // Draw Skid Marks
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    for (let mark of skidMarks) {
        ctx.save();
        ctx.translate(mark.x, mark.y);
        ctx.rotate(mark.angle);
        ctx.fillRect(-18, -14, 8, 6); // Rear left
        ctx.fillRect(-18, 8, 8, 6);  // Rear right
        ctx.restore();
    }

    for (let p of particles) {
        ctx.fillStyle = p.color;
        let alpha = p.life / 600;
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
        ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    for (let car of cars) {
        drawCar(car);
    }
    
    ctx.restore(); 

    distDisplay.innerText = isFormationLap ? "Formation Lap" : `Laps: ${player.laps} / ${totalLaps}`;
    
    let sortedCars = [...cars].sort((a,b) => {
        if (b.laps !== a.laps) return b.laps - a.laps;
        if (b.targetWaypoint !== a.targetWaypoint) return b.targetWaypoint - a.targetWaypoint;
        let targetA = waypoints[a.targetWaypoint];
        let targetB = waypoints[b.targetWaypoint];
        let distA = Math.hypot(targetA.x - a.x, targetA.y - a.y);
        let distB = Math.hypot(targetB.x - b.x, targetB.y - b.y);
        return distA - distB; 
    });
    
    let playerRank = sortedCars.indexOf(player) + 1;
    let rankSuffix = "th";
    if (playerRank === 1) rankSuffix = "st";
    if (playerRank === 2) rankSuffix = "nd";
    if (playerRank === 3) rankSuffix = "rd";
    posDisplay.innerText = `Position: ${playerRank}${rankSuffix}`;
    
    let mph = Math.floor(Math.abs(player.speed) * 22);
    document.getElementById('speed-display').innerText = `Speed: ${mph} MPH`;

    // Update Leaderboard
    let leaderboardHtml = '';
    for (let i = 0; i < sortedCars.length; i++) {
        let c = sortedCars[i];
        let displayName = c.isPlayer ? '<strong style="color:#FF5252">CHARLES LECLERC</strong>' : `Car ${c.id + 1}`;
        let displayColor = c.isPlayer ? '#FFF' : c.color;
        leaderboardHtml += `<div style="margin-bottom: 2px;">
            <span style="display:inline-block; width: 25px; color: #888;">${i+1}.</span>
            <span style="color: ${displayColor}">${displayName}</span>
        </div>`;
    }
    document.getElementById('leaderboard-list').innerHTML = leaderboardHtml;

    drawMinimap();
    
    if (isCountdown || countdownTimer > 0) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 160px Arial';
        
        if (countdownTimer > 1000) {
            ctx.fillStyle = '#FF5252';
            ctx.fillText(Math.ceil((countdownTimer - 1000) / 1000), CANVAS_W/2, CANVAS_H/2);
        } else if (countdownTimer > 0) {
            ctx.fillStyle = '#69F0AE';
            ctx.fillText("GO!", CANVAS_W/2, CANVAS_H/2);
        }
    }
}

function drawMinimap() {
    const mapSize = 120;
    const padding = 10;
    const startX = CANVAS_W - mapSize - padding;
    const startY = padding; 
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(startX, startY, mapSize, mapSize);
    
    // Dynamically calculate the center and scale of the minimap
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    for (let wp of waypoints) {
        if (wp.x < minX) minX = wp.x;
        if (wp.x > maxX) maxX = wp.x;
        if (wp.y < minY) minY = wp.y;
        if (wp.y > maxY) maxY = wp.y;
    }
    
    let trackWidth = maxX - minX;
    let trackHeight = maxY - minY;
    let centerX = minX + trackWidth / 2;
    let centerY = minY + trackHeight / 2;
    
    let maxDim = Math.max(trackWidth, trackHeight) * 1.2; // 20% padding
    const scale = mapSize / maxDim;

    function getMapCoords(wx, wy) {
        return {
            x: startX + mapSize/2 + (wx - centerX) * scale,
            y: startY + mapSize/2 + (wy - centerY) * scale
        };
    }

    // Draw the track outline on the minimap
    ctx.beginPath();
    let pt = getMapCoords(waypoints[0].x, waypoints[0].y);
    ctx.moveTo(pt.x, pt.y);
    for (let i = 1; i < waypoints.length; i++) {
        pt = getMapCoords(waypoints[i].x, waypoints[i].y);
        ctx.lineTo(pt.x, pt.y);
    }
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Draw all cars as little dots
    for (let car of cars) {
        pt = getMapCoords(car.x, car.y);
        ctx.fillStyle = car.color;
        ctx.beginPath();
        // Make the player dot slightly bigger!
        ctx.arc(pt.x, pt.y, car.isPlayer ? 4 : 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Add a white border around the player dot so it's super easy to see
        if (car.isPlayer) {
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }
}

function loop() {
    update();
    draw();
    if (isRacing) requestAnimationFrame(loop);
}

function startRace(mode) {
    if (mode === 'sprint') {
        raceMode = 'sprint';
        totalLaps = 19;
    } else {
        raceMode = 'gp';
        totalLaps = 72;
    }
    document.getElementById('tire-display').style.display = (raceMode === 'gp') ? 'inline' : 'none';
    
    try {
        startScreen.style.display = 'none';
        winScreen.style.display = 'none';
        document.getElementById('leaderboard').style.display = 'block';
        initGame();
        isRacing = true;
        document.getElementById('skip-btn').style.display = 'block';
        requestAnimationFrame(loop);
    } catch (e) {
        alert("GAME CRASHED ON START: " + e.message);
    }
}

function skipFormationLap() {
    if (!isFormationLap) return;
    
    // Instantly teleport and park everyone in their starting boxes
    for (let car of cars) {
        let gridSpot = gridStarts[car.id];
        car.x = gridSpot.x;
        car.y = gridSpot.y;
        car.speed = 0;
        car.angle = 0;
        car.targetWaypoint = 1;
        car.isParked = true;
    }
    
    document.getElementById('skip-btn').style.display = 'none';
}

function crashGame() {
    isRacing = false;
    winScreen.style.display = 'flex';
    const resultText = document.getElementById('final-result');
    resultText.innerText = "💥 CRASH! GAME OVER! You hit another car!";
}

function endRace() {
    isRacing = false;
    winScreen.style.display = 'flex';
    
    let sortedCars = [...cars].sort((a,b) => {
        if (b.laps !== a.laps) return b.laps - a.laps;
        if (b.targetWaypoint !== a.targetWaypoint) return b.targetWaypoint - a.targetWaypoint;
        let targetA = waypoints[a.targetWaypoint];
        let targetB = waypoints[b.targetWaypoint];
        let distA = Math.hypot(targetA.x - a.x, targetA.y - a.y);
        let distB = Math.hypot(targetB.x - b.x, targetB.y - b.y);
        return distA - distB;
    });
    
    document.getElementById('final-result').innerText = `You finished the race!`;
}

ctx.fillStyle = '#333';
ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
