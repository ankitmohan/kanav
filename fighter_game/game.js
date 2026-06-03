const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Your Fighter Jet! 
const car = {
    x: 222, 
    y: canvas.height - 100,
    width: 36,
    height: 80,
    speed: 6,
    color: "#e74c3c", // Red jet
    type: 'racecar',
    direction: 'up'
};

let leftPressed = false;
let rightPressed = false;
let upPressed = false;
let downPressed = false;
let gameSpeedMultiplier = 1;

let carVX = 0;

let audioCtx;
let engineStarted = false;
let engineOsc;
let engineGain;

document.addEventListener("keydown", keyDownHandler, false);
document.addEventListener("keyup", keyUpHandler, false);

function startEngine() {
    if (engineStarted) return;
    engineStarted = true;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    engineOsc = audioCtx.createOscillator();
    engineGain = audioCtx.createGain();
    engineOsc.type = 'sawtooth'; 
    engineOsc.frequency.value = 100; // Jet engine whine!
    let filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600; 
    engineOsc.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(audioCtx.destination);
    
    engineOsc.start();
    engineGain.gain.value = 0.1;
}

function playCoinSound() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime); 
    osc.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.1); 
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
    osc.stop(audioCtx.currentTime + 0.1);
}

function playLevelUpSound() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(440, audioCtx.currentTime); 
    osc.frequency.setValueAtTime(554.37, audioCtx.currentTime + 0.1); 
    osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.2); 
    osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.3); 
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
    osc.stop(audioCtx.currentTime + 0.6);
}

function playCrashSound() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    // Deep explosion sound!
    osc.frequency.setValueAtTime(100, audioCtx.currentTime); 
    osc.frequency.exponentialRampToValueAtTime(20, audioCtx.currentTime + 0.4); 
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
    osc.stop(audioCtx.currentTime + 0.4);
}

function shootBullet() {
    if (gameOver || gameWon) return;
    bullets.push({
        x: car.x + car.width / 2,
        y: car.y,
        speed: 20
    });
    
    // Sci-fi Laser sound!
    if (audioCtx) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
        osc.stop(audioCtx.currentTime + 0.1);
    }
}

const colors = ["#2980b9", "#27ae60", "#8e44ad", "#f39c12", "#d35400", "#1abc9c", "#34495e"];
const playerColors = ["#e74c3c", "#3498db", "#2ecc71", "#9b59b6", "#f1c40f", "#e67e22", "#ffffff", "#111111"];
let playerColorIndex = 0;
let is3D = false;

function keyDownHandler(e) {
    if (!engineStarted && (e.key.startsWith("Arrow") || e.key === " " || e.key === "Shift")) startEngine(); 
    
    if(e.key == "Right" || e.key == "ArrowRight") rightPressed = true;
    else if(e.key == "Left" || e.key == "ArrowLeft") leftPressed = true;
    else if(e.key == "Up" || e.key == "ArrowUp") upPressed = true;
    else if(e.key == "Down" || e.key == "ArrowDown") downPressed = true;
    else if(e.key == " " || e.code == "Space") {
        playerColorIndex = (playerColorIndex + 1) % playerColors.length;
        car.color = playerColors[playerColorIndex];
    }
    else if(e.key === "Shift") {
        shootBullet();
    }
    else if(e.key === "v" || e.key === "V") {
        is3D = !is3D;
        if (is3D) {
            canvas.style.transform = "perspective(350px) rotateX(45deg) scale(1.1)";
            canvas.style.transformOrigin = "bottom center";
            canvas.style.boxShadow = "none";
        } else {
            canvas.style.transform = "none";
            canvas.style.boxShadow = "0 0 20px #000";
        }
    }
}

function keyUpHandler(e) {
    if(e.key == "Right" || e.key == "ArrowRight") rightPressed = false;
    else if(e.key == "Left" || e.key == "ArrowLeft") leftPressed = false;
    else if(e.key == "Up" || e.key == "ArrowUp") upPressed = false;
    else if(e.key == "Down" || e.key == "ArrowDown") downPressed = false;
}

// Game State
let vehicles = [];
let coins = []; 
let bullets = []; 
let score = 0;
let lives = 3; 

