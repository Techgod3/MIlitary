const canvas = document.getElementById("flightRenderCanvas");
const ctx = canvas.getContext("2d");
const dashPerf = document.getElementById("dash-perf");

const CONFIG = {
    WORLD_DEPTH: 3500,
    MAX_SPEED: 45,
    MIN_SPEED: 12,
    GRAVITY: 0.15,
    VULCAN_COOLDOWN: 4,
    SAM_SPAWN_CHANCE: 0.006,
    MAX_PARTICLES: 220,
    PLAYER_MISSILE_COOLDOWN: 40,
    PLAYER_MISSILE_SPEED: 32,
    PLAYER_MISSILE_TURN: 0.08
};

let player = {
    x: 0,
    y: -350,
    z: 0,
    vx: 0,
    vy: 0,
    speed: 24,
    pitch: 0,
    roll: 0,
    yaw: 0,
    health: 100,
    flares: 4,
    ammo: 800,
    missiles: 8,
    score: 0,
    heatSignature: 1.0
};

const inputKeys = { w: false, s: false, a: false, d: false, f: false, " ": false, q: false };
let weaponFireTimer = 0;
let flareDeploymentTimer = 0;
let missileFireTimer = 0;
let systemClock = 0;
let isGameOver = false;
let gameOverReason = "";

const terrainNodes = [];
const militaryOutposts = [];
const surfaceToAirMissiles = [];
const dynamicParticles = [];
const dynamicLasers = [];
const playerMissiles = [];

let currentLockTarget = null;

// Sound hooks (add your own .wav files in same folder)
const sfx = {
    gun: new Audio("sfx_gun.wav"),
    missile: new Audio("sfx_missile.wav"),
    flare: new Audio("sfx_flare.wav"),
    explosion: new Audio("sfx_explosion.wav"),
    warning: new Audio("sfx_warning.wav")
};
Object.values(sfx).forEach(a => { if (a) a.volume = 0.4; });

// Keyboard input
window.addEventListener("keydown", (e) => {
    const key = e.key.toLowerCase();
    if (key in inputKeys) inputKeys[key] = true;
    if (isGameOver && key === "enter") resetGame();
});

window.addEventListener("keyup", (e) => {
    const key = e.key.toLowerCase();
    if (key in inputKeys) inputKeys[key] = false;
});

// Mobile controls
const mcButtons = document.querySelectorAll(".mc-btn");
mcButtons.forEach(btn => {
    const key = btn.getAttribute("data-key");
    btn.addEventListener("touchstart", (e) => {
        e.preventDefault();
        if (key in inputKeys) inputKeys[key] = true;
    });
    btn.addEventListener("touchend", (e) => {
        e.preventDefault();
        if (key in inputKeys) inputKeys[key] = false;
    });
});

// World generation
function generateInitialWorldEntities() {
    terrainNodes.length = 0;
    militaryOutposts.length = 0;

    for (let i = 0; i < 24; i++) {
        terrainNodes.push({
            x: (i * 250) - 3000,
            baseY: -40,
            height: 180 + Math.random() * 240,
            width: 400 + Math.random() * 300,
            seedPhase: Math.random() * Math.PI
        });
    }
    for (let i = 0; i < 18; i++) {
        createNewMilitaryOutpost(300 + (i * 180));
    }
}

function createNewMilitaryOutpost(forcedZ = null) {
    militaryOutposts.push({
        id: Math.random().toString(36).substring(2, 9),
        x: (Math.random() * 3600) - 1800,
        y: 0,
        z: forcedZ !== null ? forcedZ : CONFIG.WORLD_DEPTH + (Math.random() * 400),
        width: 40 + Math.random() * 30,
        height: 90 + Math.random() * 110,
        isDestroyed: false,
        hitboxRadius: 50,
        colorHue: Math.floor(Math.random() * 20) + 140
    });
}

