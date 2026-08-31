import * as THREE from 'three';
import { World } from './world.js';
import { Player } from './player.js';
import { InputHandler } from './input.js';
import { createBlockTextures, createBlockMaterials, BlockType, BLOCK_NAMES, PLACEABLE_BLOCKS } from './blocks.js';
import { EntityManager } from './entities.js';
import { Multiplayer } from './multiplayer.js';
import { AIPlayer } from './aiplayer.js';

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
const ITEM_FIRE = 'fire';
const ITEM_LEVIATHAN_EGG = 'leviathan_egg';

const HOTBAR_ITEMS = [
    ...PLACEABLE_BLOCKS,
    ITEM_FIRE,
    SPAWN_EGG_CLIONE,
    SPAWN_EGG_MAJA,
    ITEM_BLACK_SKULL,
    ITEM_LEVIATHAN_EGG,
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
    [BlockType.OBSIDIAN]: '흑요석',
    [ITEM_FIRE]: '불',
    [SPAWN_EGG_CLIONE]: '클리오네 생성알',
    [SPAWN_EGG_MAJA]: '엘 그란 마하 생성알',
    [ITEM_BLACK_SKULL]: '검은 해골',
    [ITEM_LEVIATHAN_EGG]: '래비아탄 알',
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
    [BlockType.OBSIDIAN]: '#150a20',
    [ITEM_FIRE]: null,
    [SPAWN_EGG_CLIONE]: null,
    [SPAWN_EGG_MAJA]: null,
    [ITEM_BLACK_SKULL]: null,
    [ITEM_LEVIATHAN_EGG]: null,
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
        } else if (item === ITEM_FIRE) {
            preview.style.background = 'radial-gradient(ellipse at 50% 70%, #ff4400 0%, #ff8800 40%, #ffcc00 80%, #fff 100%)';
            preview.style.borderRadius = '30% 30% 50% 50%';
        } else if (item === ITEM_BLACK_SKULL) {
            preview.style.background = 'radial-gradient(circle at 50% 40%, #333 0%, #111 60%, #000 100%)';
            preview.style.borderRadius = '30% 30% 40% 40%';
        } else if (item === ITEM_LEVIATHAN_EGG) {
            preview.style.background = 'radial-gradient(ellipse at 40% 40%, #254555 0%, #1a3a4a 50%, #33ddcc 100%)';
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

// ---- 네더포탈 생성: 흑요석 프레임 안쪽을 포탈 블록으로 채움 ----
function tryCreateNetherPortal(ox, oy, oz) {
    // X-axis portal (흑요석 프레임이 X 방향으로 서있는 경우)
    if (tryFillPortal(ox, oy, oz, 'x')) return;
    // Z-axis portal
    if (tryFillPortal(ox, oy, oz, 'z')) return;
}

function tryFillPortal(ox, oy, oz, axis) {
    // 흑요석 블록에서 안쪽 빈 공간을 찾아서 포탈로 채움
    // 인접한 공기 블록을 찾아 프레임 검증
    const dirs = axis === 'x'
        ? [[0,1,0],[0,-1,0],[1,0,0],[-1,0,0]]
        : [[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];

    for (const [dx, dy, dz] of dirs) {
        const ax = ox + dx, ay = oy + dy, az = oz + dz;
        if (world.getBlock(ax, ay, az) !== BlockType.AIR) continue;

        // 이 빈 공간에서 flood fill로 프레임 안쪽인지 확인
        const filled = [];
        const visited = new Set();
        const queue = [[ax, ay, az]];
        let valid = true;

        while (queue.length > 0 && valid) {
            const [x, y, z] = queue.shift();
            const key = `${x},${y},${z}`;
            if (visited.has(key)) continue;
            visited.add(key);

            const block = world.getBlock(x, y, z);
            if (block === BlockType.OBSIDIAN) continue;
            if (block !== BlockType.AIR && block !== BlockType.NETHER_PORTAL) { valid = false; break; }

            filled.push([x, y, z]);
            if (filled.length > 40) { valid = false; break; }

            // 프레임 방향에 따라 2D로만 확장
            if (axis === 'x') {
                queue.push([x+1,y,z],[x-1,y,z],[x,y+1,z],[x,y-1,z]);
            } else {
                queue.push([x,y,z+1],[x,y,z-1],[x,y+1,z],[x,y-1,z]);
            }
        }

        if (valid && filled.length >= 2 && filled.length <= 40) {
            for (const [fx, fy, fz] of filled) {
                world.setBlock(fx, fy, fz, BlockType.NETHER_PORTAL);
            }
            return true;
        }
    }
    return false;
}

// ---- 비행 상태 표시 ----
const flyStatusEl = document.getElementById('fly-status');

// ---- FPS ----
const fpsEl = document.getElementById('fps');
const coordsEl = document.getElementById('coords');
let frameCount = 0, lastFpsTime = 0;

// ---- 블록 상호작용 쿨다운 ----
let interactCooldown = 0;
let ridingGhast = null;
let ridingDragon = null;

// ---- 포탈 / 차원 전환 ----
let portalCooldown = 0;
const netherSky = new THREE.Color(0.2, 0.05, 0.05);
const overworldSky = new THREE.Color(0.53, 0.81, 0.92);
const enderSky = new THREE.Color(0.02, 0.0, 0.08);

function switchDimension(target) {
    let newDim;
    if (target) {
        newDim = target;
    } else {
        newDim = world.dimension === 'overworld' ? 'nether' : 'overworld';
    }
    if (newDim === world.dimension) return;
    world.switchDimension(newDim);

    // 엔티티 모두 제거
    for (const e of entityManager.entities) {
        entityManager.scene.remove(e.mesh);
    }
    entityManager.entities.length = 0;

    // 하늘/안개 색 변경
    if (newDim === 'nether') {
        scene.background = netherSky;
        scene.fog.color = netherSky;
        scene.fog.near = 20;
        scene.fog.far = 80;
        ambientLight.intensity = 0.4;
        sunLight.intensity = 0.2;
    } else if (newDim === 'ender') {
        scene.background = enderSky;
        scene.fog.color = enderSky;
        scene.fog.near = 30;
        scene.fog.far = 120;
        ambientLight.intensity = 0.25;
        sunLight.intensity = 0.15;
        sunLight.color.setHex(0x8855cc);
    } else {
        scene.background = overworldSky;
        scene.fog.color = overworldSky;
        scene.fog.near = 50;
        scene.fog.far = 200;
        ambientLight.intensity = 0.8;
        sunLight.intensity = 0.8;
        sunLight.color.setHex(0xffffff);
    }

    // 플레이어를 안전한 위치에 놓기
    player.position.set(0, 30, 0);
    player.velocity.set(0, 0, 0);
    world.update(0, 0);
    portalCooldown = 3;
    ridingGhast = null;
    ridingDragon = null;
    entityManager.dragonSpawned = false;

    // AI 플레이어 재생성
    for (const ai of aiPlayers) ai.destroy();
    aiPlayers.length = 0;
    for (let i = 0; i < 3; i++) {
        aiPlayers.push(new AIPlayer(scene, world, i));
    }
}

// ---- AI 플레이어 ----
const aiPlayers = [];
for (let i = 0; i < 3; i++) {
    aiPlayers.push(new AIPlayer(scene, world, i));
}

// ---- 멀티플레이어 ----
const mp = new Multiplayer(scene);
let mpSendTimer = 0;

mp.onBlockChange = (x, y, z, blockType, isRemote) => {
    if (isRemote) {
        world.setBlock(x, y, z, blockType);
    }
};

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

    // 가스트 라이딩: 플레이어가 가스트 위에 타고 조종
    if (ridingGhast && ridingGhast.alive && ridingGhast.tamed) {
        const forward = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
        const right = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
        const moveDir = new THREE.Vector3(0, 0, 0);
        if (inputState.forward) moveDir.add(forward);
        if (inputState.backward) moveDir.sub(forward);
        if (inputState.left) moveDir.sub(right);
        if (inputState.right) moveDir.add(right);
        if (inputState.joystickX || inputState.joystickY) {
            moveDir.add(forward.clone().multiplyScalar(-inputState.joystickY));
            moveDir.add(right.clone().multiplyScalar(inputState.joystickX));
        }
        if (moveDir.length() > 0) moveDir.normalize();
        const gs = 4;
        ridingGhast.velocity.x = moveDir.x * gs;
        ridingGhast.velocity.z = moveDir.z * gs;
        ridingGhast.velocity.y = inputState.jump ? 3 : (inputState.descend ? -3 : 0);
        // 플레이어를 가스트 위에 배치
        player.position.copy(ridingGhast.mesh.position);
        player.position.y += 2;
        player.velocity.set(0, 0, 0);
    } else {
        ridingGhast = null;
    }

    // 성체 드래곤 탑승 조종
    if (ridingDragon && ridingDragon.alive && ridingDragon.tamed) {
        const forward = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
        const right = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
        const moveDir = new THREE.Vector3(0, 0, 0);
        if (inputState.forward) moveDir.add(forward);
        if (inputState.backward) moveDir.sub(forward);
        if (inputState.left) moveDir.sub(right);
        if (inputState.right) moveDir.add(right);
        if (inputState.joystickX || inputState.joystickY) {
            moveDir.add(forward.clone().multiplyScalar(-inputState.joystickY));
            moveDir.add(right.clone().multiplyScalar(inputState.joystickX));
        }
        if (moveDir.length() > 0) moveDir.normalize();
        const ds = 6;
        ridingDragon.velocity.x = moveDir.x * ds;
        ridingDragon.velocity.z = moveDir.z * ds;
        ridingDragon.velocity.y = inputState.jump ? 4 : (inputState.descend ? -4 : 0);
        ridingDragon.mesh.position.add(ridingDragon.velocity.clone().multiplyScalar(dt));
        player.position.copy(ridingDragon.mesh.position);
        player.position.y += 2;
        player.velocity.set(0, 0, 0);
    } else {
        if (ridingDragon) { ridingDragon.rider = false; }
        ridingDragon = null;
    }

    world.update(player.position.x, player.position.z);

    // 포탈 진입 체크
    portalCooldown -= dt;
    if (portalCooldown <= 0) {
        const px = Math.floor(player.position.x + 0.5);
        const py = Math.floor(player.position.y + 0.5);
        const pz = Math.floor(player.position.z + 0.5);
        // 플레이어 발~머리 범위 체크
        for (let dy = -1; dy <= 0; dy++) {
            if (world.getBlock(px, py + dy, pz) === BlockType.NETHER_PORTAL) {
                switchDimension();
                break;
            }
        }
    }

    // 허공 낙하 -> 엔더월드
    if (player.position.y < -10 && portalCooldown <= 0) {
        if (world.dimension === 'ender') {
            switchDimension('overworld');
        } else {
            switchDimension('ender');
        }
    }

    // 엔티티 업데이트
    entityManager.update(dt, player.position.x, player.position.y, player.position.z, world.dimension);

    // AI 플레이어 업데이트
    for (const ai of aiPlayers) {
        ai.update(dt, player.position);
    }

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
            if (mp.connected) mp.sendBlockChange(hit.x, hit.y, hit.z, BlockType.AIR);
            interactCooldown = 0.25;
        }
        if (clicks.rightClick) {
            // 시선 방향 엔티티 찾기 (길들이기/상호작용용)
            let nearEntity = null;
            for (let d = 1; d <= 10; d += 1) {
                const cp = player.camera.position.clone().add(dir.clone().multiplyScalar(d));
                for (const e of entityManager.entities) {
                    if (!e.alive) continue;
                    const ex = e.mesh.position.x - cp.x, ey = e.mesh.position.y - cp.y, ez = e.mesh.position.z - cp.z;
                    if (ex*ex + ey*ey + ez*ez < 4) { nearEntity = e; break; }
                }
                if (nearEntity) break;
            }

            let handled = false;

            // 불로 가스트 길들이기 + 타기
            if (currentItem === ITEM_FIRE && nearEntity && nearEntity.type === 'ghast' && !nearEntity.tamed) {
                nearEntity.tamed = true;
                nearEntity.makeHappy();
                interactCooldown = 0.5; handled = true;
            }
            // 불로 드래곤 알 부화 -> 아기 드래곤
            if (!handled && currentItem === ITEM_FIRE && nearEntity && nearEntity.type === 'dragon_egg') {
                const p = nearEntity.mesh.position;
                entityManager.spawnBabyDragon(p.x, p.y + 1, p.z);
                nearEntity.alive = false;
                interactCooldown = 0.5; handled = true;
            }
            // 불로 아기 드래곤 -> 성체 드래곤
            if (!handled && currentItem === ITEM_FIRE && nearEntity && nearEntity.type === 'babydragon') {
                const p = nearEntity.mesh.position;
                entityManager.spawnAdultDragon(p.x, p.y + 1, p.z);
                nearEntity.alive = false;
                interactCooldown = 0.5; handled = true;
            }
            // 성체 드래곤 타기/내리기
            if (!handled && nearEntity && nearEntity.type === 'adultdragon') {
                ridingDragon = ridingDragon === nearEntity ? null : nearEntity;
                if (ridingDragon) ridingDragon.rider = true;
                else nearEntity.rider = false;
                interactCooldown = 0.5; handled = true;
            }
            // 물로 래비아탄 알 부화 -> 가르강튀안 래비아탄
            if (!handled && nearEntity && nearEntity.type === 'leviathan_egg') {
                if (currentItem === BlockType.WATER) {
                    const p = nearEntity.mesh.position;
                    entityManager.spawnLeviathan(p.x, p.y, p.z);
                    nearEntity.alive = false;
                    interactCooldown = 0.5; handled = true;
                }
            }
            // 길들인 가스트 타기 (아무 아이템으로 터치)
            if (!handled && nearEntity && nearEntity.type === 'ghast' && nearEntity.tamed) {
                ridingGhast = ridingGhast === nearEntity ? null : nearEntity;
                interactCooldown = 0.5; handled = true;
            }

            // 클리오네 알로 가디언 길들이기 -> 엔드포탈 생성
            if (!handled && currentItem === SPAWN_EGG_CLIONE && nearEntity && nearEntity.type === 'guardian' && !nearEntity.tamed) {
                nearEntity.tamed = true;
                const ind = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.2,0.2), new THREE.MeshBasicMaterial({color:0x00ff44}));
                ind.position.set(0, 0.7, 0); ind.rotation.set(Math.PI/4, Math.PI/4, 0);
                nearEntity.mesh.add(ind);
                // 가디언 위치에 엔드포탈(네더포탈 블록 재사용) 생성
                const gx = Math.floor(nearEntity.mesh.position.x);
                const gy = Math.floor(nearEntity.mesh.position.y);
                const gz = Math.floor(nearEntity.mesh.position.z);
                for (let px = -1; px <= 1; px++) {
                    for (let pz = -1; pz <= 1; pz++) {
                        world.setBlock(gx + px, gy, gz + pz, BlockType.NETHER_PORTAL);
                    }
                }
                interactCooldown = 0.5; handled = true;
            }

            // 생성알로 위더 길들이기
            if (!handled && (currentItem === SPAWN_EGG_CLIONE || currentItem === SPAWN_EGG_MAJA) && nearEntity && nearEntity.type === 'wither' && !nearEntity.tamed) {
                nearEntity.tamed = true;
                const s = nearEntity.scale;
                const ind = new THREE.Mesh(new THREE.BoxGeometry(0.2*s,0.2*s,0.2*s), new THREE.MeshBasicMaterial({color:0x00ff44}));
                ind.position.set(0, 0.9*s, 0); ind.rotation.set(Math.PI/4, Math.PI/4, 0);
                nearEntity.mesh.add(ind);
                interactCooldown = 0.5; handled = true;
            }

            // 생성알 일반 스폰
            if (!handled && (currentItem === SPAWN_EGG_CLIONE || currentItem === SPAWN_EGG_MAJA) && hit && hit.placeX !== undefined) {
                if (currentItem === SPAWN_EGG_CLIONE) entityManager.spawnClione(hit.placeX, hit.placeY, hit.placeZ);
                else entityManager.spawnMaja(hit.placeX, hit.placeY, hit.placeZ);
                interactCooldown = 0.25; handled = true;
            }

            if (!handled && hit && hit.placeX !== undefined && currentItem === ITEM_BLACK_SKULL) {
                if (hit.block === BlockType.SOUL_DIRT) {
                    const count = countConnectedSoulDirt(hit.x, hit.y, hit.z);
                    const scale = 0.8 + count * 0.3;
                    removeConnectedSoulDirt(hit.x, hit.y, hit.z);
                    entityManager.spawnWither(hit.x, hit.y + 1, hit.z, scale);
                    interactCooldown = 0.5;
                }
                handled = true;
            }
            if (!handled && currentItem === ITEM_FIRE && hit) {
                if (hit.block === BlockType.OBSIDIAN) {
                    tryCreateNetherPortal(hit.x, hit.y, hit.z);
                    interactCooldown = 0.5;
                }
                handled = true;
            }
            // 래비아탄 알 설치
            if (!handled && currentItem === ITEM_LEVIATHAN_EGG && hit && hit.placeX !== undefined) {
                entityManager.spawnLeviathanEgg(hit.placeX, hit.placeY, hit.placeZ);
                interactCooldown = 0.5; handled = true;
            }
            if (!handled && hit && hit.placeX !== undefined) {
                world.setBlock(hit.placeX, hit.placeY, hit.placeZ, currentItem);
                if (mp.connected) mp.sendBlockChange(hit.placeX, hit.placeY, hit.placeZ, currentItem);
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
    const dimName = world.dimension === 'nether' ? '네더' : (world.dimension === 'ender' ? '엔더월드' : '오버월드');
    flyStatusEl.textContent = `${dimName} | ${player.flying ? '비행 중' : '걷기'}`;

    // 멀티플레이어: 위치 전송
    if (mp.connected) {
        mpSendTimer += dt;
        if (mpSendTimer > 0.05) { // 20fps sync
            mp.sendPosition(player.position.x, player.position.y, player.position.z, player.yaw);
            mpSendTimer = 0;
        }
        document.getElementById('player-count').textContent = `접속: ${mp.getPlayerCount()}명`;
    }

    // 드래곤 탑승 시 화염 버튼 표시 + 화염 발사
    const fireBtnEl = document.getElementById('btn-fire');
    if (ridingDragon) {
        fireBtnEl.style.display = 'flex';
        if (firePressed && ridingDragon.fireballCooldown <= 0) {
            const dir = player.getDirection();
            const p = ridingDragon.mesh.position;
            entityManager.spawnFireball(p.x + dir.x * 2, p.y + dir.y * 2, p.z + dir.z * 2, null);
            // Set fireball velocity in look direction
            const fb = entityManager.entities[entityManager.entities.length - 1];
            fb.velocity = dir.clone().multiplyScalar(12);
            fb.target = null;
            ridingDragon.fireballCooldown = 0.5;
        }
    } else {
        fireBtnEl.style.display = 'none';
    }
    firePressed = false;

    renderer.render(scene, camera);
}

