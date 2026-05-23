const canvas = document.getElementById('flightCanvas');
const ctx = canvas.getContext('2d');
const minimapCanvas = document.getElementById('minimapCanvas');
const minimapCtx = minimapCanvas.getContext('2d');

// Resize canvas to window
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ==================== PLAYER AIRCRAFT ====================
const player = {
    x: 500,        // World X
    y: 500,        // World Y
    altitude: 2000, // Feet
    heading: 0,     // Degrees (0-360)
    pitch: 0,       // Degrees (-90 to 90)
    roll: 0,        // Degrees (-180 to 180)
    speed: 150,     // Knots
    maxSpeed: 500,
    minSpeed: 50,
    health: 100,
    ammo: 500,
    missiles: 8,
    fuel: 100,
    score: 0
};

// ==================== INPUT HANDLING ====================
const keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    ' ': false,
    'm': false,
    'f': false,
    'w': false
};

window.addEventListener('keydown', (e) => {
    if (e.key in keys) keys[e.key] = true;
});

window.addEventListener('keyup', (e) => {
    if (e.key in keys) keys[e.key] = false;
});

// ==================== GAME OBJECTS ====================
const enemies = [];
const shots = [];
const explosions = [];
const particles = [];

// Naval Base
const navalBase = {
    x: 500,
    y: 500,
    width: 600,
    height: 800,
    runways: [
        { x: 550, y: 450, width: 400, height: 80 },
        { x: 550, y: 650, width: 400, height: 80 }
    ],
    hangars: [
        { x: 300, y: 550, width: 150, height: 120 },
        { x: 700, y: 550, width: 150, height: 120 }
    ],
    towers: [
        { x: 480, y: 620, width: 40, height: 100 }
    ]
};

// Enemy aircraft class
class EnemyAircraft {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.altitude = 2000 + Math.random() * 3000;
        this.heading = Math.random() * 360;
        this.speed = 150 + Math.random() * 100;
        this.health = 50;
        this.targetX = Math.random() * 3000;
        this.targetY = Math.random() * 3000;
        this.shootTimer = 0;
    }

    update() {
        // Move towards target
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 200) {
            this.targetX = Math.random() * 3000;
            this.targetY = Math.random() * 3000;
        }

        // Move
        const angle = Math.atan2(dy, dx);
        this.x += Math.cos(angle) * (this.speed * 0.016);
        this.y += Math.sin(angle) * (this.speed * 0.016);
        this.heading = (angle * 180 / Math.PI + 360) % 360;

        // AI shooting
        this.shootTimer--;
        if (this.shootTimer < 0) {
            const pdx = player.x - this.x;
            const pdy = player.y - this.y;
            const pdist = Math.hypot(pdx, pdy);
            
            if (pdist < 800) {
                shots.push({
                    x: this.x,
                    y: this.y,
                    vx: Math.cos(Math.atan2(pdy, pdx)) * 300,
                    vy: Math.sin(Math.atan2(pdy, pdx)) * 300,
                    owner: 'enemy'
                });
                this.shootTimer = 2;
            }
        }
    }

    draw(ctx, scale) {
        const screenX = (this.x - player.x) * scale + canvas.width / 2;
        const screenY = (this.y - player.y) * scale + canvas.height / 2;

        if (screenX < -100 || screenX > canvas.width + 100 ||
            screenY < -100 || screenY > canvas.height + 100) return;

        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.rotate(this.heading * Math.PI / 180);

        // Enemy aircraft body (red)
        ctx.fillStyle = '#ff3333';
        ctx.beginPath();
        ctx.moveTo(15, 0);
        ctx.lineTo(-10, -8);
        ctx.lineTo(-5, 0);
        ctx.lineTo(-10, 8);
        ctx.closePath();
        ctx.fill();

        // Wings
        ctx.fillStyle = '#cc0000';
        ctx.fillRect(-8, -12, 18, 8);
        ctx.fillRect(-8, 4, 18, 8);

        ctx.restore();

        // Health bar
        ctx.fillStyle = '#ff3333';
        ctx.fillRect(screenX - 15, screenY - 25, this.health * 0.6, 8);
        ctx.strokeStyle = '#0f0';
        ctx.lineWidth = 2;
        ctx.strokeRect(screenX - 15, screenY - 25, 30, 8);
    }
}

