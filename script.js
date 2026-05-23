const canvas = document.getElementById("flightRenderCanvas");
const ctx = canvas.getContext("2d");
const dashPerf = document.getElementById("dash-perf");

const CONFIG = {
    WORLD_DEPTH: 5000,
    MAX_SPEED: 55,
    MIN_SPEED: 18,
    GRAVITY: 0.15,
    VULCAN_COOLDOWN: 4,
    SAM_SPAWN_CHANCE: 0.008,
    MAX_PARTICLES: 350,
    PLAYER_MISSILE_COOLDOWN: 40,
    PLAYER_MISSILE_SPEED: 32,
    PLAYER_MISSILE_TURN: 0.08,
    TERRAIN_DETAIL: 8
};

let player = {
    x: 0,
    y: -450,
    z: 0,
    vx: 0,
    vy: 0,
    speed: 30,
    pitch: 0,
    roll: 0,
    yaw: 0,
    health: 100,
    flares: 6,
    ammo: 1200,
    missiles: 12,
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
const mountainPeaks = [];
const militaryOutposts = [];
const surfaceToAirMissiles = [];
const dynamicParticles = [];
const dynamicLasers = [];
const playerMissiles = [];
const clouds = [];

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

// Perlin-like noise for natural terrain
function perlinNoise(x, seed = 0) {
    const n = Math.sin(x * 12.9898 + seed * 78.233) * 43758.5453;
    return n - Math.floor(n);
}

// World generation
function generateInitialWorldEntities() {
    terrainNodes.length = 0;
    mountainPeaks.length = 0;
    militaryOutposts.length = 0;
    clouds.length = 0;

    // Generate detailed terrain
    for (let i = 0; i < 60; i++) {
        const z = (i * 150) - 5000;
        const baseHeight = 150 + Math.sin(z / 800) * 200 + Math.random() * 150;
        terrainNodes.push({
            x: (i * 250) - 5000,
            baseY: -40,
            height: baseHeight,
            width: 350 + Math.random() * 250,
            seedPhase: Math.random() * Math.PI,
            z: z,
            complexity: Math.random() * 0.8 + 0.3
        });
    }

    // Generate mountain peaks
    for (let i = 0; i < 15; i++) {
        const peakZ = Math.random() * CONFIG.WORLD_DEPTH;
        mountainPeaks.push({
            x: (Math.random() * 3000) - 1500,
            z: peakZ,
            height: 400 + Math.random() * 600,
            width: 200 + Math.random() * 300,
            slope: 0.4 + Math.random() * 0.3,
            snowline: -200 - Math.random() * 150,
            color: Math.floor(Math.random() * 15) + 140
        });
    }

    // Generate clouds for depth
    for (let i = 0; i < 40; i++) {
        clouds.push({
            x: (Math.random() * 4000) - 2000,
            y: -200 - Math.random() * 300,
            z: Math.random() * CONFIG.WORLD_DEPTH,
            width: 80 + Math.random() * 120,
            opacity: 0.2 + Math.random() * 0.3,
            speed: 0.3 + Math.random() * 0.2
        });
    }

    // Military outposts
    for (let i = 0; i < 22; i++) {
        createNewMilitaryOutpost(400 + (i * 200));
    }
}

function createNewMilitaryOutpost(forcedZ = null) {
    militaryOutposts.push({
        id: Math.random().toString(36).substring(2, 9),
        x: (Math.random() * 3600) - 1800,
        y: 0,
        z: forcedZ !== null ? forcedZ : CONFIG.WORLD_DEPTH + (Math.random() * 500),
        width: 45 + Math.random() * 35,
        height: 110 + Math.random() * 130,
        isDestroyed: false,
        hitboxRadius: 55,
        colorHue: Math.floor(Math.random() * 25) + 135,
        type: Math.random() > 0.6 ? "radar" : "installation"
    });
}

function spawnExplosionParticles(x, y, z, count = 20, isFlak = false) {
    for (let i = 0; i < count; i++) {
        if (dynamicParticles.length >= CONFIG.MAX_PARTICLES) break;
        dynamicParticles.push({
            x: x + (Math.random() * 60 - 30),
            y: y + (Math.random() * 60 - 30),
            z: z + (Math.random() * 60 - 30),
            vx: (Math.random() * 14 - 7),
            vy: (Math.random() * 14 - 7) - (isFlak ? 3 : 0),
            vz: (Math.random() * 14 - 7),
            life: 1.0,
            decay: 0.018 + Math.random() * 0.035,
            size: 4 + Math.random() * 10,
            color: isFlak ? "#ffdd00" : `rgba(255, ${Math.floor(Math.random() * 180 + 50)}, 0, `,
            glow: isFlak ? 0.8 : 0.5
        });
    }
}

// Lock-on: nearest outpost in front
function updateLockTarget() {
    let best = null;
    let bestZ = Infinity;
    militaryOutposts.forEach(o => {
        if (o.isDestroyed) return;
        if (o.z < 100 || o.z > 2000) return;
        const dx = o.x - player.x;
        if (Math.abs(dx) > 700) return;
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

    // Improved controls with momentum
    if (inputKeys['w']) { player.pitch = Math.max(player.pitch - 0.028, -0.8); player.vy -= 0.5; }
    if (inputKeys['s']) { player.pitch = Math.min(player.pitch + 0.028, 0.8); player.vy += 0.5; }
    if (inputKeys['a']) { player.roll = Math.max(player.roll - 0.05, -1.2); player.vx -= 0.7; }
    if (inputKeys['d']) { player.roll = Math.min(player.roll + 0.05, 1.2); player.vx += 0.7; }

    if (!inputKeys['a'] && !inputKeys['d']) player.roll *= 0.84;
    if (!inputKeys['w'] && !inputKeys['s']) player.pitch *= 0.85;

    // Improved velocity damping
    player.vx *= 0.92;
    player.vy *= 0.92;
    player.x += player.vx;
    player.y += player.vy;

    // Dynamic speed based on throttle
    player.speed = 24 + (player.y * -0.02);
    player.speed = Math.max(CONFIG.MIN_SPEED, Math.min(CONFIG.MAX_SPEED, player.speed));

    // Bounds
    if (player.x < -1600) player.x = -1600;
    if (player.x > 1600) player.x = 1600;
    if (player.y > -70) triggerCrashSequence("TERRAIN COLLISION DETECTED: AIRFRAME LOST");
    if (player.y < -2500) player.y = -2500;

    // Timers
    if (weaponFireTimer > 0) weaponFireTimer--;
    if (flareDeploymentTimer > 0) flareDeploymentTimer--;
    if (missileFireTimer > 0) missileFireTimer--;

    // Gun with better hit detection
    if (inputKeys[' '] && weaponFireTimer === 0 && player.ammo > 0) {
        player.ammo -= 2;
        weaponFireTimer = CONFIG.VULCAN_COOLDOWN;

        dynamicLasers.push({ x: player.x - 35, y: player.y + 15, z: 60, targetY: player.y + (player.pitch * 350) });
        dynamicLasers.push({ x: player.x + 35, y: player.y + 15, z: 60, targetY: player.y + (player.pitch * 350) });

        if (sfx.gun) { sfx.gun.currentTime = 0; sfx.gun.play(); }

        militaryOutposts.forEach(outpost => {
            if (!outpost.isDestroyed && outpost.z < 1100 && outpost.z > 120) {
                if (Math.abs(outpost.x - player.x) < 85 && Math.abs(outpost.y + 50) < 100) {
                    outpost.isDestroyed = true;
                    player.score += 500;
                    spawnExplosionParticles(outpost.x, -outpost.height / 2, outpost.z, 30);
                    if (sfx.explosion) { sfx.explosion.currentTime = 0; sfx.explosion.play(); }
                }
            }
        });
    }

    // Flares with better effect
    if (inputKeys['f'] && flareDeploymentTimer === 0 && player.flares > 0) {
        player.flares--;
        flareDeploymentTimer = 30;
        player.heatSignature = 0.05;
        for (let i = 0; i < 12; i++) {
            if (dynamicParticles.length >= CONFIG.MAX_PARTICLES) break;
            dynamicParticles.push({
                x: player.x + Math.random() * 40 - 20, 
                y: player.y + 40, 
                z: 80 + Math.random() * 40,
                vx: (Math.random() * 18 - 9), 
                vy: 6 + Math.random() * 8, 
                vz: Math.random() * 8 - 4,
                life: 1.0, 
                decay: 0.012, 
                size: 5 + Math.random() * 5, 
                color: "rgba(255, 255, 200, "
            });
        }
        if (sfx.flare) { sfx.flare.currentTime = 0; sfx.flare.play(); }
    }

    if (player.heatSignature < 1.0) player.heatSignature += 0.004;

    // Player missiles
    if (inputKeys['q']) {
        firePlayerMissile();
    }

    // Outposts
    militaryOutposts.forEach(outpost => {
        outpost.z -= player.speed * 0.5;
        if (!outpost.isDestroyed && outpost.z < 1800 && outpost.z > 500 && Math.random() < CONFIG.SAM_SPAWN_CHANCE) {
            triggerSAMBatteryLaunch(outpost.x, -outpost.height, outpost.z);
        }
        if (outpost.z < 0) {
            outpost.z = CONFIG.WORLD_DEPTH;
            outpost.x = (Math.random() * 3200) - 1600;
            outpost.isDestroyed = false;
        }
    });

    // Mountains move with camera
    mountainPeaks.forEach(peak => {
        peak.z -= player.speed * 0.5;
        if (peak.z < -500) {
            peak.z = CONFIG.WORLD_DEPTH + 500;
            peak.x = (Math.random() * 3000) - 1500;
        }
    });

    // Clouds parallax
    clouds.forEach(cloud => {
        cloud.z -= player.speed * 0.3;
        cloud.x += Math.sin(systemClock * 0.01 + cloud.x) * cloud.speed;
        if (cloud.z < -500) {
            cloud.z = CONFIG.WORLD_DEPTH + 500;
            cloud.x = (Math.random() * 4000) - 2000;
        }
    });

    // SAMs
    for (let i = surfaceToAirMissiles.length - 1; i >= 0; i--) {
        let sam = surfaceToAirMissiles[i];
        sam.z -= player.speed * 0.5;
        let dx = player.x - sam.x;
        let dy = player.y - sam.y;

        if (player.heatSignature > 0.25) {
            sam.x += dx * sam.trackingAgility;
            sam.y += dy * sam.trackingAgility;
        } else {
            sam.x += Math.sin(systemClock + i) * 8;
        }
        sam.z -= sam.propulsionSpeed;

        if (dynamicParticles.length < CONFIG.MAX_PARTICLES) {
            dynamicParticles.push({
                x: sam.x, y: sam.y, z: sam.z,
                vx: Math.random() * 2 - 1, vy: Math.random() * 2 - 1, vz: 3,
                life: 0.8, decay: 0.035, size: 2.5 + Math.random() * 4, color: "rgba(220, 220, 220, "
            });
        }

        let distanceVector = Math.hypot(dx, dy, (sam.z - 40));
        if (distanceVector < 75) {
            player.health -= 40;
            spawnExplosionParticles(sam.x, sam.y, sam.z, 35, true);
            surfaceToAirMissiles.splice(i, 1);
            if (sfx.explosion) { sfx.explosion.currentTime = 0; sfx.explosion.play(); }
            if (player.health <= 0) {
                triggerCrashSequence("KIA: ENEMY SAM IMPACT");
            }
            continue;
        }
        if (sam.z < -100 || sam.z > CONFIG.WORLD_DEPTH + 500) {
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
        if (dist < 50) {
            m.target.isDestroyed = true;
            player.score += 1200;
            spawnExplosionParticles(m.target.x, -m.target.height / 2, m.target.z, 40);
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
        p.z -= player.speed * 0.5;
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
        propulsionSpeed: 16 + Math.random() * 8,
        trackingAgility: 0.065,
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
        y: -450,
        z: 0,
        vx: 0,
        vy: 0,
        speed: 30,
        pitch: 0,
        roll: 0,
        yaw: 0,
        health: 100,
        flares: 6,
        ammo: 1200,
        missiles: 12,
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

// Enhanced Rendering
function renderSimulationPipeline() {
    // Dynamic sky based on altitude
    const altitudePercent = Math.max(0, Math.min(1, (-player.y) / 2500));
    
    let skyColor1 = interpolateColor("#1a3a52", "#2563eb", altitudePercent);
    let skyColor2 = interpolateColor("#2d5a7b", "#60a5fa", altitudePercent);
    let horizonColor = interpolateColor("#3d6b8a", "#93c5fd", altitudePercent);
    let groundColor = interpolateColor("#0f1419", "#1a2537", altitudePercent * 0.5);

    let visualHorizonY = (canvas.height / 2) - (player.y * 0.12) + (player.pitch * 280);

    // Beautiful gradient sky
    let skyGrad = ctx.createLinearGradient(0, 0, 0, visualHorizonY);
    skyGrad.addColorStop(0, skyColor1);
    skyGrad.addColorStop(0.5, skyColor2);
    skyGrad.addColorStop(1.0, horizonColor);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, canvas.width, visualHorizonY);

    // Ground/water gradient
    let groundGrad = ctx.createLinearGradient(0, visualHorizonY, 0, canvas.height);
    groundGrad.addColorStop(0, groundColor);
    groundGrad.addColorStop(0.5, "#050a0f");
    groundGrad.addColorStop(1.0, "#000102");
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, visualHorizonY, canvas.width, canvas.height - visualHorizonY);

    // Clouds rendering
    renderClouds(visualHorizonY);

    // Mountains - detailed rendering
    renderMountains(visualHorizonY);

    // Terrain
    renderTerrain(visualHorizonY);

    // Military outposts
    militaryOutposts.sort((a, b) => b.z - a.z);
    militaryOutposts.forEach(outpost => {
        if (outpost.z <= 30) return;
        let perspectiveFactor = 500 / outpost.z;
        let screenX = (canvas.width / 2) + ((outpost.x - player.x) * perspectiveFactor);
        let screenY = visualHorizonY - (player.y * 0.08) * perspectiveFactor;
        let targetW = outpost.width * perspectiveFactor;
        let targetH = outpost.height * perspectiveFactor;

        ctx.save();
        if (outpost.isDestroyed) {
            ctx.fillStyle = "#1a1a1a";
            ctx.strokeStyle = "#444444";
            ctx.fillRect(screenX - targetW / 2, screenY - 15, targetW, 15);
        } else {
            ctx.fillStyle = `hsl(${outpost.colorHue}, 22%, 22%)`;
            ctx.shadowColor = `hsl(${outpost.colorHue}, 100%, 50%)`;
            ctx.shadowBlur = 8;
            ctx.strokeStyle = "#00ff88";
            ctx.lineWidth = Math.max(0.8, perspectiveFactor * 1.0);
            ctx.fillRect(screenX - targetW / 2, screenY - targetH, targetW, targetH);
            ctx.strokeRect(screenX - targetW / 2, screenY - targetH, targetW, targetH);

            // Tactical details
            ctx.strokeStyle = "rgba(0,255,136,0.3)";
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(screenX, screenY - targetH);
            ctx.lineTo(screenX, screenY);
            ctx.stroke();

            // Radar antenna
            if (outpost.type === "radar") {
                ctx.fillStyle = "#ffcc00";
                ctx.beginPath();
                ctx.arc(screenX, screenY - targetH - 5, 2 + perspectiveFactor, 0, Math.PI * 2);
                ctx.fill();
            }

            // Lock box
            if (currentLockTarget && currentLockTarget.id === outpost.id) {
                ctx.shadowColor = "#ffcc33";
                ctx.shadowBlur = 12;
                ctx.strokeStyle = "#ffcc33";
                ctx.lineWidth = 2.5;
                ctx.strokeRect(screenX - targetW / 2 - 8, screenY - targetH - 8, targetW + 16, targetH + 16);
            }
        }
        ctx.restore();
    });

    // SAMs with glow effect
    surfaceToAirMissiles.forEach(sam => {
        if (sam.z <= 30) return;
        let pf = 500 / sam.z;
        let sx = (canvas.width / 2) + ((sam.x - player.x) * pf);
        let sy = visualHorizonY - (player.y * 0.08) * pf;
        let size = 7 * pf;
        ctx.shadowColor = "#ff4444";
        ctx.shadowBlur = 10;
        ctx.fillStyle = "#ff6666";
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(2, size), 0, Math.PI * 2);
        ctx.fill();
    });

    // Player missiles with trail
    playerMissiles.forEach(m => {
        if (m.z <= 30) return;
        let pf = 500 / m.z;
        let sx = (canvas.width / 2) + ((m.x - player.x) * pf);
        let sy = visualHorizonY - (player.y * 0.08) * pf;
        let size = 6 * pf;
        ctx.shadowColor = "#ffff00";
        ctx.shadowBlur = 8;
        ctx.fillStyle = "#ffff99";
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(1.5, size), 0, Math.PI * 2);
        ctx.fill();
    });

    // Particles with glow
    dynamicParticles.forEach(p => {
        if (p.z <= 30) return;
        let pf = 500 / p.z;
        let sx = (canvas.width / 2) + ((p.x - player.x) * pf);
        let sy = visualHorizonY - (p.y * 0.08) * pf;
        let size = p.size * pf;
        ctx.globalAlpha = p.life;
        ctx.shadowColor = p.color.replace("rgba(", "rgb(").replace(", " + p.life + ")", "");
        ctx.shadowBlur = size * 1.5;
        ctx.fillStyle = p.color + p.life + ")";
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(1, size), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    });

    ctx.shadowBlur = 0;

    // Advanced jet silhouette
    renderJetSilhouette();

    // HUD + radar + game over
    renderHUD(visualHorizonY);
    renderRadar();
    if (isGameOver) renderGameOver();
}

function renderClouds(horizonY) {
    ctx.globalAlpha = 0.6;
    clouds.forEach(cloud => {
        if (cloud.z <= 30) return;
        let pf = 450 / cloud.z;
        let sx = (canvas.width / 2) + ((cloud.x - player.x) * pf);
        let sy = horizonY + (cloud.y * 0.08 * pf);
        let w = cloud.width * pf;

        // Cloud shape
        ctx.fillStyle = `rgba(220, 230, 240, ${cloud.opacity})`;
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.arc(sx - w/3 + i * w/2, sy, w/4, 0, Math.PI * 2);
            ctx.fill();
        }
    });
    ctx.globalAlpha = 1;
}

function renderMountains(horizonY) {
    ctx.save();
    mountainPeaks.sort((a, b) => b.z - a.z);
    
    mountainPeaks.forEach(peak => {
        if (peak.z <= 30 || peak.z > 2500) return;
        
        let pf = 450 / peak.z;
        let sx = (canvas.width / 2) + ((peak.x - player.x) * pf);
        let sy = horizonY;
        let w = peak.width * pf;
        let h = peak.height * pf;

        ctx.fillStyle = `hsl(${peak.color}, 35%, 25%)`;
        ctx.strokeStyle = `hsl(${peak.color}, 40%, 35%)`;
        ctx.lineWidth = Math.max(0.5, pf * 0.6);

        // Mountain triangle
        ctx.beginPath();
        ctx.moveTo(sx, sy - h);
        ctx.lineTo(sx - w/2, sy);
        ctx.lineTo(sx + w/2, sy);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Snow cap
        ctx.fillStyle = "rgba(240, 245, 250, 0.8)";
        ctx.beginPath();
        ctx.moveTo(sx, sy - h);
        ctx.lineTo(sx - w/6, sy - h * 0.4);
        ctx.lineTo(sx + w/6, sy - h * 0.4);
        ctx.closePath();
        ctx.fill();

        // Mountain shadow for depth
        ctx.fillStyle = `hsl(${peak.color}, 20%, 15%)`;
        ctx.beginPath();
        ctx.moveTo(sx + w/2, sy);
        ctx.lineTo(sx, sy - h);
        ctx.lineTo(sx + w/4, sy);
        ctx.closePath();
        ctx.fill();
    });
    ctx.restore();
}

function renderTerrain(horizonY) {
    ctx.fillStyle = "#1a2f2a";
    ctx.strokeStyle = "#2d4a42";
    ctx.lineWidth = 1.2;
    
    terrainNodes.sort((a, b) => b.z - a.z);
    terrainNodes.forEach(m => {
        if (m.z > 1500) return;
        
        let dynamicParallaxX = (canvas.width / 2) + (m.x - (player.x * 0.35));
        let dynamicParallaxY = horizonY + (m.baseY * 0.1);
        
        ctx.beginPath();
        ctx.moveTo(dynamicParallaxX, dynamicParallaxY);
        
        // Add complexity to terrain
        for (let i = 0; i < 5; i++) {
            const segX = dynamicParallaxX - m.width/2 + (i * m.width/4);
            const segY = dynamicParallaxY - (m.height * Math.sin(i/5 * Math.PI) * 0.8);
            if (i === 0) ctx.moveTo(segX, segY);
            else ctx.lineTo(segX, segY);
        }
        
        ctx.lineTo(dynamicParallaxX + m.width / 2, dynamicParallaxY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    });
}

function renderJetSilhouette() {
    const centerX = canvas.width / 2;
    const centerY = canvas.height * 0.72;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(player.roll);

    // Fuselage
    ctx.fillStyle = "#2a3f3a";
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(-8, 8);
    ctx.lineTo(-6, 20);
    ctx.lineTo(6, 20);
    ctx.lineTo(8, 8);
    ctx.closePath();
    ctx.fill();

    // Wings
    ctx.fillStyle = "#1f2a28";
    ctx.beginPath();
    ctx.moveTo(-30, 0);
    ctx.lineTo(-8, 4);
    ctx.lineTo(-8, -4);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(30, 0);
    ctx.lineTo(8, 4);
    ctx.lineTo(8, -4);
    ctx.closePath();
    ctx.fill();

    // Afterburners
    ctx.fillStyle = "rgba(255,140,20,0.7)";
    ctx.shadowColor = "#ff8c14";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(0, 22, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.restore();
}

function renderHUD(visualHorizonY) {
    ctx.save();
    ctx.fillStyle = "#00ff88";
    ctx.font = "bold 13px Consolas";
    ctx.shadowColor = "rgba(0,255,136,0.5)";
    ctx.shadowBlur = 6;

    // Left side HUD
    ctx.fillText(`ALT: ${Math.max(0, Math.round(-player.y))}M`, 15, 25);
    ctx.fillText(`SPD: ${Math.round(player.speed * 1.85)}KT`, 15, 45);
    ctx.fillText(`HEALTH: ${Math.max(0, player.health)}%`, 15, 65);
    ctx.fillText(`AMMO: ${player.ammo}`, 15, 85);
    ctx.fillText(`MISSILES: ${player.missiles}`, 15, 105);
    ctx.fillText(`FLARES: ${player.flares}`, 15, 125);
    ctx.fillText(`SCORE: ${player.score}`, 15, 145);

    // Center HUD
    if (currentLockTarget) {
        ctx.fillStyle = "#ffcc33";
        ctx.font = "bold 14px Consolas";
        ctx.fillText("◆ TARGET LOCKED ◆", canvas.width / 2 - 80, visualHorizonY + 35);
    }

    // Warning
    if (player.health < 40 && !isGameOver) {
        ctx.fillStyle = "#ff3333";
        ctx.font = "bold 14px Consolas";
        ctx.shadowColor = "rgba(255,51,51,0.8)";
        ctx.shadowBlur = 8;
        ctx.fillText("⚠ STRUCTURAL DAMAGE ⚠", canvas.width / 2 - 110, 40);
    }

    if (player.ammo < 100) {
        ctx.fillStyle = "#ffaa33";
        ctx.font = "bold 12px Consolas";
        ctx.fillText("⚠ LOW AMMO", canvas.width - 140, 30);
    }

    ctx.shadowBlur = 0;
    ctx.restore();
}

function renderRadar() {
    const radarRadius = 80;
    const cx = canvas.width - radarRadius - 25;
    const cy = canvas.height - radarRadius - 25;

    ctx.save();
    ctx.strokeStyle = "#00aa44";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radarRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Rings
    ctx.strokeStyle = "rgba(0,255,136,0.15)";
    ctx.lineWidth = 1;
    for (let r = 0.3; r < 1; r += 0.3) {
        ctx.beginPath();
        ctx.arc(cx, cy, radarRadius * r, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Crosshair
    ctx.strokeStyle = "#00ff88";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy);
    ctx.lineTo(cx + 8, cy);
    ctx.moveTo(cx, cy - 8);
    ctx.lineTo(cx, cy + 8);
    ctx.stroke();

    // Player center glow
    ctx.fillStyle = "#00ff88";
    ctx.shadowColor = "#00ff88";
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();

    const radarRange = 2500;

    // Outposts
    militaryOutposts.forEach(o => {
        const dz = o.z;
        if (dz < 0 || dz > radarRange) return;
        const dx = o.x - player.x;
        const rx = (dx / radarRange) * radarRadius;
        const ry = (dz / radarRange) * radarRadius;
        ctx.fillStyle = o.isDestroyed ? "#666666" : "#00dd77";
        ctx.fillRect(cx + rx - 2.5, cy - ry - 2.5, 5, 5);
    });

    // SAMs
    surfaceToAirMissiles.forEach(sam => {
        const dz = sam.z;
        if (dz < 0 || dz > radarRange) return;
        const dx = sam.x - player.x;
        const rx = (dx / radarRange) * radarRadius;
        const ry = (dz / radarRange) * radarRadius;
        ctx.fillStyle = "#ff5555";
        ctx.shadowColor = "#ff5555";
        ctx.shadowBlur = 4;
        ctx.fillRect(cx + rx - 2.5, cy - ry - 2.5, 5, 5);
    });

    ctx.shadowBlur = 0;
    ctx.restore();
}

function renderGameOver() {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#ff4444";
    ctx.font = "bold 32px Consolas";
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(255,68,68,0.8)";
    ctx.shadowBlur = 10;
    ctx.fillText("MISSION FAILED", canvas.width / 2, canvas.height / 2 - 30);

    ctx.fillStyle = "#ffff88";
    ctx.font = "16px Consolas";
    ctx.shadowBlur = 0;
    ctx.fillText(gameOverReason, canvas.width / 2, canvas.height / 2 + 15);
    ctx.fillText(`Final Score: ${player.score}`, canvas.width / 2, canvas.height / 2 + 40);
    
    ctx.fillStyle = "#88ff88";
    ctx.font = "14px Consolas";
    ctx.fillText("Press ENTER to reinitiate mission", canvas.width / 2, canvas.height / 2 + 70);

    ctx.restore();
}

function interpolateColor(color1, color2, factor) {
    const c1 = parseInt(color1.slice(1), 16);
    const c2 = parseInt(color2.slice(1), 16);
    
    const r1 = (c1 >> 16) & 255;
    const g1 = (c1 >> 8) & 255;
    const b1 = c1 & 255;
    
    const r2 = (c2 >> 16) & 255;
    const g2 = (c2 >> 8) & 255;
    const b2 = c2 & 255;
    
    const r = Math.round(r1 + (r2 - r1) * factor);
    const g = Math.round(g1 + (g2 - g1) * factor);
    const b = Math.round(b1 + (b2 - b1) * factor);
    
    return `rgb(${r}, ${g}, ${b})`;
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
