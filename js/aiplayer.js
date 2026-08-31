import * as THREE from 'three';
import { BlockType, isSolid } from './blocks.js';

const AI_SPEED = 3;
const AI_NAMES = ['Alex', 'Steve', 'Ari', 'Kai', 'Zed', 'Nix'];
const SKIN_COLORS = [0x3388cc, 0xcc4433, 0x44aa44, 0xcc8833, 0x8844aa, 0xaa4488];

function createAIPlayerMesh(colorIndex) {
    const group = new THREE.Group();
    const color = SKIN_COLORS[colorIndex % SKIN_COLORS.length];

    // Body
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.8, 0.3),
        new THREE.MeshLambertMaterial({ color })
    );
    body.position.y = 0.4;
    group.add(body);

    // Head
    const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.45, 0.45),
        new THREE.MeshLambertMaterial({ color: 0xffcc88 })
    );
    head.position.y = 1.05;
    group.add(head);

    // Eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.05), eyeMat);
    eyeL.position.set(-0.1, 1.1, -0.23);
    group.add(eyeL);
    const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.05), eyeMat);
    eyeR.position.set(0.1, 1.1, -0.23);
    group.add(eyeR);

    // Arms
    const armMat = new THREE.MeshLambertMaterial({ color });
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.25), armMat);
    armL.position.set(-0.35, 0.35, 0);
    armL.name = 'armL';
    group.add(armL);
    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.25), armMat);
    armR.position.set(0.35, 0.35, 0);
    armR.name = 'armR';
    group.add(armR);

    // Legs
    const legMat = new THREE.MeshLambertMaterial({ color: 0x333366 });
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.25), legMat);
    legL.position.set(-0.12, -0.3, 0);
    legL.name = 'legL';
    group.add(legL);
    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.25), legMat);
    legR.position.set(0.12, -0.3, 0);
    legR.name = 'legR';
    group.add(legR);

    // Nametag
    return group;
}

export class AIPlayer {
    constructor(scene, world, index) {
        this.scene = scene;
        this.world = world;
        this.name = AI_NAMES[index % AI_NAMES.length];
        this.mesh = createAIPlayerMesh(index);
        this.position = new THREE.Vector3(
            (Math.random() - 0.5) * 20,
            40,
            (Math.random() - 0.5) * 20
        );
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.yaw = Math.random() * Math.PI * 2;
        this.onGround = false;
        this.time = Math.random() * 100;

        // AI state
        this.state = 'wander'; // wander, build, follow, look
        this.stateTimer = 3 + Math.random() * 5;
        this.targetPos = null;
        this.buildTimer = 0;

        // Spawn on ground
        for (let y = 60; y >= 0; y--) {
            if (isSolid(world.getBlock(Math.floor(this.position.x), y, Math.floor(this.position.z)))) {
                this.position.y = y + 2.6;
                break;
            }
        }

        this.mesh.position.copy(this.position);
        this.mesh.position.y -= 0.8;
        scene.add(this.mesh);
    }