let skidMarks = []; // Now used for contrails
let particles = []; 
let clouds = []; // Background clouds!

for(let i=0; i<8; i++) {
    clouds.push({ 
        x: Math.random() * 400, 
        y: Math.random() * 600, 
        radius: 20 + Math.random() * 40, 
        speed: 1 + Math.random() * 3 
    });
}

let level = 1;
let gameWon = false;
let levelUpTimer = 0;

let invulnerableTimer = 0; 
let gameOver = false;

let roadOffset = 0;
let spawnDistance = 0;
let coinSpawnDistance = 0;
let frameCount = 0;

// THE BOSS STATE
let boss = {
    active: false,
    x: 100,
    y: -200,
    width: 160, // Giant Jet!
    height: 200,
    hp: 25, // Lowered health
    maxHp: 25,
    vx: 4,
    shootTimer: 0,
    flash: 0
};

// JET FIGHTER DRAWING FUNCTION!
function drawRealisticVehicle(v, isPlayer) {
    if (isPlayer && invulnerableTimer > 0) {
        if (Math.floor(frameCount / 5) % 2 === 0) return; 
    }

    let isUp = (isPlayer || v.direction === 'up');

    ctx.save();
    ctx.translate(v.x + v.width/2, v.y + v.height/2);
    
    if (!isUp) {
        ctx.rotate(Math.PI); 
    }
    
    let w = v.width;
    let h = v.height;

    if (v.type === 'boss_laser') {
        // Red glowing orb
        ctx.fillStyle = "red";
        ctx.shadowBlur = 15;
        ctx.shadowColor = "red";
        ctx.beginPath();
        ctx.ellipse(0, 0, w/2, h/2, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.ellipse(0, 0, w/4, h/2 - 4, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
        return;
    }

    // Shadow of the jet (much lighter since we are in the sky!)
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath();
    ctx.moveTo(15, -h/2 + 15); 
    ctx.lineTo(w/2 + 25, h/4 + 15); 
    ctx.lineTo(-w/2 + 15, h/4 + 15); 
    ctx.fill();

    if (v.type === 'truck') {
        // HYPER-REALISTIC STEALTH BOMBER!
        let stealthGrad = ctx.createLinearGradient(0, -h/2, 0, h/2);
        stealthGrad.addColorStop(0, "#333");
        stealthGrad.addColorStop(1, "#0a0a0a");
        ctx.fillStyle = stealthGrad;
        
        ctx.beginPath();
        ctx.moveTo(0, -h/2 + 10); // Nose
        ctx.lineTo(w/2 + 15, h/4); // Right wing tip
        ctx.lineTo(w/4, h/2 - 10); // Right trailing zigzag
        ctx.lineTo(w/8, h/4); 
        ctx.lineTo(0, h/2); // Center tail
        ctx.lineTo(-w/8, h/4);
        ctx.lineTo(-w/4, h/2 - 10); // Left trailing zigzag
        ctx.lineTo(-w/2 - 15, h/4); // Left wing tip
        ctx.fill();
        
        // Stealth panel lines
        ctx.strokeStyle = "#222";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -h/2 + 10); ctx.lineTo(0, h/2); // Center seam
        ctx.moveTo(0, -h/4); ctx.lineTo(w/4, h/8); // Right flap
        ctx.moveTo(0, -h/4); ctx.lineTo(-w/4, h/8); // Left flap
        ctx.stroke();

        // Cockpit window (gold tinted)
        ctx.fillStyle = "#f1c40f";
        ctx.beginPath();
        ctx.moveTo(0, -h/2 + 18);
        ctx.lineTo(4, -h/2 + 24);
        ctx.lineTo(-4, -h/2 + 24);
        ctx.fill();
        
        // Red glowing thrusters
        ctx.fillStyle = "rgba(255, 100, 0, 0.9)";
        ctx.shadowBlur = 10;
        ctx.shadowColor = "red";
        ctx.fillRect(-w/4 - 6, h/2 - 10, 12, 4);
        ctx.fillRect(w/4 - 6, h/2 - 10, 12, 4);
        ctx.shadowBlur = 0;
        
    } else {
        // HYPER-REALISTIC F-22 RAPTOR FIGHTER JET! 
        let pC = isPlayer ? v.color : "white"; 
        if (!isPlayer && pC === "white") pC = "#8a9597"; // Enemy jets are metallic grey
        
        // Delta Wing shape
        ctx.fillStyle = pC;
        ctx.beginPath();
        ctx.moveTo(0, -h/3); // Nose root
        ctx.lineTo(w/2 + 10, h/4); // Wing tip right
        ctx.lineTo(w/2 + 6, h/2 - 10); // Wing trailing right
        ctx.lineTo(w/4, h/2 - 15); // Wing root right
        ctx.lineTo(-w/4, h/2 - 15); // Wing root left
        ctx.lineTo(-w/2 - 6, h/2 - 10); // Wing trailing left
        ctx.lineTo(-w/2 - 10, h/4); // Wing tip left
        ctx.fill();

        // Panel lines on wings
        ctx.strokeStyle = "rgba(0,0,0,0.3)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(w/4, 0); ctx.lineTo(w/2, h/4 + 5);
        ctx.moveTo(-w/4, 0); ctx.lineTo(-w/2, h/4 + 5);
        ctx.stroke();

        // Main Fuselage (body) with gradient for 3D metallic cylinder effect
        let fuseGrad = ctx.createLinearGradient(-w/4, 0, w/4, 0);
        fuseGrad.addColorStop(0, "#222");
        fuseGrad.addColorStop(0.5, pC);
        fuseGrad.addColorStop(1, "#222");
        
        ctx.fillStyle = fuseGrad;
        ctx.beginPath();
        ctx.moveTo(0, -h/2 - 5); // Sharp Nose tip
        ctx.quadraticCurveTo(w/4, -h/4, w/4, h/2); // Right side
        ctx.lineTo(-w/4, h/2); // Back
        ctx.quadraticCurveTo(-w/4, -h/4, 0, -h/2 - 5); // Left side
        ctx.fill();
        
        // Twin Horizontal Stabilizers (Tail Wings)
        ctx.fillStyle = pC;
        ctx.beginPath();
        ctx.moveTo(w/4, h/4 + 5);
        ctx.lineTo(w/2, h/2 + 10);
        ctx.lineTo(w/4, h/2 + 5);
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(-w/4, h/4 + 5);
        ctx.lineTo(-w/2, h/2 + 10);
        ctx.lineTo(-w/4, h/2 + 5);
        ctx.fill();

        // Twin Vertical Stabilizers (Tail Fins) angled outwards
        ctx.fillStyle = "#333";
        ctx.beginPath();
        ctx.moveTo(w/6, h/4 + 10);
        ctx.lineTo(w/4, h/2 + 12);
        ctx.lineTo(w/8, h/2 + 12);
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(-w/6, h/4 + 10);
        ctx.lineTo(-w/4, h/2 + 12);
        ctx.lineTo(-w/8, h/2 + 12);
        ctx.fill();

        // Jet Air Intakes
        ctx.fillStyle = "#050505";
        ctx.fillRect(-w/4 - 4, -h/8, 6, 12);
        ctx.fillRect(w/4 - 2, -h/8, 6, 12);

        // Cockpit Canopy (Gold tinted like a real F-22!)
        let canopyGrad = ctx.createLinearGradient(0, -h/4, 0, 0);
        canopyGrad.addColorStop(0, "#f1c40f"); // Gold reflections
        canopyGrad.addColorStop(1, "#2980b9"); // Blue glass
        
        ctx.fillStyle = canopyGrad;
        ctx.beginPath();
        ctx.ellipse(0, -h/8 - 5, 5, 14, 0, 0, Math.PI*2);
        ctx.fill();
        
        // Canopy frame
        ctx.strokeStyle = "#111";
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Thruster Flames
        if (isPlayer && upPressed) {
            ctx.fillStyle = Math.random() < 0.5 ? "#00ffff" : "#ffffff"; // Afterburner blue/white
            ctx.beginPath();
            ctx.arc(-w/8, h/2 + 4, 3 + Math.random()*5, 0, Math.PI*2);
            ctx.arc(w/8, h/2 + 4, 3 + Math.random()*5, 0, Math.PI*2);
            ctx.fill();
        } else if (!isPlayer) {
            ctx.fillStyle = "orange";
            ctx.beginPath();
            ctx.arc(-w/8, h/2 + 2, 3, 0, Math.PI*2);
            ctx.arc(w/8, h/2 + 2, 3, 0, Math.PI*2);
            ctx.fill();
        }
    }
    
    ctx.restore();
}

function drawBoss() {
    if (!boss.active) return;
    
    ctx.save();
    ctx.translate(boss.x + boss.width/2, boss.y + boss.height/2);
    
    let w = boss.width;
    let h = boss.height;
    
    // HYPER-REALISTIC GIANT BOSS FIGHTER JET!
    let pC = "#2c3e50"; 
    let pCLight = "#34495e";
    
    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.moveTo(15, -h/2 + 15);
    ctx.lineTo(w/2 + 35, h/4 + 25);
    ctx.lineTo(-w/2 + 5, h/4 + 25);
    ctx.fill();

    // Giant Delta Wing shape
    ctx.fillStyle = pC;
    ctx.beginPath();
    ctx.moveTo(0, -h/2 + 20); // Nose root
    ctx.lineTo(w/2 + 20, h/4 + 10); // Wing tip right
    ctx.lineTo(w/2, h/2 - 20); // Wing trailing right
    ctx.lineTo(w/4, h/2 - 30); // Wing root right
    ctx.lineTo(-w/4, h/2 - 30); // Wing root left
    ctx.lineTo(-w/2, h/2 - 20); // Wing trailing left
    ctx.lineTo(-w/2 - 20, h/4 + 10); // Wing tip left
    ctx.fill();

    // Experimental Forward-Swept Canards
    ctx.fillStyle = pCLight;
    ctx.beginPath();
    ctx.moveTo(w/6, -h/4);
    ctx.lineTo(w/2 - 10, -h/8);
    ctx.lineTo(w/4, -h/16);
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(-w/6, -h/4);
    ctx.lineTo(-w/2 + 10, -h/8);
    ctx.lineTo(-w/4, -h/16);
    ctx.fill();

    // Detailed Panel lines & Rivets
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(w/4, 0); ctx.lineTo(w/2, h/4 + 10);
    ctx.moveTo(-w/4, 0); ctx.lineTo(-w/2, h/4 + 10);
    ctx.moveTo(w/4, h/2 - 30); ctx.lineTo(w/2, h/2 - 20); // Flaps
    ctx.moveTo(-w/4, h/2 - 30); ctx.lineTo(-w/2, h/2 - 20);
    ctx.stroke();

    // Missile Pods under wings
    ctx.fillStyle = "#111";
    ctx.fillRect(w/3, 10, 8, 40);
    ctx.fillRect(-w/3 - 8, 10, 8, 40);
    ctx.fillStyle = "#e74c3c"; // Red missile tips
    ctx.fillRect(w/3, 50, 8, 4);
    ctx.fillRect(-w/3 - 8, 50, 8, 4);

    // Main Fuselage with metallic 3D gradient
    let fuseGrad = ctx.createLinearGradient(-w/4, 0, w/4, 0);
    fuseGrad.addColorStop(0, "#111");
    fuseGrad.addColorStop(0.2, "#2c3e50");
    fuseGrad.addColorStop(0.5, "#5d6d7e"); // Specular Highlight
    fuseGrad.addColorStop(0.8, "#2c3e50");
    fuseGrad.addColorStop(1, "#111");
    
    ctx.fillStyle = fuseGrad;
    ctx.beginPath();
    ctx.moveTo(0, -h/2 - 30); // Sharp Nose tip
    ctx.quadraticCurveTo(w/4, -h/4, w/4, h/2); // Right side
    ctx.lineTo(-w/4, h/2); // Back
    ctx.quadraticCurveTo(-w/4, -h/4, 0, -h/2 - 30); // Left side
    ctx.fill();
    
    // Nose Cone Seam
    ctx.strokeStyle = "#111";
    ctx.beginPath();
    ctx.moveTo(-15, -h/2 + 10);
    ctx.quadraticCurveTo(0, -h/2 + 15, 15, -h/2 + 10);
    ctx.stroke();

    // Twin Vertical Stabilizers (Angled Stealth)
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.moveTo(w/6 + 5, h/4 + 10);
    ctx.lineTo(w/3, h/2 + 15);
    ctx.lineTo(w/6, h/2 + 10);
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(-w/6 - 5, h/4 + 10);
    ctx.lineTo(-w/3, h/2 + 15);
    ctx.lineTo(-w/6, h/2 + 10);
    ctx.fill();

    // Jet Air Intakes
    ctx.fillStyle = "#050505";
    ctx.fillRect(-w/4 - 10, -h/8, 14, 28);
    ctx.fillRect(w/4 - 4, -h/8, 14, 28);

    // Giant Cockpit Canopy (Evil Red)
    let canopyGrad = ctx.createLinearGradient(0, -h/4, 0, 0);
    canopyGrad.addColorStop(0, "#f1c40f"); 
    canopyGrad.addColorStop(1, "#8b0000"); // Deep Red
    
    ctx.fillStyle = canopyGrad;
    ctx.beginPath();
    ctx.ellipse(0, -h/8 - 15, 12, 35, 0, 0, Math.PI*2);
    ctx.fill();
    
    // Canopy Window Frame
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-12, -h/8 - 15); ctx.lineTo(12, -h/8 - 15); // Horizontal strut
    ctx.moveTo(0, -h/8 - 50); ctx.lineTo(0, -h/8 + 20); // Vertical strut
    ctx.stroke();

    // Engines & Animated Thruster Flames
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(-w/6, h/2, 12, 0, Math.PI*2);
    ctx.arc(w/6, h/2, 12, 0, Math.PI*2);
    ctx.fill();
    
    let flameLen = 15 + Math.random() * 10;
    let flameGrad = ctx.createLinearGradient(0, h/2, 0, h/2 + flameLen);
    flameGrad.addColorStop(0, "white");
    flameGrad.addColorStop(0.5, "yellow");
    flameGrad.addColorStop(1, "rgba(255, 0, 0, 0)");
    
    ctx.fillStyle = flameGrad;
    ctx.beginPath();
    ctx.ellipse(-w/6, h/2 + flameLen/2, 8, flameLen/2, 0, 0, Math.PI*2);
    ctx.ellipse(w/6, h/2 + flameLen/2, 8, flameLen/2, 0, 0, Math.PI*2);
    ctx.fill();

    // Boss Hit Flash
    if (boss.flash > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${boss.flash})`;
        ctx.beginPath();
        ctx.moveTo(0, -h/2); 
        ctx.lineTo(w/2, h/4); 
        ctx.lineTo(-w/2, h/4); 
        ctx.fill();
        boss.flash -= 0.1;
    }
    
    ctx.restore();
    
    // Boss HP Bar
    ctx.fillStyle = "red";
    ctx.fillRect(boss.x, boss.y - 20, boss.width, 10);
    ctx.fillStyle = "#2ecc71";
    ctx.fillRect(boss.x, boss.y - 20, boss.width * (boss.hp / boss.maxHp), 10);
    
    // Boss Title
    ctx.font = "bold 15px Arial";
    ctx.fillStyle = "white";
    ctx.fillText("EXPERIMENTAL FIGHTER JET", boss.x + boss.width/2 - 100, boss.y - 25);
}


function drawFX() {
    // Contrails from wingtips!
    for (let i = 0; i < skidMarks.length; i++) {
        let s = skidMarks[i];
        s.y += 5 * gameSpeedMultiplier; 
        s.alpha -= 0.02; 
        if (s.alpha > 0) {
            ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`; // White smoke
            ctx.beginPath();
            ctx.arc(s.x, s.y, 2, 0, Math.PI*2);
            ctx.fill();
        }
    }
    skidMarks = skidMarks.filter(s => s.alpha > 0);
    
    // Explosions!
    for (let i = 0; i < particles.length; i++) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy + (5 * gameSpeedMultiplier); 
        p.life -= 0.05;
        
        if (p.life > 0) {
            ctx.fillStyle = Math.random() < 0.5 ? "orange" : "yellow"; 
            ctx.fillRect(p.x, p.y, 4, 4);
        }
    }
    particles = particles.filter(p => p.life > 0);
}

