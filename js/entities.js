import * as THREE from 'three';
import { BlockType } from './blocks.js';

// ============================================================
// Clione (Sea Angel) - translucent rectangular body with orange accents
// Spawns naturally in water, floats around peacefully
// ============================================================

const SWIM_SPEED = 0.4;
const WING_FLAP_SPEED = 6;
const BOB_SPEED = 2;

function createClioneMesh() {
    const group = new THREE.Group();

    const bodyGeo = new THREE.BoxGeometry(0.2, 0.4, 0.15);
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0xe8d8d0, transparent: true, opacity: 0.55 });
    group.add(new THREE.Mesh(bodyGeo, bodyMat));

    const organGeo = new THREE.BoxGeometry(0.08, 0.12, 0.06);
    const organMat = new THREE.MeshLambertMaterial({ color: 0xff6030, transparent: true, opacity: 0.8 });
    const organ = new THREE.Mesh(organGeo, organMat);
    organ.position.set(0, 0.02, 0);
    group.add(organ);

    const headGeo = new THREE.BoxGeometry(0.16, 0.1, 0.12);
    const headMat = new THREE.MeshLambertMaterial({ color: 0xf0e0d8, transparent: true, opacity: 0.6 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0, 0.25, 0);
    group.add(head);

    const hornGeo = new THREE.BoxGeometry(0.03, 0.08, 0.03);
    const hornMat = new THREE.MeshLambertMaterial({ color: 0xff7040, transparent: true, opacity: 0.75 });
    const hornL = new THREE.Mesh(hornGeo, hornMat);
    hornL.position.set(-0.04, 0.33, 0);
    group.add(hornL);
    const hornR = new THREE.Mesh(hornGeo, hornMat);
    hornR.position.set(0.04, 0.33, 0);
    group.add(hornR);

    const wingGeo = new THREE.BoxGeometry(0.15, 0.1, 0.02);
    const wingMat = new THREE.MeshLambertMaterial({ color: 0xf0e8e0, transparent: true, opacity: 0.4, side: THREE.DoubleSide });
    const wingL = new THREE.Mesh(wingGeo, wingMat);
    wingL.position.set(-0.16, 0.08, 0);
    wingL.name = 'wingL';
    group.add(wingL);
    const wingR = new THREE.Mesh(wingGeo, wingMat);
    wingR.position.set(0.16, 0.08, 0);
    wingR.name = 'wingR';
    group.add(wingR);

    const tailGeo = new THREE.BoxGeometry(0.1, 0.08, 0.08);
    const tailMat = new THREE.MeshLambertMaterial({ color: 0xe0d0c8, transparent: true, opacity: 0.45 });
    const tail = new THREE.Mesh(tailGeo, tailMat);
    tail.position.set(0, -0.24, 0);
    group.add(tail);

    return group;
}

class Clione {
    constructor(x, y, z) {
        this.type = 'clione';
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
        if (!this.alive) return;
        this.time += dt;

        const wingL = this.mesh.getObjectByName('wingL');
        const wingR = this.mesh.getObjectByName('wingR');
        if (wingL && wingR) {
            const flap = Math.sin(this.time * WING_FLAP_SPEED) * 0.5;
            wingL.rotation.z = flap;
            wingR.rotation.z = -flap;
        }

        this.mesh.position.y += Math.sin(this.time * BOB_SPEED) * 0.02 * dt;

        this.dirChangeTimer -= dt;
        if (this.dirChangeTimer <= 0) {
            this.velocity.x = (Math.random() - 0.5) * SWIM_SPEED;
            this.velocity.z = (Math.random() - 0.5) * SWIM_SPEED;
            this.velocity.y = (Math.random() - 0.5) * 0.15;
            this.dirChangeTimer = 2 + Math.random() * 5;
        }

        const pos = this.mesh.position;
        pos.x += this.velocity.x * dt;
        pos.y += this.velocity.y * dt;
        pos.z += this.velocity.z * dt;

        if (Math.abs(this.velocity.x) > 0.01 || Math.abs(this.velocity.z) > 0.01) {
            const targetYaw = Math.atan2(this.velocity.x, this.velocity.z);
            this.mesh.rotation.y += (targetYaw - this.mesh.rotation.y) * dt * 2;
        }

        this._stayInWater(world);
    }

