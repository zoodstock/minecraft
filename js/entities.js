import * as THREE from 'three';
import { BlockType } from './blocks.js';

// Clione (Sea Angel) - translucent rectangular body with orange accents
// Spawns naturally in water, floats around peacefully

const CLIONE_BODY_W = 0.2;
const CLIONE_BODY_H = 0.4;
const CLIONE_BODY_D = 0.15;
const SWIM_SPEED = 0.4;
const WING_FLAP_SPEED = 6;
const BOB_SPEED = 2;

function createClioneMesh() {
    const group = new THREE.Group();

    // Main body - translucent white/pink rectangle
    const bodyGeo = new THREE.BoxGeometry(CLIONE_BODY_W, CLIONE_BODY_H, CLIONE_BODY_D);
    const bodyMat = new THREE.MeshLambertMaterial({
        color: 0xe8d8d0,
        transparent: true,
        opacity: 0.55,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    group.add(body);

    // Inner organs - orange/red center spot
    const organGeo = new THREE.BoxGeometry(0.08, 0.12, 0.06);
    const organMat = new THREE.MeshLambertMaterial({
        color: 0xff6030,
        transparent: true,
        opacity: 0.8,
    });
    const organ = new THREE.Mesh(organGeo, organMat);
    organ.position.set(0, 0.02, 0);
    group.add(organ);

    // Head - slightly rounder top, lighter
    const headGeo = new THREE.BoxGeometry(0.16, 0.1, 0.12);
    const headMat = new THREE.MeshLambertMaterial({
        color: 0xf0e0d8,
        transparent: true,
        opacity: 0.6,
    });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0, 0.25, 0);
    group.add(head);

    // Tentacles/horns on head - two small orange prongs
    const hornGeo = new THREE.BoxGeometry(0.03, 0.08, 0.03);
    const hornMat = new THREE.MeshLambertMaterial({
        color: 0xff7040,
        transparent: true,
        opacity: 0.75,
    });
    const hornL = new THREE.Mesh(hornGeo, hornMat);
    hornL.position.set(-0.04, 0.33, 0);
    group.add(hornL);
    const hornR = new THREE.Mesh(hornGeo, hornMat);
    hornR.position.set(0.04, 0.33, 0);
    group.add(hornR);

    // Wings (parapodia) - flat translucent flaps on sides
    const wingGeo = new THREE.BoxGeometry(0.15, 0.1, 0.02);
    const wingMat = new THREE.MeshLambertMaterial({
        color: 0xf0e8e0,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
    });
    const wingL = new THREE.Mesh(wingGeo, wingMat);
    wingL.position.set(-0.16, 0.08, 0);
    wingL.name = 'wingL';
    group.add(wingL);

    const wingR = new THREE.Mesh(wingGeo, wingMat);
    wingR.position.set(0.16, 0.08, 0);
    wingR.name = 'wingR';
    group.add(wingR);

    // Tail - tapered bottom
    const tailGeo = new THREE.BoxGeometry(0.1, 0.08, 0.08);
    const tailMat = new THREE.MeshLambertMaterial({
        color: 0xe0d0c8,
        transparent: true,
        opacity: 0.45,
    });
    const tail = new THREE.Mesh(tailGeo, tailMat);
    tail.position.set(0, -0.24, 0);
    group.add(tail);

    return group;
}

class Clione {
    constructor(x, y, z) {
        this.mesh = createClioneMesh();
        this.mesh.position.set(x, y, z);
        this.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * SWIM_SPEED,
            (Math.random() - 0.5) * 0.1,
            (Math.random() - 0.5) * SWIM_SPEED
        );
        this.time = Math.random() * Math.PI * 2;
        this.dirChangeTimer = 2 + Math.random() * 4;
        this.alive = true;
    }

    update(dt, world) {
        this.time += dt;

        // Wing flapping animation
        const wingL = this.mesh.getObjectByName('wingL');
        const wingR = this.mesh.getObjectByName('wingR');
        if (wingL && wingR) {
            const flap = Math.sin(this.time * WING_FLAP_SPEED) * 0.5;
            wingL.rotation.z = flap;
            wingR.rotation.z = -flap;
        }

        // Gentle bobbing
        const bob = Math.sin(this.time * BOB_SPEED) * 0.02;
        this.mesh.position.y += bob * dt;

        // Change direction periodically
        this.dirChangeTimer -= dt;
        if (this.dirChangeTimer <= 0) {
            this.velocity.x = (Math.random() - 0.5) * SWIM_SPEED;
            this.velocity.z = (Math.random() - 0.5) * SWIM_SPEED;
            this.velocity.y = (Math.random() - 0.5) * 0.15;
            this.dirChangeTimer = 2 + Math.random() * 5;
        }

        // Move
        const pos = this.mesh.position;
        pos.x += this.velocity.x * dt;
        pos.y += this.velocity.y * dt;
        pos.z += this.velocity.z * dt;

        // Face movement direction (rotate on Y axis)
        if (Math.abs(this.velocity.x) > 0.01 || Math.abs(this.velocity.z) > 0.01) {
            const targetYaw = Math.atan2(this.velocity.x, this.velocity.z);
            this.mesh.rotation.y += (targetYaw - this.mesh.rotation.y) * dt * 2;
        }

        // Stay in water - check if current block is water
        const bx = Math.floor(pos.x + 0.5);
        const by = Math.floor(pos.y + 0.5);
        const bz = Math.floor(pos.z + 0.5);
        const currentBlock = world.getBlock(bx, by, bz);

        if (currentBlock !== BlockType.WATER) {
            // Try to swim back into water
            // Check above/below for water
            const aboveBlock = world.getBlock(bx, by + 1, bz);
            const belowBlock = world.getBlock(bx, by - 1, bz);

            if (aboveBlock === BlockType.WATER) {
                this.velocity.y = 0.3;
            } else if (belowBlock === BlockType.WATER) {
                this.velocity.y = -0.3;
            } else {
                // Reverse horizontal direction
                this.velocity.x *= -1;
                this.velocity.z *= -1;
                pos.x += this.velocity.x * dt * 3;
                pos.z += this.velocity.z * dt * 3;
            }
        }

        // Keep Y within bounds
        if (pos.y < 1) {
            pos.y = 1;
            this.velocity.y = Math.abs(this.velocity.y);
        }
    }
}