// ---- 시작 버튼 ----
function startGame() {
    started = true;
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('info').style.display = 'block';
    document.getElementById('selected-block').style.display = 'block';
    hudEl.style.display = 'flex';
    document.getElementById('cmd-bar').style.display = 'flex';
    if (!input.isMobile) {
        canvas.requestPointerLock();
    }
}

// 혼자 플레이
document.getElementById('start-solo').addEventListener('click', startGame);

// 방 만들기
document.getElementById('start-host').addEventListener('click', async () => {
    document.getElementById('room-info').style.display = 'block';
    document.getElementById('host-status').textContent = '연결 중...';
    try {
        const roomId = await mp.host();
        document.getElementById('room-code').textContent = roomId;
        document.getElementById('host-status').textContent = '접속 대기 중... 코드를 공유하세요';
        document.getElementById('start-host-game').style.display = 'inline-block';
    } catch (err) {
        document.getElementById('host-status').textContent = '오류: ' + err.message;
    }
});

document.getElementById('start-host-game').addEventListener('click', startGame);

// 코드 복사
document.getElementById('copy-code').addEventListener('click', () => {
    const code = document.getElementById('room-code').textContent;
    navigator.clipboard.writeText(code).then(() => {
        document.getElementById('copy-code').textContent = '복사됨!';
        setTimeout(() => document.getElementById('copy-code').textContent = '복사', 1500);
    });
});