// Ship class
class Ship {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.heading = Math.random() * 360;
        this.speed = 30 + Math.random() * 20;
        this.health = 100;
        this.targetX = Math.random() * 3000;
        this.targetY = Math.random() * 3000;
    }

    update() {
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 300) {
            this.targetX = Math.random() * 3000;
            this.targetY = Math.random() * 3000;
        }

        const angle = Math.atan2(dy, dx);
        this.x += Math.cos(angle) * (this.speed * 0.016);
        this.y += Math.sin(angle) * (this.speed * 0.016);
        this.heading = (angle * 180 / Math.PI + 360) % 360;
    }

    draw(ctx, scale) {
        const screenX = (this.x - player.x) * scale + canvas.width / 2;
        const screenY = (this.y - player.y) * scale + canvas.height / 2;

        if (screenX < -150 || screenX > canvas.width + 150 ||
            screenY < -100 || screenY > canvas.height + 100) return;

        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.rotate(this.heading * Math.PI / 180);

        // Ship hull
        ctx.fillStyle = '#444';
        ctx.fillRect(-30, -15, 60, 30);

        // Deck
        ctx.fillStyle = '#666';
        ctx.fillRect(-28, -12, 56, 24);

        // Superstructure
        ctx.fillStyle = '#333';
        ctx.fillRect(-8, -20, 16, 8);

        ctx.restore();

        // Health bar
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(screenX - 30, screenY - 30, this.health * 0.6, 6);
        ctx.strokeStyle = '#0f0';
        ctx.lineWidth = 2;
        ctx.strokeRect(screenX - 30, screenY - 30, 60, 6);
    }
}

// Initialize game
function initGame() {
    // Spawn enemy aircraft
    for (let i = 0; i < 5; i++) {
        enemies.push(new EnemyAircraft(
            Math.random() * 2000,
            Math.random() * 2000
        ));
    }

    // Spawn ships
    for (let i = 0; i < 3; i++) {
        enemies.push(new Ship(
            Math.random() * 2000 + 1000,
            Math.random() * 2000 + 1000
        ));
    }
}

// ==================== GAME LOGIC ====================
function update(deltaTime) {
    // Player input
    if (keys.ArrowUp && player.pitch > -80) player.pitch -= 2;
    if (keys.ArrowDown && player.pitch < 80) player.pitch += 2;
    if (keys.ArrowLeft && player.roll > -45) player.roll -= 2;
    if (keys.ArrowRight && player.roll < 45) player.roll += 2;

    // Speed control
    if (keys[' ']) player.speed = Math.min(player.speed + 2, player.maxSpeed);
    else player.speed = Math.max(player.speed - 1, player.minSpeed);

    // Altitude
    player.altitude += player.pitch * 0.5;
    player.altitude = Math.max(0, Math.min(player.altitude, 35000));

    if (player.altitude <= 100) {
        if (Math.hypot(player.x - navalBase.x, player.y - navalBase.y) < 300) {
            alert('SUCCESS! You landed safely at the naval base!\nFinal Score: ' + player.score);
            location.reload();
        } else {
            alert('CRASH! You were too far from base!');
            location.reload();
        }
    }

    // Heading
    player.heading += player.roll * 0.5;
    player.heading = (player.heading + 360) % 360;

    // Movement
    const radians = player.heading * Math.PI / 180;
    player.x += Math.cos(radians) * (player.speed * 0.3 * deltaTime);
    player.y += Math.sin(radians) * (player.speed * 0.3 * deltaTime);

    // Fuel consumption
    player.fuel -= 0.01;
    if (player.fuel <= 0) {
        alert('OUT OF FUEL! Game Over!\nFinal Score: ' + player.score);
        location.reload();
    }

    // Shooting
    if (keys[' '] && player.ammo > 0) {
        const radians = player.heading * Math.PI / 180;
        shots.push({
            x: player.x + Math.cos(radians) * 30,
            y: player.y + Math.sin(radians) * 30,
            vx: Math.cos(radians) * 400,
            vy: Math.sin(radians) * 400,
            owner: 'player'
        });
        player.ammo--;
    }

    // Missiles
    if (keys['m'] && player.missiles > 0) {
        const target = findClosestEnemy();
        if (target) {
            const radians = player.heading * Math.PI / 180;
            shots.push({
                x: player.x + Math.cos(radians) * 30,
                y: player.y + Math.sin(radians) * 30,
                vx: Math.cos(radians) * 500,
                vy: Math.sin(radians) * 500,
                owner: 'missile',
                target: target,
                speed: 500
            });
            player.missiles--;
        }
    }

    // Update enemies
    enemies.forEach(enemy => enemy.update());

    // Update shots
    for (let i = shots.length - 1; i >= 0; i--) {
        shots[i].x += shots[i].vx * deltaTime;
        shots[i].y += shots[i].vy * deltaTime;

        // Check collisions
        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            const dx = shots[i].x - enemy.x;
            const dy = shots[i].y - enemy.y;
            const dist = Math.hypot(dx, dy);

            if (dist < 30) {
                enemy.health -= shots[i].owner === 'missile' ? 30 : 10;
                createExplosion(shots[i].x, shots[i].y);
                shots.splice(i, 1);

                if (enemy.health <= 0) {
                    createExplosion(enemy.x, enemy.y);
                    enemies.splice(j, 1);
                    player.score += enemy instanceof Ship ? 500 : 1000;
                }
                break;
            }
        }

        // Remove off-map shots
        if (shots[i] && (shots[i].x > 3000 || shots[i].x < 0 || shots[i].y > 3000 || shots[i].y < 0)) {
            shots.splice(i, 1);
        }
    }

    // Check enemy shots hitting player
    for (let i = shots.length - 1; i >= 0; i--) {
        if (shots[i].owner === 'enemy') {
            const dx = shots[i].x - player.x;
            const dy = shots[i].y - player.y;
            const dist = Math.hypot(dx, dy);

            if (dist < 20) {
                player.health -= 10;
                createExplosion(shots[i].x, shots[i].y);
                shots.splice(i, 1);

                if (player.health <= 0) {
                    alert('DESTROYED! Game Over!\nFinal Score: ' + player.score);
                    location.reload();
                }
            }
        }
    }

    // Update explosions
    explosions = explosions.filter(exp => {
        exp.life -= deltaTime;
        return exp.life > 0;
    });

    // Respawn enemies
    if (enemies.length < 8) {
        enemies.push(new EnemyAircraft(
            Math.random() * 2000 + player.x - 1000,
            Math.random() * 2000 + player.y - 1000
        ));
    }
}

