import * as THREE from 'three';
import { World } from './world.js';
import { Player } from './player.js';
import { InputHandler } from './input.js';
import { createBlockTextures, createBlockMaterials, BlockType, BLOCK_NAMES, PLACEABLE_BLOCKS } from './blocks.js';

// ---- 설정 ----
const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = false;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 300);

// ---- 하늘 (항상 낮) ----
const skyColor = new THREE.Color(0.53, 0.81, 0.92);
scene.background = skyColor;
scene.fog = new THREE.Fog(skyColor, 50, 200);

// ---- 조명 (항상 밝게) ----
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);
const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
sunLight.position.set(100, 200, 100);
scene.add(sunLight);

// ---- 블록 하이라이트 ----
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

// ---- 월드 & 텍스처 ----
const textures = createBlockTextures();
const materials = createBlockMaterials(textures);
const world = new World(scene, materials, 42);

world.update(0, 0);

// ---- 플레이어 ----
const player = new Player(camera, world);
const input = new InputHandler(canvas);

// ---- 한글 블록 이름 ----
const BLOCK_NAMES_KO = {
    [BlockType.GRASS]: '잔디',
    [BlockType.DIRT]: '흙',
    [BlockType.STONE]: '돌',
    [BlockType.WOOD]: '나무',
    [BlockType.LEAVES]: '나뭇잎',
    [BlockType.SAND]: '모래',
    [BlockType.WATER]: '물',
};

// ---- 핫바 UI ----
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
    selectedBlockEl.textContent = BLOCK_NAMES_KO[PLACEABLE_BLOCKS[selectedSlot]];
}

function selectSlot(idx) {
    selectedSlot = idx;
    buildHotbar();
}

document.addEventListener('keydown', (e) => {
    const num = parseInt(e.key);
    if (num >= 1 && num <= 7) selectSlot(num - 1);
});

buildHotbar();

// ---- 비행 상태 표시 ----
const flyStatusEl = document.getElementById('fly-status');

// ---- FPS ----
const fpsEl = document.getElementById('fps');
const coordsEl = document.getElementById('coords');
let frameCount = 0, lastFpsTime = 0;

// ---- 블록 상호작용 쿨다운 ----
let interactCooldown = 0;

// ---- 게임 루프 ----
let lastTime = 0;
let started = false;

function gameLoop(time) {
    requestAnimationFrame(gameLoop);
    const dt = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;

    if (!started) return;

    const mouse = input.consumeMouse();
    const clicks = input.consumeClicks();

    const inputState = {
        ...input.state,
        mouseDX: mouse.dx,
        mouseDY: mouse.dy,
    };

    player.update(dt, inputState);

    world.update(player.position.x, player.position.z);

    // 블록 상호작용
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

    // FPS & 좌표
    frameCount++;
    if (time - lastFpsTime > 1000) {
        fpsEl.textContent = `FPS: ${frameCount}`;
        lastFpsTime = time;
        frameCount = 0;
    }
    const p = player.position;
    coordsEl.textContent = `X: ${p.x.toFixed(1)} Y: ${p.y.toFixed(1)} Z: ${p.z.toFixed(1)}`;

    // 비행 상태
    flyStatusEl.textContent = player.flying ? '비행 중' : '걷기';

    renderer.render(scene, camera);
}

// ---- 시작 버튼 ----
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

// ---- 리사이즈 ----
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

requestAnimationFrame(gameLoop);