export class EntityManager {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        this.entities = [];
        this.spawnCheckTimer = 0;
        this.maxCliones = 30;
    }

    // Spawn a clione at specific position (spawn egg)
    spawnClione(x, y, z) {
        const clione = new Clione(x, y, z);
        this.entities.push(clione);
        this.scene.add(clione.mesh);
        return clione;
    }

    // Natural spawning in water near player
    tryNaturalSpawn(playerX, playerZ) {
        if (this.entities.length >= this.maxCliones) return;

        // Try to spawn in water within 20-40 blocks of player
        const angle = Math.random() * Math.PI * 2;
        const dist = 20 + Math.random() * 20;
        const sx = Math.floor(playerX + Math.cos(angle) * dist);
        const sz = Math.floor(playerZ + Math.sin(angle) * dist);

        // Find water at this position
        for (let y = 10; y <= 20; y++) {
            if (this.world.getBlock(sx, y, sz) === BlockType.WATER) {
                this.spawnClione(sx, y, sz);
                return;
            }
        }
    }

    update(dt, playerX, playerZ) {
        // Natural spawn check every 3 seconds
        this.spawnCheckTimer -= dt;
        if (this.spawnCheckTimer <= 0) {
            this.tryNaturalSpawn(playerX, playerZ);
            this.spawnCheckTimer = 3;
        }

        // Update all entities
        for (let i = this.entities.length - 1; i >= 0; i--) {
            const entity = this.entities[i];
            entity.update(dt, this.world);

            // Remove if too far from player (> 80 blocks)
            const dx = entity.mesh.position.x - playerX;
            const dz = entity.mesh.position.z - playerZ;
            if (dx * dx + dz * dz > 80 * 80) {
                this.scene.remove(entity.mesh);
                this.entities.splice(i, 1);
            }
        }
    }
}