function findClosestEnemy() {
    let closest = null;
    let minDist = 1500;

    enemies.forEach(enemy => {
        const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
        if (dist < minDist) {
            minDist = dist;
            closest = enemy;
        }
    });

    return closest;
}

function createExplosion(x, y) {
    explosions.push({
        x, y,
        radius: 0,
        maxRadius: 50,
        life: 0.5
    });

    // Particles
    for (let i = 0; i < 8; i++) {
        particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 200,
            vy: (Math.random() - 0.5) * 200,
            life: 1
        });
    }
}

// ==================== RENDERING ====================
function drawSky() {
    const altPercent = Math.min(1, player.altitude / 35000);
    
    // Sky color based on altitude
    const skyR = Math.floor(135 - altPercent * 100);
    const skyG = Math.floor(206 - altPercent * 150);
    const skyB = Math.floor(235 - altPercent * 200);
    
    const groundR = Math.floor(34 + altPercent * 50);
    const groundG = Math.floor(139 + altPercent * 50);
    const groundB = Math.floor(34 + altPercent * 50);

    // Clear with sky color
    ctx.fillStyle = `rgb(${skyR}, ${skyG}, ${skyB})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Horizon line affected by pitch
    const horizonY = canvas.height / 2 + player.pitch * 4;

    // Ground gradient below horizon
    const groundGradient = ctx.createLinearGradient(0, horizonY, 0, canvas.height);
    groundGradient.addColorStop(0, `rgb(${groundR}, ${groundG}, ${groundB})`);
    groundGradient.addColorStop(1, 'rgb(20, 80, 20)');
    ctx.fillStyle = groundGradient;
    ctx.fillRect(0, horizonY, canvas.width, canvas.height - horizonY);

    // Horizon line
    ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    ctx.lineTo(canvas.width, horizonY);
    ctx.stroke();
}

function drawWorld() {
    const scale = 0.3;

    // Draw terrain grid
    ctx.strokeStyle = 'rgba(100, 150, 100, 0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3000; i += 500) {
        const screenX = (i - player.x) * scale + canvas.width / 2;
        if (screenX > -500 && screenX < canvas.width + 500) {
            ctx.beginPath();
            ctx.moveTo(screenX, canvas.height / 2 + 100);
            ctx.lineTo(screenX, canvas.height);
            ctx.stroke();
        }
        
        const screenY = (i - player.y) * scale + canvas.height / 2 + 100;
        if (screenY > canvas.height / 2 && screenY < canvas.height) {
            ctx.beginPath();
            ctx.moveTo(0, screenY);
            ctx.lineTo(canvas.width, screenY);
            ctx.stroke();
        }
    }

    // Draw naval base
    const baseCenterX = (navalBase.x - player.x) * scale + canvas.width / 2;
    const baseCenterY = (navalBase.y - player.y) * scale + canvas.height / 2 + 100;

    // Base outline
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 3;
    ctx.strokeRect(
        baseCenterX - navalBase.width / 2 * scale,
        baseCenterY - navalBase.height / 2 * scale,
        navalBase.width * scale,
        navalBase.height * scale
    );

    // Runways
    ctx.fillStyle = '#222';
    navalBase.runways.forEach(runway => {
        ctx.fillRect(
            baseCenterX + (runway.x - navalBase.x) * scale,
            baseCenterY + (runway.y - navalBase.y) * scale,
            runway.width * scale,
            runway.height * scale
        );
    });

    // Hangars
    ctx.fillStyle = '#555';
    navalBase.hangars.forEach(hangar => {
        ctx.fillRect(
            baseCenterX + (hangar.x - navalBase.x) * scale,
            baseCenterY + (hangar.y - navalBase.y) * scale,
            hangar.width * scale,
            hangar.height * scale
        );
    });

    // Towers
    ctx.fillStyle = '#888';
    navalBase.towers.forEach(tower => {
        ctx.fillRect(
            baseCenterX + (tower.x - navalBase.x) * scale,
            baseCenterY + (tower.y - navalBase.y) * scale,
            tower.width * scale,
            tower.height * scale
        );
    });
}

function drawAircraft() {
    const centerX = canvas.width / 2;
    const centerY = canvas.height * 0.65;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(player.roll * Math.PI / 180);

    // Aircraft fuselage (blue)
    ctx.fillStyle = '#0088ff';
    ctx.beginPath();
    ctx.moveTo(25, 0);
    ctx.lineTo(-18, -12);
    ctx.lineTo(-10, 0);
    ctx.lineTo(-18, 12);
    ctx.closePath();
    ctx.fill();

    // Wings
    ctx.fillStyle = '#0066cc';
    ctx.fillRect(-15, -25, 30, 18);
    ctx.fillRect(-15, 7, 30, 18);

    // Cockpit
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(-10, -5, 8, 10);

    ctx.restore();
}

function drawHUD() {
    // Update HUD values
    document.getElementById('altitude').textContent = Math.round(player.altitude) + ' ft';
    document.getElementById('airspeed').textContent = Math.round(player.speed) + ' kt';
    document.getElementById('heading').textContent = String(Math.round(player.heading)).padStart(3, '0') + '°';
    document.getElementById('fuel').textContent = Math.round(player.fuel) + '%';
    document.getElementById('health').textContent = Math.round(player.health) + '%';
    document.getElementById('ammo').textContent = player.ammo;
    document.getElementById('missiles').textContent = player.missiles;
    document.getElementById('score').textContent = player.score;
}

function drawMinimap() {
    const scale = 0.05;
    minimapCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);

    // Background
    minimapCtx.fillStyle = 'rgba(0, 20, 0, 0.9)';
    minimapCtx.fillRect(0, 0, minimapCanvas.width, minimapCanvas.height);

    // Border
    minimapCtx.strokeStyle = '#0f0';
    minimapCtx.lineWidth = 2;
    minimapCtx.strokeRect(0, 0, minimapCanvas.width, minimapCanvas.height);

    // Naval base
    const baseX = (navalBase.x - player.x) * scale + 100;
    const baseY = (navalBase.y - player.y) * scale + 100;
    minimapCtx.fillStyle = '#0f0';
    minimapCtx.fillRect(baseX - 20, baseY - 30, 40, 60);

    // Enemies
    enemies.forEach(enemy => {
        const x = (enemy.x - player.x) * scale + 100;
        const y = (enemy.y - player.y) * scale + 100;
        minimapCtx.fillStyle = enemy instanceof Ship ? '#f00' : '#ff6600';
        minimapCtx.fillRect(x - 3, y - 3, 6, 6);
    });

    // Player center
    minimapCtx.fillStyle = '#0f0';
    minimapCtx.fillRect(98, 98, 4, 4);
}

function draw() {
    drawSky();
    drawWorld();

    // Draw enemies
    enemies.forEach(enemy => enemy.draw(ctx, 0.3));

    // Draw explosions
    explosions.forEach(exp => {
        exp.radius = exp.maxRadius * (1 - exp.life / 0.5);
        ctx.fillStyle = `rgba(255, 100, 0, ${exp.life})`;
        ctx.beginPath();
        ctx.arc(
            (exp.x - player.x) * 0.3 + canvas.width / 2,
            (exp.y - player.y) * 0.3 + canvas.height / 2 + 100,
            exp.radius,
            0,
            Math.PI * 2
        );
        ctx.fill();
    });

    // Draw shots (bullets)
    ctx.fillStyle = '#ffff00';
    shots.forEach(shot => {
        if (shot.owner === 'player') {
            ctx.beginPath();
            ctx.arc(
                (shot.x - player.x) * 0.3 + canvas.width / 2,
                (shot.y - player.y) * 0.3 + canvas.height / 2 + 100,
                3,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }
    });

    drawAircraft();
    drawHUD();
    drawMinimap();
}

// ==================== GAME LOOP ====================
let lastTime = Date.now();

function gameLoop() {
    const now = Date.now();
    const deltaTime = Math.min((now - lastTime) / 1000, 0.016); // Cap at 60fps
    lastTime = now;

    update(deltaTime);
    draw();

    requestAnimationFrame(gameLoop);
}

// Start game
initGame();
gameLoop();