function spawnExplosionParticles(x, y, z, count = 15, isFlak = false) {
    for (let i = 0; i < count; i++) {
        if (dynamicParticles.length >= CONFIG.MAX_PARTICLES) break;
        dynamicParticles.push({
            x: x + (Math.random() * 40 - 20),
            y: y + (Math.random() * 40 - 20),
            z: z + (Math.random() * 40 - 20),
            vx: (Math.random() * 12 - 6),
            vy: (Math.random() * 12 - 6) - (isFlak ? 2 : 0),
            vz: (Math.random() * 12 - 6),
            life: 1.0,
            decay: 0.02 + Math.random() * 0.04,
            size: 3 + Math.random() * 8,
            color: isFlak ? "#ffcc00" : `rgba(255, ${Math.floor(Math.random() * 150 + 50)}, 0, `
        });
    }
}

// Lock-on: nearest outpost in front
function updateLockTarget() {
    let best = null;
    let bestZ = Infinity;
    militaryOutposts.forEach(o => {
        if (o.isDestroyed) return;
        if (o.z < 80 || o.z > 1600) return;
        const dx = o.x - player.x;
        if (Math.abs(dx) > 600) return;
        if (o.z < bestZ) {
            bestZ = o.z;
            best = o;
        }
    });
    currentLockTarget = best;
}

// Player missile launch
function firePlayerMissile() {
    if (missileFireTimer > 0 || player.missiles <= 0 || !currentLockTarget) return;
    player.missiles--;
    missileFireTimer = CONFIG.PLAYER_MISSILE_COOLDOWN;

    playerMissiles.push({
        x: player.x,
        y: player.y,
        z: 60,
        speed: CONFIG.PLAYER_MISSILE_SPEED,
        target: currentLockTarget,
        alive: true
    });

    if (sfx.missile) { sfx.missile.currentTime = 0; sfx.missile.play(); }
}

