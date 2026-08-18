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
const ITEM_BLACK_SKULL = 'black_skull';

const HOTBAR_ITEMS = [
    ...PLACEABLE_BLOCKS,
    SPAWN_EGG_CLIONE,
    SPAWN_EGG_MAJA,
    ITEM_BLACK_SKULL,
];

const ITEM_NAMES_KO = {
    [BlockType.GRASS]: '잔디',
    [BlockType.DIRT]: '흙',
    [BlockType.STONE]: '돌',
    [BlockType.WOOD]: '나무',
    [BlockType.LEAVES]: '나뭇잎',
    [BlockType.SAND]: '모래',
    [BlockType.WATER]: '물',
    [BlockType.SOUL_DIRT]: '영혼의 흙',
    [SPAWN_EGG_CLIONE]: '클리오네 생성알',
    [SPAWN_EGG_MAJA]: '엘 그란 마하 생성알',
    [ITEM_BLACK_SKULL]: '검은 해골',
};

const ITEM_COLORS = {
    [BlockType.GRASS]: '#4c9900',
    [BlockType.DIRT]: '#8b5a2b',
    [BlockType.STONE]: '#808080',
    [BlockType.WOOD]: '#654321',
    [BlockType.LEAVES]: '#228b22',
    [BlockType.SAND]: '#d2b48c',
    [BlockType.WATER]: '#1e90ff',
    [BlockType.SOUL_DIRT]: '#3c2820',
    [SPAWN_EGG_CLIONE]: null,
    [SPAWN_EGG_MAJA]: null,
    [ITEM_BLACK_SKULL]: null,
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
        } else if (item === ITEM_BLACK_SKULL) {
            preview.style.background = 'radial-gradient(circle at 50% 40%, #333 0%, #111 60%, #000 100%)';
            preview.style.borderRadius = '30% 30% 40% 40%';
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

// ---- 영혼의 흙 연결 계산 (BFS) ----
function countConnectedSoulDirt(sx, sy, sz) {
    const visited = new Set();
    const queue = [[sx, sy, sz]];
    let count = 0;
    while (queue.length > 0) {
        const [x, y, z] = queue.shift();
        const key = `${x},${y},${z}`;
        if (visited.has(key)) continue;
        if (world.getBlock(x, y, z) !== BlockType.SOUL_DIRT) continue;
        visited.add(key);
        count++;
        if (count > 20) break;
        queue.push([x+1,y,z],[x-1,y,z],[x,y+1,z],[x,y-1,z],[x,y,z+1],[x,y,z-1]);
    }
    return count;
}

function removeConnectedSoulDirt(sx, sy, sz) {
    const visited = new Set();
    const queue = [[sx, sy, sz]];
    while (queue.length > 0) {
        const [x, y, z] = queue.shift();
        const key = `${x},${y},${z}`;
        if (visited.has(key)) continue;
        if (world.getBlock(x, y, z) !== BlockType.SOUL_DIRT) continue;
        visited.add(key);
        world.setBlock(x, y, z, BlockType.AIR);
        queue.push([x+1,y,z],[x-1,y,z],[x,y+1,z],[x,y-1,z],[x,y,z+1],[x,y,z-1]);
    }
}

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

    // 엔티티 업데이트
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

        if (clicks.leftClick && hit) {
            world.setBlock(hit.x, hit.y, hit.z, BlockType.AIR);
            interactCooldown = 0.25;
        }
        if (clicks.rightClick) {
            // 생성알로 위더 길들이기: 시선 방향의 위더를 찾아서 길들임
            if (currentItem === SPAWN_EGG_CLIONE || currentItem === SPAWN_EGG_MAJA) {
                let tamedWither = false;
                for (let d = 1; d <= 10; d += 1) {
                    const checkPos = player.camera.position.clone().add(dir.clone().multiplyScalar(d));
                    for (const e of entityManager.entities) {
                        if (e.type !== 'wither' || !e.alive || e.tamed) continue;
                        const dx = e.mesh.position.x - checkPos.x;
                        const dy = e.mesh.position.y - checkPos.y;
                        const dz = e.mesh.position.z - checkPos.z;
                        if (dx*dx + dy*dy + dz*dz < 4) {
                            e.tamed = true;
                            // 초록 표시 추가
                            const indicator = new THREE.Mesh(
                                new THREE.BoxGeometry(0.2 * e.scale, 0.2 * e.scale, 0.2 * e.scale),
                                new THREE.MeshBasicMaterial({ color: 0x00ff44 })
                            );
                            indicator.position.set(0, 0.9 * e.scale, 0);
                            indicator.rotation.set(Math.PI/4, Math.PI/4, 0);
                            e.mesh.add(indicator);
                            tamedWither = true;
                            interactCooldown = 0.5;
                            break;
                        }
                    }
                    if (tamedWither) break;
                }
                // 위더를 못 찾으면 일반 스폰
                if (!tamedWither && hit && hit.placeX !== undefined) {
                    if (currentItem === SPAWN_EGG_CLIONE) {
                        entityManager.spawnClione(hit.placeX, hit.placeY, hit.placeZ);
                    } else {
                        entityManager.spawnMaja(hit.placeX, hit.placeY, hit.placeZ);
                    }
                    interactCooldown = 0.25;
                }
            } else if (hit && hit.placeX !== undefined && currentItem === ITEM_BLACK_SKULL) {
                // 검은 해골을 영혼의 흙 위에 놓으면 위더 소환
                if (hit.block === BlockType.SOUL_DIRT) {
                    const count = countConnectedSoulDirt(hit.x, hit.y, hit.z);
                    const scale = 0.8 + count * 0.3;
                    // 연결된 영혼의 흙 제거
                    removeConnectedSoulDirt(hit.x, hit.y, hit.z);
                    entityManager.spawnWither(hit.x, hit.y + 1, hit.z, scale);
                    interactCooldown = 0.5;
                }
            } else if (hit && hit.placeX !== undefined) {
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