function drawVehicles() {
    for (let i = 0; i < vehicles.length; i++) {
        let v = vehicles[i];
        drawRealisticVehicle(v, false);
        
        v.y += (v.speed + (level * 1.5)) * gameSpeedMultiplier;
        
        // (Removed artificial zig-zag so the sweeping pattern looks clean)
        
        if (invulnerableTimer <= 0 && !v.destroyed &&
            car.x < v.x + v.width &&
            car.x + car.width > v.x &&
            car.y < v.y + v.height &&
            car.y + car.height > v.y) {
            
            v.destroyed = true;
            lives--; 
            score = Math.max(0, score - 20); 
            playCrashSound(); 
            
            // Explosion
            for(let p = 0; p < 25; p++) {
                particles.push({ x: car.x + car.width/2, y: car.y, vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 20, life: 1.0 });
            }
            
            if (lives <= 0) {
                gameOver = true;
                if (engineOsc) engineOsc.stop();
            } else {
                invulnerableTimer = 100; 
            }
        }
    }
}

function drawCoins() {
    for (let i = 0; i < coins.length; i++) {
        let c = coins[i];
        
        ctx.fillStyle = "#f1c40f"; 
        ctx.beginPath();
        let spinWidth = 10 * Math.abs(Math.cos((frameCount * 5 + c.y) * 0.05));
        ctx.ellipse(c.x + 10, c.y + 10, Math.max(2, spinWidth), 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#f9e79f";
        ctx.beginPath();
        ctx.ellipse(c.x + 10, c.y + 10, Math.max(1, spinWidth * 0.6), 6, 0, 0, Math.PI * 2);
        ctx.fill();
        
        c.y += 5 * gameSpeedMultiplier;
        
        if (car.x < c.x + 20 && car.x + car.width > c.x && car.y < c.y + 20 && car.y + car.height > c.y) {
            score += 10; 
            
            // Level Up Check!
            if (score >= level * 100 && level < 5) {
                level++;
                levelUpTimer = 100; 
                playLevelUpSound(); 
                lives = Math.min(3, lives + 1); 
                
                // SPAWN THE BOSS AT LEVEL 5!
                if (level === 5) {
                    boss.active = true;
                    boss.hp = boss.maxHp;
                    boss.x = canvas.width/2 - boss.width/2;
                    boss.y = -200; 
                    vehicles = []; 
                }
            } else {
                playCoinSound(); 
            }
            c.collected = true; 
        }
    }
}

function drawUI() {
    ctx.font = "bold 20px Arial";
    ctx.fillStyle = "white";
    ctx.fillText("Score: " + score, 10, 30);
    
    ctx.fillStyle = "#f1c40f"; 
    ctx.fillText(level === 5 ? "BOSS FIGHT!" : "Next Level: " + score + " / " + (level * 100), 10, 60);
    
    ctx.fillStyle = "#3498db"; 
    ctx.fillText(level === 5 ? "BOSS" : "LEVEL " + level, canvas.width - 100, 30);
    
    ctx.fillStyle = "red";
    ctx.fillText("Lives: ", 10, 90);
    for(let i = 0; i < lives; i++){
        ctx.fillText("❤️", 75 + (i * 25), 90);
    }
    
    if (levelUpTimer > 0 && level < 5) {
        ctx.font = "bold 50px Arial";
        ctx.fillStyle = "#2ecc71"; 
        ctx.fillText("LEVEL UP!", canvas.width / 2 - 130, canvas.height / 2);
        levelUpTimer--;
    } else if (levelUpTimer > 0 && level === 5) {
        ctx.font = "bold 40px Arial";
        ctx.fillStyle = "red"; 
        ctx.fillText("WARNING: BOSS!", canvas.width / 2 - 160, canvas.height / 2);
        levelUpTimer--;
    }
}

function drawSkyAndClouds() {
    // Beautiful Sky Blue gradient
    let skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    skyGrad.addColorStop(0, "#87CEEB"); // Light blue
    skyGrad.addColorStop(1, "#4682B4"); // Steel blue
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw scrolling clouds
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)"; 
    for(let i = 0; i < clouds.length; i++) {
        let c = clouds[i];
        c.y += c.speed * gameSpeedMultiplier;
        
        // Draw a fluffy cloud using overlapping circles
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.radius, 0, Math.PI*2);
        ctx.arc(c.x - c.radius*0.8, c.y + c.radius*0.2, c.radius*0.8, 0, Math.PI*2);
        ctx.arc(c.x + c.radius*0.8, c.y + c.radius*0.2, c.radius*0.8, 0, Math.PI*2);
        ctx.fill();
        
        // Loop clouds back to the top
        if (c.y > canvas.height + c.radius) {
            c.y = -c.radius * 2;
            c.x = Math.random() * canvas.width;
        }
    }
}