// Physics + game logic
function updateSimulationPhysics(delta) {
    if (isGameOver) return;
    systemClock++;

    // Controls
    if (inputKeys['w']) { player.pitch -= 0.025; player.vy -= 0.45; }
    if (inputKeys['s']) { player.pitch += 0.025; player.vy += 0.45; }
    if (inputKeys['a']) { player.roll -= 0.045; player.vx -= 0.65; }
    if (inputKeys['d']) { player.roll += 0.045; player.vx += 0.65; }

    if (!inputKeys['a'] && !inputKeys['d']) player.roll *= 0.82;
    if (!inputKeys['w'] && !inputKeys['s']) player.pitch *= 0.82;

    player.vx *= 0.91;
    player.vy *= 0.91;
    player.x += player.vx;
    player.y += player.vy;

    // Bounds
    if (player.x < -1400) player.x = -1400;
    if (player.x > 1400) player.x = 1400;
    if (player.y > -80) triggerCrashSequence("TERRAIN COLLISION DETECTED: AIRFRAME LOST");
    if (player.y < -1800) player.y = -1800;

    // Timers
    if (weaponFireTimer > 0) weaponFireTimer--;
    if (flareDeploymentTimer > 0) flareDeploymentTimer--;
    if (missileFireTimer > 0) missileFireTimer--;

    // Gun
    if (inputKeys[' '] && weaponFireTimer === 0 && player.ammo > 0) {
        player.ammo -= 2;
        weaponFireTimer = CONFIG.VULCAN_COOLDOWN;

        dynamicLasers.push({ x: player.x - 30, y: player.y + 20, z: 60, targetY: player.y + (player.pitch * 300) });
        dynamicLasers.push({ x: player.x + 30, y: player.y + 20, z: 60, targetY: player.y + (player.pitch * 300) });

        if (sfx.gun) { sfx.gun.currentTime = 0; sfx.gun.play(); }

        militaryOutposts.forEach(outpost => {
            if (!outpost.isDestroyed && outpost.z < 900 && outpost.z > 100) {
                if (Math.abs(outpost.x - player.x) < 75) {
                    outpost.isDestroyed = true;
                    player.score += 500;
                    spawnExplosionParticles(outpost.x, -outpost.height / 2, outpost.z, 25);
                    if (sfx.explosion) { sfx.explosion.currentTime = 0; sfx.explosion.play(); }
                }
            }
        });
    }

    // Flares
    if (inputKeys['f'] && flareDeploymentTimer === 0 && player.flares > 0) {
        player.flares--;
        flareDeploymentTimer = 25;
        player.heatSignature = 0.1;
        for (let i = 0; i < 8; i++) {
            if (dynamicParticles.length >= CONFIG.MAX_PARTICLES) break;
            dynamicParticles.push({
                x: player.x, y: player.y + 30, z: 100,
                vx: (Math.random() * 16 - 8), vy: 5 + Math.random() * 5, vz: Math.random() * 5,
                life: 1.0, decay: 0.015, size: 4 + Math.random() * 4, color: "rgba(255, 255, 230, "
            });
        }
        if (sfx.flare) { sfx.flare.currentTime = 0; sfx.flare.play(); }
    }

    if (player.heatSignature < 1.0) player.heatSignature += 0.005;

    // Player missiles
    if (inputKeys['q']) {
        firePlayerMissile();
    }

    // Outposts
    militaryOutposts.forEach(outpost => {
        outpost.z -= player.speed * 0.4;
        if (!outpost.isDestroyed && outpost.z < 1600 && outpost.z > 400 && Math.random() < CONFIG.SAM_SPAWN_CHANCE) {
            triggerSAMBatteryLaunch(outpost.x, -outpost.height, outpost.z);
        }
        if (outpost.z < 20) {
            outpost.z = CONFIG.WORLD_DEPTH;
            outpost.x = (Math.random() * 3200) - 1600;
            outpost.isDestroyed = false;
        }
    });

    // SAMs
    for (let i = surfaceToAirMissiles.length - 1; i >= 0; i--) {
        let sam = surfaceToAirMissiles[i];
        sam.z -= player.speed * 0.4;
        let dx = player.x - sam.x;
        let dy = player.y - sam.y;

        if (player.heatSignature > 0.3) {
            sam.x += dx * sam.trackingAgility;
            sam.y += dy * sam.trackingAgility;
        } else {
            sam.x += Math.sin(systemClock + i) * 6;
        }
        sam.z -= sam.propulsionSpeed;

        if (dynamicParticles.length < CONFIG.MAX_PARTICLES) {
            dynamicParticles.push({
                x: sam.x, y: sam.y, z: sam.z,
                vx: Math.random() * 2 - 1, vy: Math.random() * 2 - 1, vz: 2,
                life: 0.8, decay: 0.04, size: 2 + Math.random() * 3, color: "rgba(200, 200, 200, "
            });
        }

        let distanceVector = Math.hypot(dx, dy, (sam.z - 40));
        if (distanceVector < 65) {
            player.health -= 35;
            spawnExplosionParticles(sam.x, sam.y, sam.z, 30, true);
            surfaceToAirMissiles.splice(i, 1);
            if (sfx.explosion) { sfx.explosion.currentTime = 0; sfx.explosion.play(); }
            if (player.health <= 0) {
                triggerCrashSequence("KIA: ENEMY SAM IMPACT");
            }
            continue;
        }
        if (sam.z < 10 || sam.z > CONFIG.WORLD_DEPTH + 500) {
            surfaceToAirMissiles.splice(i, 1);
        }
    }

    // Player missiles homing
    for (let i = playerMissiles.length - 1; i >= 0; i--) {
        const m = playerMissiles[i];
        if (!m.alive || !m.target || m.target.isDestroyed) {
            playerMissiles.splice(i, 1);
            continue;
        }
        m.z += m.speed;

        const dx = m.target.x - m.x;
        const dy = m.target.y - m.y;
        const dz = m.target.z - m.z;

        const dist = Math.hypot(dx, dy, dz);
        if (dist < 40) {
            m.target.isDestroyed = true;
            player.score += 800;
            spawnExplosionParticles(m.target.x, -m.target.height / 2, m.target.z, 30);
            if (sfx.explosion) { sfx.explosion.currentTime = 0; sfx.explosion.play(); }
            playerMissiles.splice(i, 1);
            continue;
        }

        m.x += dx * CONFIG.PLAYER_MISSILE_TURN;
        m.y += dy * CONFIG.PLAYER_MISSILE_TURN;

        if (m.z > CONFIG.WORLD_DEPTH + 500) {
            playerMissiles.splice(i, 1);
        }
    }

    // Particles
    for (let i = dynamicParticles.length - 1; i >= 0; i--) {
        let p = dynamicParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.z -= player.speed * 0.4;
        p.life -= p.decay;
        if (p.life <= 0) dynamicParticles.splice(i, 1);
    }
    if (dynamicLasers.length > 0) dynamicLasers.splice(0, dynamicLasers.length);

    // Lock target update
    updateLockTarget();
}