// 방 참가
document.getElementById('start-join').addEventListener('click', () => {
    document.getElementById('join-section').style.display = 'block';
});

document.getElementById('join-btn').addEventListener('click', async () => {
    const code = document.getElementById('join-code').value.trim();
    if (!code) return;
    document.getElementById('join-status').textContent = '접속 중...';
    try {
        await mp.join(code);
        document.getElementById('join-status').textContent = '접속 완료!';
        setTimeout(startGame, 500);
    } catch (err) {
        document.getElementById('join-status').textContent = '접속 실패: ' + err.message;
    }
});

// ---- 드래곤 화염 발사 ----
let firePressed = false;
const fireBtn = document.getElementById('btn-fire');
if (fireBtn) {
    fireBtn.addEventListener('touchstart', (e) => { e.preventDefault(); firePressed = true; }, { passive: false });
    fireBtn.addEventListener('click', () => { firePressed = true; });
}
document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyF' && ridingDragon && !chatOpen) { firePressed = true; }
});

// ---- 명령어 시스템 ----
const chatInput = document.getElementById('chat-input');
const chatMsg = document.getElementById('chat-msg');
let chatOpen = false;

const MOB_LIST = {
    'clione': '클리오네', 'maja': '엘 그란 마하', 'bloop': '블룹',
    'meowl': '미아울', 'wither': '위더', 'ghast': '가스트',
    'guardian': '가디언', 'enderdragon': '엔더드래곤',
    'dragon_egg': '드래곤 알', 'babydragon': '아기 드래곤',
    'adultdragon': '성체 드래곤',
    'leviathan_egg': '래비아탄 알', 'leviathan': '가르강튀안 래비아탄',
};

