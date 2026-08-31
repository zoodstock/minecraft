import * as THREE from 'three';
import { isSolid } from './blocks.js';
import { CHUNK_HEIGHT } from './world.js';

const PLAYER_HEIGHT = 1.6;
const PLAYER_WIDTH = 0.3;
const GRAVITY = -25;
const JUMP_SPEED = 9;
const MOVE_SPEED = 5;
const SPRINT_SPEED = 8;
const FLY_SPEED = 12;
const FLY_VERTICAL_SPEED = 8;
const DOUBLE_TAP_TIME = 300; // ms

export class Player {
    constructor(camera, world) {
        this.camera = camera;
        this.world = world;
        this.position = new THREE.Vector3(0, 40, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.onGround = false;
        this.pitch = 0;
        this.yaw = 0;

        // Creative mode flying
        this.flying = false;
        this.lastJumpTime = 0;
        this.jumpWasPressed = false;

        // Spawn on solid ground
        for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
            if (isSolid(world.getBlock(0, y, 0))) {
                this.position.y = y + 1 + PLAYER_HEIGHT;
                break;
            }
        }
    }

    update(dt, inputState) {
        dt = Math.min(dt, 0.05);

        // Mouse look
        this.yaw -= inputState.mouseDX * 0.002;
        this.pitch -= inputState.mouseDY * 0.002;
        this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));

        // Double-tap jump to toggle flying
        const now = performance.now();
        if (inputState.jump && !this.jumpWasPressed) {
            if (now - this.lastJumpTime < DOUBLE_TAP_TIME) {
                this.flying = !this.flying;
                this.velocity.y = 0;
            }
            this.lastJumpTime = now;
        }
        this.jumpWasPressed = inputState.jump;

        // Movement direction
        const forward = new THREE.Vector3(
            -Math.sin(this.yaw), 0, -Math.cos(this.yaw)
        ).normalize();
        const right = new THREE.Vector3(
            Math.cos(this.yaw), 0, -Math.sin(this.yaw)
        ).normalize();

        const speed = this.flying ? FLY_SPEED : (inputState.sprint ? SPRINT_SPEED : MOVE_SPEED);
        const moveDir = new THREE.Vector3(0, 0, 0);

        if (inputState.forward) moveDir.add(forward);
        if (inputState.backward) moveDir.sub(forward);
        if (inputState.left) moveDir.sub(right);
        if (inputState.right) moveDir.add(right);

        // Joystick movement
        if (inputState.joystickX !== 0 || inputState.joystickY !== 0) {
            moveDir.add(forward.clone().multiplyScalar(-inputState.joystickY));
            moveDir.add(right.clone().multiplyScalar(inputState.joystickX));
        }

        if (moveDir.length() > 0) moveDir.normalize();

        // Apply velocity
        this.velocity.x = moveDir.x * speed;
        this.velocity.z = moveDir.z * speed;

        if (this.flying) {
            // Flying mode: space=up, shift=down, no gravity
            this.velocity.y = 0;
            if (inputState.jump) this.velocity.y = FLY_VERTICAL_SPEED;
            if (inputState.descend) this.velocity.y = -FLY_VERTICAL_SPEED;

            // Fly movement (no collision)
            this.position.x += this.velocity.x * dt;
            this.position.y += this.velocity.y * dt;
            this.position.z += this.velocity.z * dt;
            if (this.position.y < -20) this.position.y = -20;
        } else {
            // Normal mode: gravity & jump
            this.velocity.y += GRAVITY * dt;
            if (inputState.jump && this.onGround) {
                this.velocity.y = JUMP_SPEED;
                this.onGround = false;
            }
            this._moveWithCollision(dt);
        }

        // Update camera
        this.camera.position.copy(this.position);
        const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
        this.camera.quaternion.setFromEuler(euler);
    }

    _moveWithCollision(dt) {
        const pw = PLAYER_WIDTH;

        this.position.x += this.velocity.x * dt;
        if (this._collides(pw)) {
            this.position.x -= this.velocity.x * dt;
            this.velocity.x = 0;
        }

        this.position.z += this.velocity.z * dt;
        if (this._collides(pw)) {
            this.position.z -= this.velocity.z * dt;
            this.velocity.z = 0;
        }

        this.position.y += this.velocity.y * dt;
        this.onGround = false;
        if (this._collides(pw)) {
            if (this.velocity.y < 0) this.onGround = true;
            this.position.y -= this.velocity.y * dt;
            this.velocity.y = 0;
        }

        if (this.position.y < -20) {
            this.position.y = -20;
            this.velocity.y = 0;
            this.onGround = true;
        }
    }

    _collides(pw) {
        const px = this.position.x, py = this.position.y, pz = this.position.z;
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                for (let dy = -PLAYER_HEIGHT; dy <= 0.2; dy += 0.5) {
                    const bx = Math.floor(px + dx * pw + 0.5);
                    const by = Math.floor(py + dy + 0.5);
                    const bz = Math.floor(pz + dz * pw + 0.5);
                    if (isSolid(this.world.getBlock(bx, by, bz))) {
                        const minX = bx - 0.5, maxX = bx + 0.5;
                        const minY = by - 0.5, maxY = by + 0.5;
                        const minZ = bz - 0.5, maxZ = bz + 0.5;
                        if (px + pw > minX && px - pw < maxX &&
                            py > minY && py - PLAYER_HEIGHT < maxY &&
                            pz + pw > minZ && pz - pw < maxZ) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    getDirection() {
        const dir = new THREE.Vector3(0, 0, -1);
        dir.applyQuaternion(this.camera.quaternion);
        return dir;
    }
}