function triggerSAMBatteryLaunch(outX, outY, outZ) {
    surfaceToAirMissiles.push({
        x: outX, y: outY, z: outZ,
        propulsionSpeed: 14 + Math.random() * 6,
        trackingAgility: 0.06,
        trackingLockId: Math.floor(Math.random() * 900 + 100)
    });
    if (sfx.warning) { sfx.warning.currentTime = 0; sfx.warning.play(); }
}

function triggerCrashSequence(reasonText) {
    isGameOver = true;
    gameOverReason = reasonText;
}

function resetGame() {
    player = {
        x: 0,
        y: -350,
        z: 0,
        vx: 0,
        vy: 0,
        speed: 24,
        pitch: 0,
        roll: 0,
        yaw: 0,
        health: 100,
        flares: 4,
        ammo: 800,
        missiles: 8,
        score: 0,
        heatSignature: 1.0
    };
    surfaceToAirMissiles.length = 0;
    dynamicParticles.length = 0;
    dynamicLasers.length = 0;
    playerMissiles.length = 0;
    currentLockTarget = null;
    isGameOver = false;
    gameOverReason = "";
    generateInitialWorldEntities();
}

// Rendering
function renderSimulationPipeline() {
    ctx.fillStyle = "#020507";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let visualHorizonY = (canvas.height / 2) - (player.y * 0.15) + (player.pitch * 250);

    // Sky (military cold blue)
    let skyGrad = ctx.createLinearGradient(0, 0, 0, visualHorizonY);
    skyGrad.addColorStop(0, "#020b14");
    skyGrad.addColorStop(0.6, "#0e1f2d");
    skyGrad.addColorStop(1.0, "#1a2f3f");
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, canvas.width, visualHorizonY);

    // Water (dark, hostile)
    let waterGrad = ctx.createLinearGradient(0, visualHorizonY, 0, canvas.height);
    waterGrad.addColorStop(0, "#031a12");
    waterGrad.addColorStop(0.4, "#02100b");
    waterGrad.addColorStop(1.0, "#000604");
    ctx.fillStyle = waterGrad;
    ctx.fillRect(0, visualHorizonY, canvas.width, canvas.height - visualHorizonY);

    // Terrain
    ctx.fillStyle = "#0b1b14";
    ctx.strokeStyle = "#163526";
    ctx.lineWidth = 1;
    terrainNodes.forEach(m => {
        let dynamicParallaxX = (canvas.width / 2) + (m.x - (player.x * 0.3));
        ctx.beginPath();
        ctx.moveTo(dynamicParallaxX, visualHorizonY);
        ctx.lineTo(dynamicParallaxX + m.width / 2, visualHorizonY - m.height);
        ctx.lineTo(dynamicParallaxX + m.width, visualHorizonY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    });

    // Outposts
    militaryOutposts.sort((a, b) => b.z - a.z);
    militaryOutposts.forEach(outpost => {
        if (outpost.z <= 30) return;
        let perspectiveFactor = 450 / outpost.z;
        let screenX = (canvas.width / 2) + ((outpost.x - player.x) * perspectiveFactor);
        let screenY = visualHorizonY - (player.y * 0.1) * perspectiveFactor;
        let targetW = outpost.width * perspectiveFactor;
        let targetH = outpost.height * perspectiveFactor;

        ctx.save();
        if (outpost.isDestroyed) {
            ctx.fillStyle = "#111111";
            ctx.strokeStyle = "#333333";
            ctx.fillRect(screenX - targetW / 2, screenY - 10, targetW, 10);
        } else {
            ctx.fillStyle = `hsl(${outpost.colorHue}, 18%, 18%)`;
            ctx.strokeStyle = "#2da45e";
            ctx.lineWidth = Math.max(0.5, perspectiveFactor * 0.8);
            ctx.fillRect(screenX - targetW / 2, screenY - targetH, targetW, targetH);
            ctx.strokeRect(screenX - targetW / 2, screenY - targetH, targetW, targetH);

            // Mast line
            ctx.strokeStyle = "rgba(45,164,94,0.15)";
            ctx.beginPath();
            ctx.moveTo(screenX, screenY - targetH);
            ctx.lineTo(screenX, screenY);
            ctx.stroke();

            // Lock box
            if (currentLockTarget && currentLockTarget.id === outpost.id) {
                ctx.strokeStyle = "#ffcc33";
                ctx.lineWidth = 2;
                ctx.strokeRect(screenX - targetW / 2 - 6, screenY - targetH - 6, targetW + 12, targetH + 12);
            }
        }
        ctx.restore();
    });

    // SAMs
    surfaceToAirMissiles.forEach(sam => {
        if (sam.z <= 30) return;
        let pf = 450 / sam.z;
        let sx = (canvas.width / 2) + ((sam.x - player.x) * pf);
        let sy = visualHorizonY - (player.y * 0.1) * pf;
        let size = 6 * pf;
        ctx.fillStyle = "#ff4444";
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(1, size), 0, Math.PI * 2);
        ctx.fill();
    });

    // Player missiles
    playerMissiles.forEach(m => {
        if (m.z <= 30) return;
        let pf = 450 / m.z;
        let sx = (canvas.width / 2) + ((m.x - player.x) * pf);
        let sy = visualHorizonY - (player.y * 0.1) * pf;
        let size = 5 * pf;
        ctx.fillStyle = "#ffff66";
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(1, size), 0, Math.PI * 2);
        ctx.fill();
    });

    // Particles
    dynamicParticles.forEach(p => {
        if (p.z <= 30) return;
        let pf = 450 / p.z;
        let sx = (canvas.width / 2) + ((p.x - player.x) * pf);
        let sy = visualHorizonY - (player.y * 0.1) * pf;
        let size = p.size * pf;
        ctx.fillStyle = p.color + p.life + ")";
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(1, size), 0, Math.PI * 2);
        ctx.fill();
    });

    // Simple jet silhouette at center
    renderJetSilhouette();

    // HUD + radar + game over
    renderHUD(visualHorizonY);
    renderRadar();
    if (isGameOver) renderGameOver();
}