document.addEventListener('keydown', (e) => {
    if (!started) return;
    if (!chatOpen && (e.key === 't' || e.key === 'T' || e.key === '/')) {
        e.preventDefault();
        chatOpen = true;
        chatInput.style.display = 'block';
        chatInput.value = e.key === '/' ? '/' : '';
        chatInput.focus();
        if (document.pointerLockElement) document.exitPointerLock();
        return;
    }
    if (chatOpen && e.key === 'Escape') {
        chatOpen = false;
        chatInput.style.display = 'none';
        chatInput.value = '';
    }
});

chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = chatInput.value.trim();
        chatOpen = false;
        chatInput.style.display = 'none';
        chatInput.value = '';
        if (cmd) executeCommand(cmd);
    }
    e.stopPropagation();
});

function showChatMsg(text, color = '#fff') {
    chatMsg.textContent = text;
    chatMsg.style.color = color;
    chatMsg.style.display = 'block';
    setTimeout(() => chatMsg.style.display = 'none', 3000);
}

// 명령어 버튼 클릭
document.querySelectorAll('.cmd-btn').forEach(btn => {
    const handler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const cmd = btn.dataset.cmd;
        if (cmd && started) executeCommand(cmd);
    };
    btn.addEventListener('click', handler);
    btn.addEventListener('touchstart', handler, { passive: false });
});