    _stayInWater(world) {
        const pos = this.mesh.position;
        const bx = Math.floor(pos.x + 0.5), by = Math.floor(pos.y + 0.5), bz = Math.floor(pos.z + 0.5);
        if (world.getBlock(bx, by, bz) !== BlockType.WATER) {
            if (world.getBlock(bx, by + 1, bz) === BlockType.WATER) {
                this.velocity.y = 0.3;
            } else if (world.getBlock(bx, by - 1, bz) === BlockType.WATER) {
                this.velocity.y = -0.3;
            } else {
                this.velocity.x *= -1;
                this.velocity.z *= -1;
            }
        }
        if (pos.y < 1) { pos.y = 1; this.velocity.y = Math.abs(this.velocity.y); }
    }
}

// ============================================================
// El Gran Maja - giant deep sea predator
// Manta-ray shaped head, long eel body, 6 glowing eyes, sharp teeth
// Hunts and eats Cliones. Does NOT attack player.
// ============================================================

const MAJA_SWIM_SPEED = 0.6;
const MAJA_HUNT_SPEED = 1.8;
const MAJA_EAT_RANGE = 1.5;

function createMajaMesh() {
    const group = new THREE.Group();
    const blueColor = 0x4060a0;   // blue-indigo body
    const darkBlue = 0x2a3a70;
    const bellyColor = 0x5570b0;

    // --- HEAD: snake-like rounded shape, wide and flat ---
    // Upper head - wider and flatter
    const headTopGeo = new THREE.SphereGeometry(0.8, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const headTopMat = new THREE.MeshLambertMaterial({ color: blueColor });
    const headTop = new THREE.Mesh(headTopGeo, headTopMat);
    headTop.scale.set(1.7, 0.55, 1.2);
    headTop.position.set(0, 0.15, -1.5);
    group.add(headTop);

    // Snout - wider and flatter
    const snoutGeo = new THREE.SphereGeometry(0.7, 8, 6);
    const snoutMat = new THREE.MeshLambertMaterial({ color: blueColor });
    const snout = new THREE.Mesh(snoutGeo, snoutMat);
    snout.scale.set(1.5, 0.45, 0.9);
    snout.position.set(0, 0.05, -2.1);
    group.add(snout);

    // --- EYES: 6 in a single horizontal row, slightly forward ---
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x40ffcc });
    const eyeGlowMat = new THREE.MeshBasicMaterial({
        color: 0x40ffcc, transparent: true, opacity: 0.35,
    });
    for (let i = 0; i < 6; i++) {
        const xPos = (i - 2.5) * 0.18;
        const eyeGeo = new THREE.SphereGeometry(0.065, 6, 6);
        const eye = new THREE.Mesh(eyeGeo, eyeMat);
        eye.position.set(xPos, 0.32, -4.0);
        eye.name = `eye${i}`;
        group.add(eye);

        const glowGeo = new THREE.SphereGeometry(0.12, 6, 6);
        const glow = new THREE.Mesh(glowGeo, eyeGlowMat.clone());
        glow.position.set(xPos, 0.32, -4.0);
        glow.name = `eyeGlow${i}`;
        group.add(glow);
    }

    // --- MOUTH: huge gaping jaw with red gums ---
    // Upper jaw
    const upperJawGeo = new THREE.SphereGeometry(0.7, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    const upperJawMat = new THREE.MeshLambertMaterial({ color: blueColor });
    const upperJaw = new THREE.Mesh(upperJawGeo, upperJawMat);
    upperJaw.scale.set(1.3, 0.3, 0.9);
    upperJaw.rotation.x = Math.PI;
    upperJaw.position.set(0, -0.05, -2.2);
    group.add(upperJaw);

    // Lower jaw (opens)
    const lowerJawGroup = new THREE.Group();
    lowerJawGroup.name = 'lowerJaw';
    lowerJawGroup.position.set(0, -0.15, -1.5);

    const lowerJawGeo = new THREE.SphereGeometry(0.65, 8, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    const lowerJawMat = new THREE.MeshLambertMaterial({ color: darkBlue });
    const lowerJawMesh = new THREE.Mesh(lowerJawGeo, lowerJawMat);
    lowerJawMesh.scale.set(1.2, 0.35, 0.85);
    lowerJawMesh.position.set(0, 0, -0.7);
    lowerJawGroup.add(lowerJawMesh);

    // Red gums on lower jaw
    const lowerGumGeo = new THREE.BoxGeometry(1.3, 0.06, 0.6);
    const gumMat = new THREE.MeshLambertMaterial({ color: 0xbb2020 });
    const lowerGum = new THREE.Mesh(lowerGumGeo, gumMat);
    lowerGum.position.set(0, 0.08, -0.85);
    lowerJawGroup.add(lowerGum);

    // Lower teeth - big sharp
    const toothMat = new THREE.MeshLambertMaterial({ color: 0xe8e8dd });
    for (let i = -5; i <= 5; i++) {
        const h = 0.2 + Math.random() * 0.12;
        const toothGeo = new THREE.ConeGeometry(0.04, h, 4);
        const tooth = new THREE.Mesh(toothGeo, toothMat);
        tooth.position.set(i * 0.11, 0.08 + h / 2, -0.9);
        lowerJawGroup.add(tooth);
    }
    group.add(lowerJawGroup);

    // Red gums on upper jaw
    const upperGumGeo = new THREE.BoxGeometry(1.4, 0.06, 0.7);
    const upperGum = new THREE.Mesh(upperGumGeo, gumMat);
    upperGum.position.set(0, -0.12, -2.2);
    group.add(upperGum);

    // Upper teeth - big sharp, pointing down
    for (let i = -6; i <= 6; i++) {
        const h = 0.22 + Math.random() * 0.15;
        const toothGeo = new THREE.ConeGeometry(0.045, h, 4);
        const tooth = new THREE.Mesh(toothGeo, toothMat);
        tooth.position.set(i * 0.1, -0.12 - h / 2, -2.25);
        tooth.rotation.x = Math.PI;
        group.add(tooth);
    }

    // Mouth interior - dark red
    const mouthGeo = new THREE.BoxGeometry(1.1, 0.35, 0.5);
    const mouthMat = new THREE.MeshLambertMaterial({ color: 0x3a0808 });
    const mouth = new THREE.Mesh(mouthGeo, mouthMat);
    mouth.position.set(0, -0.18, -1.9);
    group.add(mouth);

    // --- BODY: long snake/eel-like segments, rounded ---
    const segmentCount = 8;
    for (let i = 0; i < segmentCount; i++) {
        const t = i / segmentCount;
        const radius = 0.7 * (1 - t * 0.55);
        const segGeo = new THREE.SphereGeometry(radius, 8, 6);
        const segMat = new THREE.MeshLambertMaterial({
            color: new THREE.Color(blueColor).lerp(new THREE.Color(bellyColor), t * 0.3),
        });
        const seg = new THREE.Mesh(segGeo, segMat);
        seg.scale.set(1, 0.7, 0.9);
        seg.position.set(0, -0.03 * i, i * 0.55);
        seg.name = `bodySegment${i}`;
        group.add(seg);
    }

    // --- TAIL: tapered end ---
    const tailGeo = new THREE.SphereGeometry(0.25, 6, 5);
    const tailMat = new THREE.MeshLambertMaterial({ color: darkBlue });
    const tail = new THREE.Mesh(tailGeo, tailMat);
    tail.scale.set(1, 0.6, 2);
    tail.position.set(0, -0.2, segmentCount * 0.55 + 0.3);
    tail.name = 'tail';
    group.add(tail);

    const tailFinGeo = new THREE.BoxGeometry(0.6, 0.04, 0.4);
    const tailFin = new THREE.Mesh(tailFinGeo, new THREE.MeshLambertMaterial({ color: blueColor }));
    tailFin.position.set(0, -0.15, segmentCount * 0.55 + 0.7);
    tailFin.name = 'tailFin';
    group.add(tailFin);

    return group;
}

class ElGranMaja {
    constructor(x, y, z) {
        this.type = 'maja';
        this.mesh = createMajaMesh();
        this.mesh.position.set(x, y, z);
        this.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * MAJA_SWIM_SPEED,
            0,
            (Math.random() - 0.5) * MAJA_SWIM_SPEED
        );
        this.time = Math.random() * Math.PI * 2;
        this.dirChangeTimer = 3 + Math.random() * 5;
        this.alive = true;
        this.huntTarget = null;
        this.jawOpen = 0; // 0=closed, 1=fully open
        this.eating = false;
        this.eatTimer = 0;
    }

    update(dt, world, cliones) {
        if (!this.alive) return;
        this.time += dt;

        // Eye glow pulsing
        for (let i = 0; i < 6; i++) {
            const glow = this.mesh.getObjectByName(`eyeGlow${i}`);
            if (glow) {
                glow.material.opacity = 0.2 + Math.sin(this.time * 3 + i) * 0.15;
            }
        }

        // Body wave - snake-like undulation
        for (let i = 0; i < 8; i++) {
            const seg = this.mesh.getObjectByName(`bodySegment${i}`);
            if (seg) {
                seg.position.x = Math.sin(this.time * 2 + i * 0.7) * 0.06 * i;
            }
        }
        const tail = this.mesh.getObjectByName('tail');
        if (tail) tail.position.x = Math.sin(this.time * 2 + 6) * 0.15;
        const tailFin = this.mesh.getObjectByName('tailFin');
        if (tailFin) tailFin.rotation.y = Math.sin(this.time * 2.5) * 0.3;

        // Jaw animation - rotate open/closed
        const lowerJaw = this.mesh.getObjectByName('lowerJaw');
        if (lowerJaw) {
            const targetJaw = this.eating ? 0.4 : (this.huntTarget ? 0.2 : 0);
            this.jawOpen += (targetJaw - this.jawOpen) * dt * 5;
            lowerJaw.rotation.x = this.jawOpen;
        }

        // --- HUNTING AI: find nearest clione ---
        this.huntTarget = null;
        let nearestDist = 15; // detection range
        const myPos = this.mesh.position;

        for (const c of cliones) {
            if (!c.alive) continue;
            const dx = c.mesh.position.x - myPos.x;
            const dy = c.mesh.position.y - myPos.y;
            const dz = c.mesh.position.z - myPos.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (dist < nearestDist) {
                nearestDist = dist;
                this.huntTarget = c;
            }
        }

        // Eating cooldown
        if (this.eating) {
            this.eatTimer -= dt;
            if (this.eatTimer <= 0) this.eating = false;
        }

        if (this.huntTarget && !this.eating) {
            // Chase clione
            const target = this.huntTarget.mesh.position;
            const dir = new THREE.Vector3(
                target.x - myPos.x,
                target.y - myPos.y,
                target.z - myPos.z
            );
            const dist = dir.length();
            if (dist > 0.1) dir.normalize();

            this.velocity.x += dir.x * MAJA_HUNT_SPEED * dt * 2;
            this.velocity.y += dir.y * MAJA_HUNT_SPEED * dt * 2;
            this.velocity.z += dir.z * MAJA_HUNT_SPEED * dt * 2;

            // Clamp speed
            const speed = this.velocity.length();
            if (speed > MAJA_HUNT_SPEED) {
                this.velocity.multiplyScalar(MAJA_HUNT_SPEED / speed);
            }

            // Eat clione if close enough
            if (dist < MAJA_EAT_RANGE) {
                this.huntTarget.alive = false;
                this.eating = true;
                this.eatTimer = 1.5;
            }
        } else if (!this.eating) {
            // Idle swimming
            this.dirChangeTimer -= dt;
            if (this.dirChangeTimer <= 0) {
                this.velocity.x = (Math.random() - 0.5) * MAJA_SWIM_SPEED;
                this.velocity.z = (Math.random() - 0.5) * MAJA_SWIM_SPEED;
                this.velocity.y = (Math.random() - 0.5) * 0.2;
                this.dirChangeTimer = 3 + Math.random() * 5;
            }
        }

        // Move
        myPos.x += this.velocity.x * dt;
        myPos.y += this.velocity.y * dt;
        myPos.z += this.velocity.z * dt;

        // Gentle bob
        myPos.y += Math.sin(this.time * 0.8) * 0.01 * dt;

        // Face movement direction
        if (Math.abs(this.velocity.x) > 0.01 || Math.abs(this.velocity.z) > 0.01) {
            const targetYaw = Math.atan2(this.velocity.x, this.velocity.z) + Math.PI;
            // Smooth rotation
            let diff = targetYaw - this.mesh.rotation.y;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            this.mesh.rotation.y += diff * dt * 2;
        }

        // Stay in water
        this._stayInWater(world);
    }

    _stayInWater(world) {
        const pos = this.mesh.position;
        const bx = Math.floor(pos.x + 0.5), by = Math.floor(pos.y + 0.5), bz = Math.floor(pos.z + 0.5);
        if (world.getBlock(bx, by, bz) !== BlockType.WATER) {
            if (world.getBlock(bx, by + 1, bz) === BlockType.WATER) {
                this.velocity.y = 0.4;
            } else if (world.getBlock(bx, by - 1, bz) === BlockType.WATER) {
                this.velocity.y = -0.4;
            } else {
                this.velocity.x *= -1;
                this.velocity.z *= -1;
            }
        }
        if (pos.y < 1) { pos.y = 1; this.velocity.y = Math.abs(this.velocity.y); }
    }
}

