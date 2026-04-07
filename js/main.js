import * as THREE from 'three';
import { World } from './world.js';
import { Player } from './player.js';
import { InputHandler } from './input.js';
import { createBlockTextures, createBlockMaterials, BlockType, BLOCK_NAMES, PLACEABLE_BLOCKS } from './blocks.js';

// ---- Setup ----
const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = false;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 300);

// ---- Sky ----
const skyColor = new THREE.Color(0.53, 0.81, 0.92);
scene.background = skyColor;
scene.fog = new THREE.Fog(skyColor, 50, 200);

// ---- Lighting ----
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
sunLight.position.set(100, 200, 100);
scene.add(sunLight);

// ---- Block highlight wireframe ----
const highlightGeo = new THREE.BoxGeometry(1.01, 1.01, 1.01);
const highlightMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    wireframe: true,
    transparent: true,
    opacity: 0.5,
});
const highlightMesh = new THREE.Mesh(highlightGeo, highlightMat);
highlightMesh.visible = false;
scene.add(highlightMesh);

// ---- World & textures ----
const textures = createBlockTextures();
const materials = createBlockMaterials(textures);
const world = new World(scene, materials, 42);

// Generate initial chunks
world.update(0, 0);

// ---- Player ----
const player = new Player(camera, world);
const input = new InputHandler(canvas);

// ---- Hotbar UI ----
let selectedSlot = 0;
const hudEl = document.getElementById('hud');
const selectedBlockEl = document.getElementById('selected-block');

function buildHotbar() {
    hudEl.innerHTML = '';
    const blockColors = {
        [BlockType.GRASS]: '#4c9900',
        [BlockType.DIRT]: '#8b5a2b',
        [BlockType.STONE]: '#808080',
        [BlockType.WOOD]: '#654321',
        [BlockType.LEAVES]: '#228b22',
        [BlockType.SAND]: '#d2b48c',
        [BlockType.WATER]: '#1e90ff',
    };
    PLACEABLE_BLOCKS.forEach((bt, i) => {
        const slot = document.createElement('div');
        slot.className = 'hotbar-slot' + (i === selectedSlot ? ' selected' : '');
        const num = document.createElement('span');
        num.className = 'slot-num';
        num.textContent = i + 1;
        const preview = document.createElement('div');
        preview.className = 'block-preview';
        preview.style.background = blockColors[bt] || '#888';
        slot.appendChild(num);
        slot.appendChild(preview);
        slot.addEventListener('click', () => selectSlot(i));
        slot.addEventListener('touchstart', (e) => { e.preventDefault(); selectSlot(i); }, { passive: false });
        hudEl.appendChild(slot);
    });
    selectedBlockEl.textContent = BLOCK_NAMES[PLACEABLE_BLOCKS[selectedSlot]];
}

function selectSlot(idx) {
    selectedSlot = idx;
    buildHotbar();
}

// Keyboard block selection (1-7)
document.addEventListener('keydown', (e) => {
    const num = parseInt(e.key);
    if (num >= 1 && num <= 7) selectSlot(num - 1);
});

buildHotbar();

// ---- Day/Night cycle ----
let dayTime = 0;
function updateDayCycle(dt) {
    dayTime += dt * 0.02; // Full cycle ~5 minutes
    const t = (Math.sin(dayTime) + 1) / 2; // 0 = night, 1 = day
    const dayColor = new THREE.Color(0.53, 0.81, 0.92);
    const nightColor = new THREE.Color(0.05, 0.05, 0.15);
    const sunsetColor = new THREE.Color(0.9, 0.5, 0.3);

    let skyC;
    if (t > 0.6) {
        skyC = dayColor;
    } else if (t > 0.4) {
        skyC = dayColor.clone().lerp(sunsetColor, (0.6 - t) / 0.2);
    } else if (t > 0.2) {
        skyC = sunsetColor.clone().lerp(nightColor, (0.4 - t) / 0.2);
    } else {
        skyC = nightColor;
    }

    scene.background = skyC;
    scene.fog.color = skyC;
    ambientLight.intensity = 0.2 + t * 0.6;
    sunLight.intensity = t * 0.8;
    sunLight.position.set(
        Math.cos(dayTime) * 200,
        Math.sin(dayTime) * 200 + 50,
        100
    );
}

// ---- FPS counter ----
const fpsEl = document.getElementById('fps');
const coordsEl = document.getElementById('coords');
let frameCount = 0, lastFpsTime = 0;

// ---- Block interaction cooldown ----
let interactCooldown = 0;

// ---- Game loop ----
let lastTime = 0;
let started = false;

function gameLoop(time) {
    requestAnimationFrame(gameLoop);
    const dt = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;

    if (!started) return;

    // Consume mouse
    const mouse = input.consumeMouse();
    const clicks = input.consumeClicks();

    const inputState = {
        ...input.state,
        mouseDX: mouse.dx,
        mouseDY: mouse.dy,
    };

    // Update player
    player.update(dt, inputState);

    // Update chunks around player
    world.update(player.position.x, player.position.z);

    // Day/night
    updateDayCycle(dt);

    // Block interaction
    interactCooldown -= dt;
    const dir = player.getDirection();
    const hit = world.raycast(player.camera.position, dir);

    if (hit) {
        highlightMesh.position.set(hit.x, hit.y, hit.z);
        highlightMesh.visible = true;
    } else {
        highlightMesh.visible = false;
    }

    if (interactCooldown <= 0) {
        if (clicks.leftClick && hit) {
            world.setBlock(hit.x, hit.y, hit.z, BlockType.AIR);
            interactCooldown = 0.25;
        }
        if (clicks.rightClick && hit && hit.placeX !== undefined) {
            const bt = PLACEABLE_BLOCKS[selectedSlot];
            world.setBlock(hit.placeX, hit.placeY, hit.placeZ, bt);
            interactCooldown = 0.25;
        }
    }

    // FPS
    frameCount++;
    if (time - lastFpsTime > 1000) {
        fpsEl.textContent = `FPS: ${frameCount}`;
        lastFpsTime = time;
        frameCount = 0;
    }
    const p = player.position;
    coordsEl.textContent = `X: ${p.x.toFixed(1)} Y: ${p.y.toFixed(1)} Z: ${p.z.toFixed(1)}`;

    renderer.render(scene, camera);
}

// ---- Start button ----
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('start-btn').addEventListener('touchend', (e) => {
    e.preventDefault();
    startGame();
});

function startGame() {
    started = true;
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('info').style.display = 'block';
    document.getElementById('selected-block').style.display = 'block';
    hudEl.style.display = 'flex';
    if (!input.isMobile) {
        canvas.requestPointerLock();
    }
}

// ---- Resize ----
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start loop
requestAnimationFrame(gameLoop);
