import * as THREE from 'three';
import { World } from './world.js';
import { Player } from './player.js';
import { InputHandler } from './input.js';
import { createBlockTextures, createBlockMaterials, BlockType, BLOCK_NAMES, PLACEABLE_BLOCKS } from './blocks.js';
import { EntityManager } from './entities.js';

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

// ---- 엔티티 매니저 ----
const entityManager = new EntityManager(scene, world);

// ---- 플레이어 ----
const player = new Player(camera, world);
const input = new InputHandler(canvas);

// ---- 핫바 아이템 정의 (블록 + 생성알) ----
const SPAWN_EGG_CLIONE = 'spawn_clione';
const SPAWN_EGG_MAJA = 'spawn_maja';

const HOTBAR_ITEMS = [
    ...PLACEABLE_BLOCKS,
    SPAWN_EGG_CLIONE,
    SPAWN_EGG_MAJA,
];

const ITEM_NAMES_KO = {
    [BlockType.GRASS]: '잔디',
    [BlockType.DIRT]: '흙',
    [BlockType.STONE]: '돌',
    [BlockType.WOOD]: '나무',
    [BlockType.LEAVES]: '나뭇잎',
    [BlockType.SAND]: '모래',
    [BlockType.WATER]: '물',
    [SPAWN_EGG_CLIONE]: '클리오네 생성알',
    [SPAWN_EGG_MAJA]: '엘 그란 마하 생성알',
};

const ITEM_COLORS = {
    [BlockType.GRASS]: '#4c9900',
    [BlockType.DIRT]: '#8b5a2b',
    [BlockType.STONE]: '#808080',
    [BlockType.WOOD]: '#654321',
    [BlockType.LEAVES]: '#228b22',
    [BlockType.SAND]: '#d2b48c',
    [BlockType.WATER]: '#1e90ff',
    [SPAWN_EGG_CLIONE]: null,
    [SPAWN_EGG_MAJA]: null,
};

// ---- 핫바 UI ----
let selectedSlot = 0;
const hudEl = document.getElementById('hud');
const selectedBlockEl = document.getElementById('selected-block');

function buildHotbar() {
    hudEl.innerHTML = '';
    HOTBAR_ITEMS.forEach((item, i) => {
        const slot = document.createElement('div');
        slot.className = 'hotbar-slot' + (i === selectedSlot ? ' selected' : '');
        const num = document.createElement('span');
        num.className = 'slot-num';
        num.textContent = i + 1;
        const preview = document.createElement('div');
        preview.className = 'block-preview';

        if (item === SPAWN_EGG_CLIONE) {
            preview.style.background = 'radial-gradient(ellipse at 40% 40%, #f0e0d8 0%, #e8c8b8 40%, #ff7040 100%)';
            preview.style.borderRadius = '40% 40% 50% 50%';
        } else if (item === SPAWN_EGG_MAJA) {
            preview.style.background = 'radial-gradient(ellipse at 40% 40%, #2a2a60 0%, #1a1a40 50%, #40ffcc 100%)';
            preview.style.borderRadius = '40% 40% 50% 50%';
        } else {
            preview.style.background = ITEM_COLORS[item] || '#888';
        }

        slot.appendChild(num);
        slot.appendChild(preview);
        slot.addEventListener('click', () => selectSlot(i));
        slot.addEventListener('touchstart', (e) => { e.preventDefault(); selectSlot(i); }, { passive: false });
        hudEl.appendChild(slot);
    });
    selectedBlockEl.textContent = ITEM_NAMES_KO[HOTBAR_ITEMS[selectedSlot]] || '';
}

function selectSlot(idx) {
    selectedSlot = idx;
    buildHotbar();
}