    update(dt, playerPos) {
        this.time += dt;
        this.stateTimer -= dt;

        // Switch state
        if (this.stateTimer <= 0) {
            const r = Math.random();
            if (r < 0.4) {
                this.state = 'wander';
                this.stateTimer = 4 + Math.random() * 6;
                this._pickWanderTarget();
            } else if (r < 0.65) {
                this.state = 'build';
                this.stateTimer = 3 + Math.random() * 4;
                this.buildTimer = 0;
            } else if (r < 0.85) {
                this.state = 'follow';
                this.stateTimer = 5 + Math.random() * 5;
            } else {
                this.state = 'look';
                this.stateTimer = 2 + Math.random() * 3;
                this.yaw += (Math.random() - 0.5) * 2;
            }
        }

        // Execute state
        switch (this.state) {
            case 'wander': this._doWander(dt); break;
            case 'build': this._doBuild(dt); break;
            case 'follow': this._doFollow(dt, playerPos); break;
            case 'look': break; // just stand still
        }

        // Gravity
        this.velocity.y -= 25 * dt;
        this.position.y += this.velocity.y * dt;

        // Ground collision
        const bx = Math.floor(this.position.x + 0.5);
        const by = Math.floor(this.position.y - 1.6 + 0.5);
        const bz = Math.floor(this.position.z + 0.5);
        if (isSolid(this.world.getBlock(bx, by, bz))) {
            this.position.y = by + 0.5 + 1.6;
            this.velocity.y = 0;
            this.onGround = true;
        } else {
            this.onGround = false;
        }

        // Jump over obstacles
        const fx = Math.floor(this.position.x + Math.sin(this.yaw) * -0.5 + 0.5);
        const fz = Math.floor(this.position.z + Math.cos(this.yaw) * -0.5 + 0.5);
        const fy = Math.floor(this.position.y - 0.5);
        if (isSolid(this.world.getBlock(fx, fy, fz)) && this.onGround) {
            this.velocity.y = 7;
        }

        // Arm/leg animation when moving
        const moving = Math.abs(this.velocity.x) > 0.1 || Math.abs(this.velocity.z) > 0.1;
        const swing = moving ? Math.sin(this.time * 8) * 0.6 : 0;
        const armL = this.mesh.getObjectByName('armL');
        const armR = this.mesh.getObjectByName('armR');
        const legL = this.mesh.getObjectByName('legL');
        const legR = this.mesh.getObjectByName('legR');
        if (armL) armL.rotation.x = swing;
        if (armR) armR.rotation.x = -swing;
        if (legL) legL.rotation.x = -swing;
        if (legR) legR.rotation.x = swing;

        // Update mesh
        this.mesh.position.set(this.position.x, this.position.y - 0.8, this.position.z);
        this.mesh.rotation.y = this.yaw;
    }

    _pickWanderTarget() {
        const angle = Math.random() * Math.PI * 2;
        const dist = 5 + Math.random() * 15;
        this.targetPos = new THREE.Vector3(
            this.position.x + Math.cos(angle) * dist,
            this.position.y,
            this.position.z + Math.sin(angle) * dist
        );
    }

    _doWander(dt) {
        if (!this.targetPos) this._pickWanderTarget();
        this._moveToward(this.targetPos, dt, AI_SPEED);
        const dx = this.targetPos.x - this.position.x;
        const dz = this.targetPos.z - this.position.z;
        if (dx * dx + dz * dz < 4) this._pickWanderTarget();
    }

    _doFollow(dt, playerPos) {
        const dx = playerPos.x - this.position.x;
        const dz = playerPos.z - this.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > 5) {
            this._moveToward(playerPos, dt, AI_SPEED);
        } else if (dist < 3) {
            // Back away slightly
            this.yaw = Math.atan2(-dx, -dz);
        }
    }

    _doBuild(dt) {
        this.buildTimer -= dt;
        if (this.buildTimer <= 0) {
            this.buildTimer = 0.8 + Math.random() * 0.5;
            const bx = Math.floor(this.position.x + (Math.random() - 0.5) * 3 + 0.5);
            const bz = Math.floor(this.position.z + (Math.random() - 0.5) * 3 + 0.5);
            const by = Math.floor(this.position.y - 0.5);

            // Place a random block nearby
            if (this.world.getBlock(bx, by, bz) === BlockType.AIR &&
                isSolid(this.world.getBlock(bx, by - 1, bz))) {
                const blocks = [BlockType.STONE, BlockType.WOOD, BlockType.DIRT, BlockType.SAND];
                const bt = blocks[Math.floor(Math.random() * blocks.length)];
                this.world.setBlock(bx, by, bz, bt);
            }
        }
        // Look around while building
        this.yaw += Math.sin(this.time * 0.5) * dt * 0.5;
    }

    _moveToward(target, dt, speed) {
        const dx = target.x - this.position.x;
        const dz = target.z - this.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 0.5) return;

        const targetYaw = Math.atan2(dx, dz);
        let diff = targetYaw - this.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.yaw += diff * dt * 4;

        const mx = Math.sin(this.yaw) * speed * dt;
        const mz = Math.cos(this.yaw) * speed * dt;
        this.position.x += mx;
        this.position.z += mz;
        this.velocity.x = mx / dt;
        this.velocity.z = mz / dt;
    }

    destroy() {
        this.scene.remove(this.mesh);
    }
}