// ============================================================
// Entity Manager
// ============================================================

export class EntityManager {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        this.entities = [];
        this.spawnCheckTimer = 0;
        this.maxCliones = 30;
    }

    spawnClione(x, y, z) {
        const clione = new Clione(x, y, z);
        this.entities.push(clione);
        this.scene.add(clione.mesh);
        return clione;
    }

    spawnMaja(x, y, z) {
        const maja = new ElGranMaja(x, y, z);
        this.entities.push(maja);
        this.scene.add(maja.mesh);
        return maja;
    }

    tryNaturalSpawn(playerX, playerZ) {
        const clionesCount = this.entities.filter(e => e.type === 'clione' && e.alive).length;
        if (clionesCount >= this.maxCliones) return;

        const angle = Math.random() * Math.PI * 2;
        const dist = 20 + Math.random() * 20;
        const sx = Math.floor(playerX + Math.cos(angle) * dist);
        const sz = Math.floor(playerZ + Math.sin(angle) * dist);

        for (let y = 10; y <= 20; y++) {
            if (this.world.getBlock(sx, y, sz) === BlockType.WATER) {
                this.spawnClione(sx, y, sz);
                return;
            }
        }
    }

    update(dt, playerX, playerZ) {
        this.spawnCheckTimer -= dt;
        if (this.spawnCheckTimer <= 0) {
            this.tryNaturalSpawn(playerX, playerZ);
            this.spawnCheckTimer = 3;
        }

        // Get list of alive cliones for Maja hunting
        const cliones = this.entities.filter(e => e.type === 'clione' && e.alive);

        for (let i = this.entities.length - 1; i >= 0; i--) {
            const entity = this.entities[i];

            if (!entity.alive) {
                this.scene.remove(entity.mesh);
                this.entities.splice(i, 1);
                continue;
            }

            if (entity.type === 'maja') {
                entity.update(dt, this.world, cliones);
            } else {
                entity.update(dt, this.world);
            }

            // Remove if too far from player
            const dx = entity.mesh.position.x - playerX;
            const dz = entity.mesh.position.z - playerZ;
            const maxDist = entity.type === 'maja' ? 120 : 80;
            if (dx * dx + dz * dz > maxDist * maxDist) {
                this.scene.remove(entity.mesh);
                this.entities.splice(i, 1);
            }
        }
    }
}