function executeCommand(cmd) {
    const parts = cmd.replace(/^\//, '').split(/\s+/);
    const name = parts[0]?.toLowerCase();

    if (name === 'summon') {
        const mobName = parts[1]?.toLowerCase();
        if (!mobName) {
            showChatMsg('사용법: /summon <몹이름>  |  목록: ' + Object.keys(MOB_LIST).join(', '), '#ffaa00');
            return;
        }
        const p = player.position;
        const dir = player.getDirection();
        const sx = p.x + dir.x * 3, sy = p.y, sz = p.z + dir.z * 3;

        const spawners = {
            clione: () => entityManager.spawnClione(sx, sy, sz),
            maja: () => entityManager.spawnMaja(sx, sy, sz),
            bloop: () => entityManager.spawnBloop(sx, sy, sz),
            meowl: () => entityManager.spawnMeowl(sx, sy + 5, sz),
            wither: () => entityManager.spawnWither(sx, sy + 2, sz, 1.5),
            ghast: () => entityManager.spawnGhast(sx, sy + 3, sz),
            guardian: () => entityManager.spawnGuardian(sx, sy, sz),
            enderdragon: () => entityManager.spawnEnderDragon(sx, sy + 10, sz),
            dragon_egg: () => entityManager.spawnDragonEgg(sx, sy + 1, sz),
            babydragon: () => entityManager.spawnBabyDragon(sx, sy + 1, sz),
            adultdragon: () => entityManager.spawnAdultDragon(sx, sy + 2, sz),
            leviathan_egg: () => entityManager.spawnLeviathanEgg(sx, sy + 1, sz),
            leviathan: () => entityManager.spawnLeviathan(sx, sy, sz),
        };
        if (!spawners[mobName]) {
            showChatMsg(`알 수 없는 몹: ${mobName}  |  목록: ${Object.keys(MOB_LIST).join(', ')}`, '#ff4444');
            return;
        }
        spawners[mobName]();
        showChatMsg(`${MOB_LIST[mobName] || mobName} 소환됨!`, '#44ff44');
    } else if (name === 'help') {
        showChatMsg('명령어: /summon <몹이름> | /kill | /tp <x> <y> <z> | /help', '#aaaaff');
    } else if (name === 'kill') {
        let count = 0;
        for (const e of entityManager.entities) { if (e.alive && e.type !== 'babydragon') { e.alive = false; count++; } }
        showChatMsg(`${count}마리 처치됨`, '#ff4444');
    } else if (name === 'tp') {
        const tx = parseFloat(parts[1]), ty = parseFloat(parts[2]), tz = parseFloat(parts[3]);
        if (!isNaN(tx) && !isNaN(ty) && !isNaN(tz)) {
            player.position.set(tx, ty, tz);
            player.velocity.set(0, 0, 0);
            showChatMsg(`텔레포트: ${tx}, ${ty}, ${tz}`, '#44ff44');
        } else {
            showChatMsg('사용법: /tp <x> <y> <z>', '#ffaa00');
        }
    } else {
        showChatMsg(`알 수 없는 명령어: /${name}  |  /help 로 확인`, '#ff4444');
    }
}

// ---- 리사이즈 ----
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

requestAnimationFrame(gameLoop);