function renderJetSilhouette() {
    const centerX = canvas.width / 2;
    const centerY = canvas.height * 0.7;

    ctx.save();
    ctx.fillStyle = "#2b2f33";
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - 18);
    ctx.lineTo(centerX - 26, centerY + 10);
    ctx.lineTo(centerX + 26, centerY + 10);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(255,120,40,0.6)";
    ctx.beginPath();
    ctx.arc(centerX, centerY + 18, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function renderHUD(visualHorizonY) {
    ctx.save();
    ctx.fillStyle = "#7fffb2";
    ctx.font = "14px Consolas";

    ctx.fillText(`ALTITUDE: ${Math.max(0, Math.round(-player.y))} M`, 20, 30);
    ctx.fillText(`AIRSPEED: ${Math.round(player.speed)} KT`, 20, 50);
    ctx.fillText(`STRUCTURAL INTEGRITY: ${Math.max(0, player.health)}%`, 20, 70);
    ctx.fillText(`VULCAN ROUNDS: ${player.ammo}`, 20, 90);
    ctx.fillText(`A2G MISSILES: ${player.missiles}`, 20, 110);
    ctx.fillText(`COUNTERMEASURES: ${player.flares}`, 20, 130);
    ctx.fillText(`MISSION SCORE: ${player.score}`, 20, 150);

    if (currentLockTarget) {
        ctx.fillStyle = "#ffcc33";
        ctx.fillText("TARGET ACQUIRED", canvas.width / 2 - 70, visualHorizonY + 40);
    }

    if (player.health < 40 && !isGameOver) {
        ctx.fillStyle = "#ff3333";
        ctx.fillText("MASTER CAUTION", canvas.width / 2 - 70, 40);
    }

    ctx.restore();
}

function renderRadar() {
    const radarRadius = 70;
    const cx = canvas.width - radarRadius - 20;
    const cy = canvas.height - radarRadius - 20;

    ctx.save();
    ctx.strokeStyle = "#1b4b2b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radarRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Rings
    ctx.strokeStyle = "rgba(127,255,178,0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, radarRadius * 0.5, 0, Math.PI * 2);
    ctx.stroke();

    // Player center
    ctx.fillStyle = "#7fffb2";
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();

    const radarRange = 2000;

    // Outposts
    militaryOutposts.forEach(o => {
        const dz = o.z;
        if (dz < 0 || dz > radarRange) return;
        const dx = o.x - player.x;
        const rx = (dx / radarRange) * radarRadius;
        const ry = (dz / radarRange) * radarRadius;
        ctx.fillStyle = o.isDestroyed ? "#555555" : "#2da45e";
        ctx.fillRect(cx + rx - 2, cy - ry - 2, 4, 4);
    });

    // SAMs
    surfaceToAirMissiles.forEach(sam => {
        const dz = sam.z;
        if (dz < 0 || dz > radarRange) return;
        const dx = sam.x - player.x;
        const rx = (dx / radarRange) * radarRadius;
        const ry = (dz / radarRange) * radarRadius;
        ctx.fillStyle = "#ff4444";
        ctx.fillRect(cx + rx - 2, cy - ry - 2, 4, 4);
    });

    ctx.restore();
}

function renderGameOver() {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#ff4444";
    ctx.font = "28px Consolas";
    ctx.textAlign = "center";
    ctx.fillText("MISSION FAILED", canvas.width / 2, canvas.height / 2 - 20);

    ctx.fillStyle = "#ffffff";
    ctx.font = "16px Consolas";
    ctx.fillText(gameOverReason, canvas.width / 2, canvas.height / 2 + 10);
    ctx.fillText("Press ENTER to re-initiate mission", canvas.width / 2, canvas.height / 2 + 40);

    ctx.restore();
}

// Game loop + FPS
let lastTime = performance.now();
let fpsAccumulator = 0;
let fpsFrames = 0;

function gameLoop(timestamp) {
    const delta = timestamp - lastTime;
    lastTime = timestamp;

    updateSimulationPhysics(delta / 16.67);
    renderSimulationPipeline();

    fpsAccumulator += delta;
    fpsFrames++;
    if (fpsAccumulator >= 500) {
        const currentFPS = Math.round((fpsFrames / fpsAccumulator) * 1000);
        fpsAccumulator = 0;
        fpsFrames = 0;
        dashPerf.textContent = `${currentFPS} FPS`;
    }

    requestAnimationFrame(gameLoop);
}

// Init
generateInitialWorldEntities();
requestAnimationFrame(gameLoop);