document.addEventListener('keydown', (e) => {
    const num = parseInt(e.key);
    if (num >= 1 && num <= HOTBAR_ITEMS.length) selectSlot(num - 1);
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

// ---- 물블록 위협 시스템 ----
let threatTimer = 0;
let threatTarget = null;
const THREAT_RANGE = 9;
const THREAT_TIME = 2;

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

    // 엔티티 업데이트 (자연 스폰 + 길들이기 포함)
    entityManager.update(dt, player.position.x, player.position.y, player.position.z);

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
        const currentItem = HOTBAR_ITEMS[selectedSlot];

        if (clicks.leftClick) {
            // 먼저 몹 타겟팅 확인 (시선 방향의 몹을 터치하면 길들여진 몹이 공격)
            let targetEntity = null;
            for (let d = 1; d <= 12; d += 1.5) {
                const checkPos = player.camera.position.clone().add(dir.clone().multiplyScalar(d));
                targetEntity = entityManager.findEntityAt(checkPos, 2.5);
                if (targetEntity) break;
            }
            if (targetEntity && !targetEntity.tamed && targetEntity.alive) {
                entityManager.commandAttack(targetEntity);
                interactCooldown = 0.5;
            } else if (hit) {
                world.setBlock(hit.x, hit.y, hit.z, BlockType.AIR);
                interactCooldown = 0.25;
            }
        }
        if (clicks.rightClick && hit && hit.placeX !== undefined) {
            if (currentItem === SPAWN_EGG_CLIONE) {
                entityManager.spawnClione(hit.placeX, hit.placeY, hit.placeZ);
                interactCooldown = 0.25;
            } else if (currentItem === SPAWN_EGG_MAJA) {
                entityManager.spawnMaja(hit.placeX, hit.placeY, hit.placeZ);
                interactCooldown = 0.25;
            } else {
                world.setBlock(hit.placeX, hit.placeY, hit.placeZ, currentItem);
                interactCooldown = 0.25;
            }
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

    // ---- 물블록 위협 시스템: 물블록 들고 있으면 근처 야생 몹에 빨간 바 ----
    const currentHeld = HOTBAR_ITEMS[selectedSlot];
    const holdingWater = currentHeld === BlockType.WATER;
    const threatBar = document.getElementById('threat-bar');
    const threatBarFill = document.getElementById('threat-bar-fill');

    if (holdingWater) {
        // 가장 가까운 길들이지 않은 몹 찾기
        let nearestWild = null;
        let nearestDist = THREAT_RANGE;
        for (const e of entityManager.entities) {
            if (e.tamed || !e.alive) continue;
            const dx = e.mesh.position.x - player.position.x;
            const dy = e.mesh.position.y - player.position.y;
            const dz = e.mesh.position.z - player.position.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestWild = e;
            }
        }

        if (nearestWild) {
            if (threatTarget !== nearestWild) {
                threatTarget = nearestWild;
                threatTimer = 0;
            }
            threatTimer += dt;
            threatBar.style.display = 'block';
            const pct = Math.min(100, (threatTimer / THREAT_TIME) * 100);
            threatBarFill.style.width = pct + '%';

            if (threatTimer >= THREAT_TIME) {
                // 길들인 몹들이 공격
                entityManager.commandAttack(threatTarget);
                threatTimer = 0;
                threatTarget = null;
            }
        } else {
            threatTimer = 0;
            threatTarget = null;
            threatBar.style.display = 'none';
        }
    } else {
        threatTimer = 0;
        threatTarget = null;
        threatBar.style.display = 'none';
    }

    // 길들이기 진행률 표시
    const tameBar = document.getElementById('tame-bar');
    const tameBarFill = document.getElementById('tame-bar-fill');
    let tamingEntity = null;
    for (const e of entityManager.entities) {
        if (!e.tamed && e.alive && e.nearPlayerTime > 0) {
            tamingEntity = e;
            break;
        }
    }
    if (tamingEntity) {
        tameBar.style.display = 'block';
        const pct = Math.min(100, (tamingEntity.nearPlayerTime / 3) * 100);
        tameBarFill.style.width = pct + '%';
    } else {
        tameBar.style.display = 'none';
    }

    // 길들여진 몹 수
    const tamedCount = entityManager.entities.filter(e => e.tamed && e.alive).length;
    document.getElementById('tame-count').textContent = tamedCount > 0 ? `길들인 몹: ${tamedCount}마리` : '';

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