function update() {
    if (gameWon) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = "bold 50px Arial";
        ctx.fillStyle = "#f1c40f"; 
        ctx.fillText("YOU WIN!", canvas.width / 2 - 120, canvas.height / 2);
        ctx.font = "25px Arial";
        ctx.fillStyle = "white";
        ctx.fillText("You defeated the Giant Experimental Jet! 🏆", canvas.width / 2 - 220, canvas.height / 2 + 50);
        ctx.fillText("Final Score: " + score, canvas.width / 2 - 80, canvas.height / 2 + 100);
        return; 
    }

    if (gameOver) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = "bold 50px Arial";
        ctx.fillStyle = "red";
        ctx.fillText("GAME OVER", canvas.width / 2 - 150, canvas.height / 2);
        ctx.font = "25px Arial";
        ctx.fillStyle = "yellow";
        ctx.fillText("Final Score: " + score, canvas.width / 2 - 80, canvas.height / 2 + 40);
        ctx.fillText("Refresh to play again!", canvas.width / 2 - 120, canvas.height / 2 + 80);
        return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    let baseGameSpeed = 1 + (level - 1) * 0.2; 
    
    gameSpeedMultiplier = baseGameSpeed;
    if (upPressed) gameSpeedMultiplier = baseGameSpeed * 1.6; 
    if (downPressed) gameSpeedMultiplier = baseGameSpeed * 0.5; 
    
    if (engineStarted && engineOsc) {
        // Higher pitched whine for jet!
        let targetPitch = 100 + (gameSpeedMultiplier * 50) + (Math.abs(carVX) * 2);
        engineOsc.frequency.setTargetAtTime(targetPitch, audioCtx.currentTime, 0.1); 
        let targetVol = 0.05 + (gameSpeedMultiplier * 0.03);
        engineGain.gain.setTargetAtTime(targetVol, audioCtx.currentTime, 0.1);
    }
    
    drawSkyAndClouds(); // Replaced the road with the sky!
    
    if (invulnerableTimer > 0) invulnerableTimer--;
    
    if (rightPressed) carVX += 0.8; 
    else if (leftPressed) carVX -= 0.8; 
    else carVX *= 0.85; 
    
    carVX = Math.max(-8, Math.min(8, carVX));
    car.x += carVX;
    
    // Constrain to the entire sky (canvas bounds) instead of road bounds
    if (car.x < 0) {
        car.x = 0;
        carVX = 0;
    }
    if (car.x + car.width > canvas.width) {
        car.x = canvas.width - car.width;
        carVX = 0;
    }
    
    // Contrails from jet wingtips!
    if (Math.abs(carVX) > 2) {
        skidMarks.push({x: car.x - 5, y: car.y + car.height/2, alpha: 0.8});
        skidMarks.push({x: car.x + car.width + 5, y: car.y + car.height/2, alpha: 0.8});
    }
    
    drawFX(); 
    
    // BOSS LOGIC
    if (boss.active) {
        if (boss.y < 30) {
            boss.y += 2; // Enter animation
            boss.x = canvas.width / 2 - boss.width / 2; // Ensure it centers itself
        } else {
            // Boss Movement is DISABLED! It stays centered.
            boss.x = canvas.width / 2 - boss.width / 2;
            
            // Boss Shooting Attack is BACK!
            boss.shootTimer -= gameSpeedMultiplier;
            if (boss.shootTimer <= 0) {
                boss.shootTimer = 8; // Ultra rapid fire!
                // Sweep the gun from left to right!
                let sweepOffset = Math.sin(frameCount * 0.05) * (boss.width / 2 + 20); 
                let bx = boss.x + boss.width/2 + sweepOffset;
                let by = boss.y + boss.height;
                // Shoots red laser bullets one at a time in a sweeping wave, much faster!
                vehicles.push({ x: bx - 6, y: by, width: 12, height: 20, type: 'boss_laser', direction: 'down', speed: 2 });
            }
        }
        drawBoss();
    }
    
    spawnDistance += gameSpeedMultiplier;
    coinSpawnDistance += gameSpeedMultiplier;
    let spawnThreshold = Math.max(20, 50 - (level * 6)); 
    
    // Only spawn normal planes if the boss is NOT active
    if (!boss.active && spawnDistance >= spawnThreshold) { 
        spawnDistance = 0;
        // Spread lanes across the whole canvas now that there is no road!
        let laneCenters = [50, 150, 250, 350]; 
        let randomLane = Math.floor(Math.random() * laneCenters.length); 
        let isLeft = randomLane < (laneCenters.length / 2); 
        
        let typeRand = Math.random();
        let type = 'car';
        let width = 36;
        let height = 80;
        if (typeRand < 0.2) { 
            type = 'truck'; width = 60; height = 80; // Stealth bomber is wide!
        } 
        
        let vX = laneCenters[randomLane] - width / 2;
        let startY = -150; 
        let speed = isLeft ? 8 + Math.random() * 4 : 2 + Math.random() * 4;
        let dir = isLeft ? 'down' : 'up';
        
        vehicles.push({ x: vX, y: startY, width: width, height: height, type: type, color: "white", direction: dir, speed: speed });
    }
    
    if (coinSpawnDistance >= 25) {
        coinSpawnDistance = 0;
        if (Math.random() < 0.8) { 
            let laneCenters = [50, 150, 250, 350]; 
            coins.push({ x: laneCenters[Math.floor(Math.random() * laneCenters.length)] - 10, y: -50, width: 20, height: 20, collected: false });
        }
    }
    
    // UPDATE PLAYER BULLETS
    for (let i = 0; i < bullets.length; i++) {
        let b = bullets[i];
        b.y -= b.speed; 
        
        // Draw Sci-Fi Laser (Glowing Orb like the Boss!)
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.fillStyle = "#00ffff"; // Cyan so you know it's yours
        ctx.shadowBlur = 15;
        ctx.shadowColor = "#00ffff";
        ctx.beginPath();
        ctx.ellipse(0, 0, 6, 10, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.ellipse(0, 0, 3, 6, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
        
        // Collide with normal vehicles
        for (let j = 0; j < vehicles.length; j++) {
            let v = vehicles[j];
            if (!v.destroyed && v.type !== 'boss_laser' && b.x > v.x && b.x < v.x + v.width && b.y > v.y && b.y < v.y + v.height) {
                v.destroyed = true;
                b.destroyed = true;
                score += 20; 
                playCrashSound();
                for(let p = 0; p < 15; p++) {
                    particles.push({ x: v.x + v.width/2, y: v.y + v.height/2, vx: (Math.random()-0.5)*15, vy: (Math.random()-0.5)*15, life: 1.0 });
                }
            }
        }
        
        // Collide with BOSS
        if (boss.active && !b.destroyed && b.x > boss.x && b.x < boss.x + boss.width && b.y > boss.y && b.y < boss.y + boss.height) {
            b.destroyed = true;
            boss.hp--;
            boss.flash = 1.0; 
            playCrashSound();
            for(let p = 0; p < 5; p++) {
                particles.push({ x: b.x, y: b.y, vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10, life: 1.0 });
            }
            
            if (boss.hp <= 0) {
                boss.active = false;
                score += 2000;
                gameWon = true;
                if (engineOsc) engineOsc.stop();
                for(let p = 0; p < 100; p++) {
                    particles.push({ x: boss.x + Math.random()*boss.width, y: boss.y + Math.random()*boss.height, vx: (Math.random()-0.5)*30, vy: (Math.random()-0.5)*30, life: 2.0 });
                }
            }
        }
    }
    
    drawCoins();
    drawVehicles();
    drawRealisticVehicle(car, true); 
    drawUI(); 
    
    bullets = bullets.filter(b => !b.destroyed && b.y > -50);
    vehicles = vehicles.filter(v => !v.destroyed && v.y < canvas.height + 300 && v.y > -300);
    coins = coins.filter(c => c.y < canvas.height + 50 && !c.collected);
    
    frameCount++;
    requestAnimationFrame(update); 
}

update();
