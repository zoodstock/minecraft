import * as THREE from 'three';
import { BlockType } from './blocks.js';

// ============================================================
// Taming constants
// ============================================================
const TAME_RANGE = 9;
const TAME_TIME = 3;
const FOLLOW_DIST = 15;
const FOLLOW_SPEED_MULT = 1.0; // match player speed

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
        this.tamed = false;
        this.nearPlayerTime = 0;
        this.attackTarget = null;
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
        eye.position.set(xPos, 0.12, -2.7);
        eye.name = `eye${i}`;
        group.add(eye);

        const glowGeo = new THREE.SphereGeometry(0.12, 6, 6);
        const glow = new THREE.Mesh(glowGeo, eyeGlowMat.clone());
        glow.position.set(xPos, 0.12, -2.7);
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
    upperJaw.position.set(0, -0.2, -2.2);
    group.add(upperJaw);

    // Lower jaw (opens via y position, no rotation)
    const lowerJawGroup = new THREE.Group();
    lowerJawGroup.name = 'lowerJaw';
    lowerJawGroup.position.set(0, -0.5, -2.15);

    const lowerJawGeo = new THREE.BoxGeometry(1.4, 0.2, 0.7);
    const lowerJawMat = new THREE.MeshLambertMaterial({ color: darkBlue });
    const lowerJawMesh = new THREE.Mesh(lowerJawGeo, lowerJawMat);
    lowerJawGroup.add(lowerJawMesh);

    // Red gums on lower jaw
    const gumMat = new THREE.MeshLambertMaterial({ color: 0xbb2020 });
    const lowerGumGeo = new THREE.BoxGeometry(1.3, 0.06, 0.65);
    const lowerGum = new THREE.Mesh(lowerGumGeo, gumMat);
    lowerGum.position.set(0, 0.1, 0);
    lowerJawGroup.add(lowerGum);

    // Lower teeth - big sharp
    const toothMat = new THREE.MeshLambertMaterial({ color: 0xe8e8dd });
    for (let i = -5; i <= 5; i++) {
        const h = 0.2 + Math.random() * 0.12;
        const toothGeo = new THREE.ConeGeometry(0.04, h, 4);
        const tooth = new THREE.Mesh(toothGeo, toothMat);
        tooth.position.set(i * 0.11, 0.1 + h / 2, -0.05);
        lowerJawGroup.add(tooth);
    }
    group.add(lowerJawGroup);

    // Red gums on upper jaw
    const upperGumGeo = new THREE.BoxGeometry(1.4, 0.06, 0.7);
    const upperGum = new THREE.Mesh(upperGumGeo, gumMat);
    upperGum.position.set(0, -0.27, -2.2);
    group.add(upperGum);

    // Upper teeth - big sharp, pointing down
    for (let i = -6; i <= 6; i++) {
        const h = 0.22 + Math.random() * 0.15;
        const toothGeo = new THREE.ConeGeometry(0.045, h, 4);
        const tooth = new THREE.Mesh(toothGeo, toothMat);
        tooth.position.set(i * 0.1, -0.27 - h / 2, -2.25);
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
        this.jawOpen = 0;
        this.eating = false;
        this.eatTimer = 0;
        this.tamed = false;
        this.nearPlayerTime = 0;
        this.attackTarget = null;
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

        // Jaw animation - move down to open
        const lowerJaw = this.mesh.getObjectByName('lowerJaw');
        if (lowerJaw) {
            const targetJaw = this.eating ? 0.35 : (this.huntTarget ? 0.15 : 0);
            this.jawOpen += (targetJaw - this.jawOpen) * dt * 3;
            lowerJaw.position.y = -0.5 - this.jawOpen;
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
// Bloop - giant pale sea creature
// Huge gaping mouth, light gray/beige body, small eyes
// Natural spawn only. Hunts Cliones. Fights El Gran Maja (loses after 5s).
// ============================================================

const BLOOP_SWIM_SPEED = 0.5;
const BLOOP_HUNT_SPEED = 1.6;
const BLOOP_CHARGE_SPEED = 3.5;
const BLOOP_EAT_RANGE = 1.5;
const BLOOP_FIGHT_RANGE = 15;
const BLOOP_FIGHT_DURATION = 5;

function createBloopMesh() {
    const group = new THREE.Group();
    const olive = 0x8a8a50;       // main body olive/khaki
    const darkOlive = 0x707040;   // darker shade
    const belly = 0xa0a070;       // lighter underside
    const mouthRed = 0xaa3020;    // red mouth interior

    // All BoxGeometry for voxel/blocky Minecraft style

    // --- HEAD: big blocky snout ---
    const headGeo = new THREE.BoxGeometry(1.6, 1.0, 1.8);
    const headMat = new THREE.MeshLambertMaterial({ color: olive });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0, 0.1, -1.8);
    group.add(head);

    // Snout top (slightly narrower front block)
    const snoutGeo = new THREE.BoxGeometry(1.4, 0.5, 0.8);
    const snoutMat = new THREE.MeshLambertMaterial({ color: olive });
    const snout = new THREE.Mesh(snoutGeo, snoutMat);
    snout.position.set(0, 0.3, -2.9);
    group.add(snout);

    // --- EYES: 2 small dark blocky eyes ---
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x101010 });
    const eyeGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.5, 0.5, -2.6);
    group.add(eyeL);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.5, 0.5, -2.6);
    group.add(eyeR);

    // --- UPPER JAW ---
    const upperJawGeo = new THREE.BoxGeometry(1.5, 0.3, 1.0);
    const upperJawMat = new THREE.MeshLambertMaterial({ color: olive });
    const upperJaw = new THREE.Mesh(upperJawGeo, upperJawMat);
    upperJaw.position.set(0, -0.15, -2.8);
    group.add(upperJaw);

    // Upper gum (red/pink strip)
    const gumMat = new THREE.MeshLambertMaterial({ color: mouthRed });
    const upperGum = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 0.9), gumMat);
    upperGum.position.set(0, -0.35, -2.8);
    group.add(upperGum);

    // Upper teeth - blocky rectangles
    const toothMat = new THREE.MeshLambertMaterial({ color: 0xe8e0c8 });
    for (let i = -4; i <= 4; i++) {
        const h = 0.18 + Math.random() * 0.08;
        const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.1, h, 0.08), toothMat);
        tooth.position.set(i * 0.14, -0.35 - h / 2, -3.15);
        group.add(tooth);
    }

    // --- LOWER JAW (movable) ---
    const lowerJawGroup = new THREE.Group();
    lowerJawGroup.name = 'lowerJaw';
    lowerJawGroup.position.set(0, -0.55, -2.6);

    const lowerJawGeo = new THREE.BoxGeometry(1.4, 0.25, 1.0);
    const lowerJawMat = new THREE.MeshLambertMaterial({ color: belly });
    lowerJawGroup.add(new THREE.Mesh(lowerJawGeo, lowerJawMat));

    // Lower gum
    const lowerGum = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.9), gumMat);
    lowerGum.position.set(0, 0.15, 0);
    lowerJawGroup.add(lowerGum);

    // Lower teeth - blocky
    for (let i = -4; i <= 4; i++) {
        const h = 0.15 + Math.random() * 0.06;
        const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.09, h, 0.07), toothMat);
        tooth.position.set(i * 0.14, 0.15 + h / 2, -0.3);
        lowerJawGroup.add(tooth);
    }
    group.add(lowerJawGroup);

    // --- MOUTH INTERIOR: deep red ---
    const mouthInner = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.5, 0.8),
        new THREE.MeshLambertMaterial({ color: mouthRed })
    );
    mouthInner.position.set(0, -0.35, -2.5);
    group.add(mouthInner);

    // --- BODY: blocky segments, getting narrower ---
    const segCount = 6;
    for (let i = 0; i < segCount; i++) {
        const t = i / segCount;
        const w = 1.5 * (1 - t * 0.5);
        const h = 1.0 * (1 - t * 0.4);
        const seg = new THREE.Mesh(
            new THREE.BoxGeometry(w, h, 0.7),
            new THREE.MeshLambertMaterial({
                color: new THREE.Color(olive).lerp(new THREE.Color(darkOlive), t * 0.5),
            })
        );
        seg.position.set(0, -0.02 * i, i * 0.65);
        seg.name = `bodySegment${i}`;
        group.add(seg);
    }

    // Belly (lighter underside strip)
    for (let i = 0; i < 4; i++) {
        const bw = 0.7 * (1 - i * 0.12);
        const bellyBlock = new THREE.Mesh(
            new THREE.BoxGeometry(bw, 0.08, 0.6),
            new THREE.MeshLambertMaterial({ color: belly })
        );
        bellyBlock.position.set(0, -0.45 - i * 0.02, i * 0.65);
        group.add(bellyBlock);
    }

    // --- FINS: blocky side fins ---
    const finMat = new THREE.MeshLambertMaterial({ color: darkOlive });
    // Left pectoral fin
    const finL = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 0.5), finMat);
    finL.position.set(-0.9, -0.3, -0.5);
    finL.rotation.z = -0.3;
    finL.name = 'finL';
    group.add(finL);
    // Right pectoral fin
    const finR = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 0.5), finMat);
    finR.position.set(0.9, -0.3, -0.5);
    finR.rotation.z = 0.3;
    finR.name = 'finR';
    group.add(finR);

    // Dorsal fin (top)
    const dorsalFin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.6), finMat);
    dorsalFin.position.set(0, 0.6, -0.3);
    group.add(dorsalFin);

    // --- TAIL: blocky v-shape ---
    const tailBase = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 0.6), finMat);
    tailBase.position.set(0, -0.1, segCount * 0.65 + 0.2);
    tailBase.name = 'tail';
    group.add(tailBase);

    const tailFinUp = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.4), finMat);
    tailFinUp.position.set(0, 0.2, segCount * 0.65 + 0.5);
    tailFinUp.rotation.x = -0.3;
    tailFinUp.name = 'tailFin';
    group.add(tailFinUp);

    const tailFinDown = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.35), finMat);
    tailFinDown.position.set(0, -0.35, segCount * 0.65 + 0.5);
    tailFinDown.rotation.x = 0.3;
    group.add(tailFinDown);

    return group;
}

class Bloop {
    constructor(x, y, z) {
        this.type = 'bloop';
        this.mesh = createBloopMesh();
        this.mesh.position.set(x, y, z);
        this.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * BLOOP_SWIM_SPEED,
            0,
            (Math.random() - 0.5) * BLOOP_SWIM_SPEED
        );
        this.time = Math.random() * Math.PI * 2;
        this.dirChangeTimer = 3 + Math.random() * 4;
        this.alive = true;
        this.huntTarget = null;
        this.jawOpen = 0;
        this.eating = false;
        this.eatTimer = 0;

        // Fighting state
        this.fightTarget = null;
        this.fighting = false;
        this.fightTimer = 0;
        this.tamed = false;
        this.nearPlayerTime = 0;
        this.attackTarget = null;
    }

    update(dt, world, cliones, majas) {
        if (!this.alive) return;
        this.time += dt;

        // Body wave
        for (let i = 0; i < 7; i++) {
            const seg = this.mesh.getObjectByName(`bodySegment${i}`);
            if (seg) seg.position.x = Math.sin(this.time * 1.5 + i * 0.6) * 0.05 * i;
        }
        const tail = this.mesh.getObjectByName('tail');
        if (tail) tail.position.x = Math.sin(this.time * 1.8 + 5) * 0.12;

        // Jaw
        const lowerJaw = this.mesh.getObjectByName('lowerJaw');
        if (lowerJaw) {
            const targetJaw = this.eating || this.fighting ? 0.35 : (this.huntTarget ? 0.12 : 0);
            this.jawOpen += (targetJaw - this.jawOpen) * dt * 3;
            lowerJaw.position.y = -0.45 - this.jawOpen;
        }

        const myPos = this.mesh.position;

        // --- FIGHTING: check for nearby El Gran Maja ---
        if (this.fighting) {
            this.fightTimer -= dt;
            if (this.fightTarget && this.fightTarget.alive) {
                // Rush toward Maja
                const target = this.fightTarget.mesh.position;
                const dir = new THREE.Vector3(target.x - myPos.x, target.y - myPos.y, target.z - myPos.z);
                const dist = dir.length();
                if (dist > 0.5) {
                    dir.normalize();
                    this.velocity.set(dir.x * BLOOP_CHARGE_SPEED, dir.y * BLOOP_CHARGE_SPEED * 0.5, dir.z * BLOOP_CHARGE_SPEED);
                } else {
                    this.velocity.set(0, 0, 0);
                }
            }
            if (this.fightTimer <= 0) {
                // Bloop loses the fight and dies
                this.alive = false;
                return;
            }
        } else {
            // Check for nearby Majas to fight
            for (const maja of majas) {
                if (!maja.alive) continue;
                const dx = maja.mesh.position.x - myPos.x;
                const dy = maja.mesh.position.y - myPos.y;
                const dz = maja.mesh.position.z - myPos.z;
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                if (dist < BLOOP_FIGHT_RANGE) {
                    this.fighting = true;
                    this.fightTarget = maja;
                    this.fightTimer = BLOOP_FIGHT_DURATION;
                    break;
                }
            }
        }

        // --- HUNTING CLIONES (when not fighting) ---
        if (!this.fighting) {
            if (this.eating) {
                this.eatTimer -= dt;
                if (this.eatTimer <= 0) this.eating = false;
            }

            this.huntTarget = null;
            let nearestDist = 15;
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

            if (this.huntTarget && !this.eating) {
                const target = this.huntTarget.mesh.position;
                const dir = new THREE.Vector3(target.x - myPos.x, target.y - myPos.y, target.z - myPos.z);
                const dist = dir.length();
                if (dist > 0.1) dir.normalize();
                this.velocity.x += dir.x * BLOOP_HUNT_SPEED * dt * 2;
                this.velocity.y += dir.y * BLOOP_HUNT_SPEED * dt * 2;
                this.velocity.z += dir.z * BLOOP_HUNT_SPEED * dt * 2;
                const speed = this.velocity.length();
                if (speed > BLOOP_HUNT_SPEED) this.velocity.multiplyScalar(BLOOP_HUNT_SPEED / speed);

                if (dist < BLOOP_EAT_RANGE) {
                    this.huntTarget.alive = false;
                    this.eating = true;
                    this.eatTimer = 1.5;
                }
            } else if (!this.eating) {
                this.dirChangeTimer -= dt;
                if (this.dirChangeTimer <= 0) {
                    this.velocity.x = (Math.random() - 0.5) * BLOOP_SWIM_SPEED;
                    this.velocity.z = (Math.random() - 0.5) * BLOOP_SWIM_SPEED;
                    this.velocity.y = (Math.random() - 0.5) * 0.2;
                    this.dirChangeTimer = 3 + Math.random() * 4;
                }
            }
        }

        // Move
        myPos.x += this.velocity.x * dt;
        myPos.y += this.velocity.y * dt;
        myPos.z += this.velocity.z * dt;
        myPos.y += Math.sin(this.time * 0.7) * 0.01 * dt;

        // Face direction
        if (Math.abs(this.velocity.x) > 0.01 || Math.abs(this.velocity.z) > 0.01) {
            const targetYaw = Math.atan2(this.velocity.x, this.velocity.z) + Math.PI;
            let diff = targetYaw - this.mesh.rotation.y;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            this.mesh.rotation.y += diff * dt * 2;
        }

        this._stayInWater(world);
    }

    _stayInWater(world) {
        const pos = this.mesh.position;
        const bx = Math.floor(pos.x + 0.5), by = Math.floor(pos.y + 0.5), bz = Math.floor(pos.z + 0.5);
        if (world.getBlock(bx, by, bz) !== BlockType.WATER) {
            if (world.getBlock(bx, by + 1, bz) === BlockType.WATER) this.velocity.y = 0.4;
            else if (world.getBlock(bx, by - 1, bz) === BlockType.WATER) this.velocity.y = -0.4;
            else { this.velocity.x *= -1; this.velocity.z *= -1; }
        }
        if (pos.y < 1) { pos.y = 1; this.velocity.y = Math.abs(this.velocity.y); }
    }
}

// ============================================================
// Meowl - flying cat-owl hybrid
// Cat head with big round eyes, owl body with wings
// Flies in the sky, natural spawn only. Peaceful.
// ============================================================

const MEOWL_FLY_SPEED = 1.2;
const MEOWL_WING_SPEED = 4;

function createMeowlMesh() {
    const group = new THREE.Group();
    const tabbyBrown = 0x8b7355;
    const tabbyDark = 0x6b5535;
    const white = 0xf0ece0;
    const pinkNose = 0xeea0a0;

    // --- HEAD: cat-shaped, blocky ---
    const headGeo = new THREE.BoxGeometry(0.7, 0.65, 0.6);
    const headMat = new THREE.MeshLambertMaterial({ color: tabbyBrown });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0, 0.55, -0.3);
    group.add(head);

    // White face patch (lower face)
    const facePatch = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.35, 0.05),
        new THREE.MeshLambertMaterial({ color: white })
    );
    facePatch.position.set(0, 0.45, -0.63);
    group.add(facePatch);

    // Cat ears - two triangular blocks
    const earMat = new THREE.MeshLambertMaterial({ color: tabbyBrown });
    const earInnerMat = new THREE.MeshLambertMaterial({ color: pinkNose });

    const earL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.25, 0.15), earMat);
    earL.position.set(-0.22, 0.95, -0.3);
    earL.rotation.z = 0.15;
    group.add(earL);
    const earLInner = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.05), earInnerMat);
    earLInner.position.set(-0.22, 0.93, -0.38);
    group.add(earLInner);

    const earR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.25, 0.15), earMat);
    earR.position.set(0.22, 0.95, -0.3);
    earR.rotation.z = -0.15;
    group.add(earR);
    const earRInner = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.05), earInnerMat);
    earRInner.position.set(0.22, 0.93, -0.38);
    group.add(earRInner);

    // Big round cat eyes (large, cute)
    const eyeWhiteMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const eyePupilMat = new THREE.MeshBasicMaterial({ color: 0x101010 });

    // Left eye
    const eyeWhiteL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.05), eyeWhiteMat);
    eyeWhiteL.position.set(-0.15, 0.58, -0.63);
    group.add(eyeWhiteL);
    const pupilL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.06), eyePupilMat);
    pupilL.position.set(-0.15, 0.57, -0.65);
    group.add(pupilL);

    // Right eye
    const eyeWhiteR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.05), eyeWhiteMat);
    eyeWhiteR.position.set(0.15, 0.58, -0.63);
    group.add(eyeWhiteR);
    const pupilR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.06), eyePupilMat);
    pupilR.position.set(0.15, 0.57, -0.65);
    group.add(pupilR);

    // Pink nose
    const nose = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.06, 0.06),
        new THREE.MeshLambertMaterial({ color: pinkNose })
    );
    nose.position.set(0, 0.44, -0.65);
    group.add(nose);

    // Whisker marks (dark lines on cheeks)
    const whiskerMat = new THREE.MeshLambertMaterial({ color: tabbyDark });
    for (const side of [-1, 1]) {
        for (let j = 0; j < 2; j++) {
            const w = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.02, 0.02), whiskerMat);
            w.position.set(side * 0.28, 0.42 - j * 0.06, -0.55);
            group.add(w);
        }
    }

    // Tabby stripes on forehead
    for (let i = 0; i < 3; i++) {
        const stripe = new THREE.Mesh(
            new THREE.BoxGeometry(0.35 - i * 0.08, 0.04, 0.05),
            new THREE.MeshLambertMaterial({ color: tabbyDark })
        );
        stripe.position.set(0, 0.72 + i * 0.07, -0.63);
        group.add(stripe);
    }

    // --- BODY: owl-shaped, round and plump ---
    const bodyGeo = new THREE.BoxGeometry(0.8, 0.7, 0.9);
    const bodyMat = new THREE.MeshLambertMaterial({ color: tabbyBrown });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(0, 0.05, 0.15);
    group.add(body);

    // White chest (owl breast)
    const chest = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.55, 0.05),
        new THREE.MeshLambertMaterial({ color: white })
    );
    chest.position.set(0, 0.05, -0.3);
    group.add(chest);

    // Brown/tan feather pattern on chest
    const featherMat = new THREE.MeshLambertMaterial({ color: 0xc0a878 });
    for (let i = 0; i < 3; i++) {
        const feather = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.04, 0.06), featherMat);
        feather.position.set(0, -0.05 + i * 0.12, -0.28);
        group.add(feather);
    }

    // --- WINGS: owl wings, flap up/down ---
    const wingMat = new THREE.MeshLambertMaterial({ color: tabbyBrown });
    const wingTipMat = new THREE.MeshLambertMaterial({ color: tabbyDark });

    // Left wing
    const wingLGroup = new THREE.Group();
    wingLGroup.name = 'wingL';
    wingLGroup.position.set(-0.4, 0.15, 0.15);
    const wingLMain = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.7), wingMat);
    wingLMain.position.set(-0.3, 0, 0);
    wingLGroup.add(wingLMain);
    const wingLTip = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.06, 0.5), wingTipMat);
    wingLTip.position.set(-0.55, 0, 0.05);
    wingLGroup.add(wingLTip);
    group.add(wingLGroup);

    // Right wing
    const wingRGroup = new THREE.Group();
    wingRGroup.name = 'wingR';
    wingRGroup.position.set(0.4, 0.15, 0.15);
    const wingRMain = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.7), wingMat);
    wingRMain.position.set(0.3, 0, 0);
    wingRGroup.add(wingRMain);
    const wingRTip = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.06, 0.5), wingTipMat);
    wingRTip.position.set(0.55, 0, 0.05);
    wingRGroup.add(wingRTip);
    group.add(wingRGroup);

    // --- TAIL: short owl tail feathers ---
    const tailGeo = new THREE.BoxGeometry(0.35, 0.06, 0.3);
    const tailMesh = new THREE.Mesh(tailGeo, new THREE.MeshLambertMaterial({ color: tabbyDark }));
    tailMesh.position.set(0, -0.05, 0.65);
    tailMesh.name = 'tail';
    group.add(tailMesh);

    // --- FEET: small owl talons ---
    const footMat = new THREE.MeshLambertMaterial({ color: 0xd4a050 });
    const footL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.15), footMat);
    footL.position.set(-0.15, -0.35, 0.1);
    group.add(footL);
    const footR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.15), footMat);
    footR.position.set(0.15, -0.35, 0.1);
    group.add(footR);

    return group;
}

class Meowl {
    constructor(x, y, z) {
        this.type = 'meowl';
        this.mesh = createMeowlMesh();
        this.mesh.position.set(x, y, z);
        this.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * MEOWL_FLY_SPEED,
            0,
            (Math.random() - 0.5) * MEOWL_FLY_SPEED
        );
        this.time = Math.random() * Math.PI * 2;
        this.dirChangeTimer = 3 + Math.random() * 5;
        this.alive = true;
        this.tamed = false;
        this.nearPlayerTime = 0;
        this.attackTarget = null;
    }

    update(dt) {
        if (!this.alive) return;
        this.time += dt;

        // Wing flapping
        const wingL = this.mesh.getObjectByName('wingL');
        const wingR = this.mesh.getObjectByName('wingR');
        if (wingL && wingR) {
            const flap = Math.sin(this.time * MEOWL_WING_SPEED) * 0.6;
            wingL.rotation.z = flap;
            wingR.rotation.z = -flap;
        }

        // Gentle bob up/down
        this.mesh.position.y += Math.sin(this.time * 1.5) * 0.015 * dt;

        // Tail sway
        const tail = this.mesh.getObjectByName('tail');
        if (tail) tail.rotation.y = Math.sin(this.time * 2) * 0.2;

        // Change direction
        this.dirChangeTimer -= dt;
        if (this.dirChangeTimer <= 0) {
            this.velocity.x = (Math.random() - 0.5) * MEOWL_FLY_SPEED;
            this.velocity.z = (Math.random() - 0.5) * MEOWL_FLY_SPEED;
            this.velocity.y = (Math.random() - 0.5) * 0.3;
            this.dirChangeTimer = 3 + Math.random() * 5;
        }

        // Move
        const pos = this.mesh.position;
        pos.x += this.velocity.x * dt;
        pos.y += this.velocity.y * dt;
        pos.z += this.velocity.z * dt;

        // Stay in sky (between y 30-55)
        if (pos.y < 30) { pos.y = 30; this.velocity.y = Math.abs(this.velocity.y) + 0.2; }
        if (pos.y > 55) { pos.y = 55; this.velocity.y = -Math.abs(this.velocity.y) - 0.2; }

        // Face movement direction
        if (Math.abs(this.velocity.x) > 0.01 || Math.abs(this.velocity.z) > 0.01) {
            const targetYaw = Math.atan2(this.velocity.x, this.velocity.z) + Math.PI;
            let diff = targetYaw - this.mesh.rotation.y;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            this.mesh.rotation.y += diff * dt * 3;
        }

        // Slight tilt when turning
        this.mesh.rotation.z = -this.velocity.x * 0.15;
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
        this.bloopSpawnTimer = 0;
        this.meowlSpawnTimer = 0;
        this.maxCliones = 15;
        this.maxBloops = 2;
        this.maxMeowls = 3;
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

    spawnBloop(x, y, z) {
        const bloop = new Bloop(x, y, z);
        this.entities.push(bloop);
        this.scene.add(bloop.mesh);
        return bloop;
    }

    tryNaturalSpawnClione(playerX, playerZ) {
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

    tryNaturalSpawnBloop(playerX, playerZ) {
        const bloopCount = this.entities.filter(e => e.type === 'bloop' && e.alive).length;
        if (bloopCount >= this.maxBloops) return;

        const angle = Math.random() * Math.PI * 2;
        const dist = 30 + Math.random() * 25;
        const sx = Math.floor(playerX + Math.cos(angle) * dist);
        const sz = Math.floor(playerZ + Math.sin(angle) * dist);

        for (let y = 8; y <= 18; y++) {
            if (this.world.getBlock(sx, y, sz) === BlockType.WATER) {
                this.spawnBloop(sx, y, sz);
                return;
            }
        }
    }

    tryNaturalSpawnMeowl(playerX, playerZ) {
        const meowlCount = this.entities.filter(e => e.type === 'meowl' && e.alive).length;
        if (meowlCount >= this.maxMeowls) return;

        const angle = Math.random() * Math.PI * 2;
        const dist = 25 + Math.random() * 30;
        const sx = playerX + Math.cos(angle) * dist;
        const sz = playerZ + Math.sin(angle) * dist;
        const sy = 35 + Math.random() * 15; // sky height

        const meowl = new Meowl(sx, sy, sz);
        this.entities.push(meowl);
        this.scene.add(meowl.mesh);
    }

    // Set attack target for all tamed mobs
    commandAttack(target) {
        for (const e of this.entities) {
            if (e.tamed && e.alive && e !== target) {
                e.attackTarget = target;
            }
        }
    }

    // Find entity closest to a world position (for targeting)
    findEntityAt(position, maxDist = 3) {
        let closest = null, closestDist = maxDist;
        for (const e of this.entities) {
            if (!e.alive) continue;
            const dx = e.mesh.position.x - position.x;
            const dy = e.mesh.position.y - position.y;
            const dz = e.mesh.position.z - position.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (dist < closestDist) {
                closestDist = dist;
                closest = e;
            }
        }
        return closest;
    }

    update(dt, playerX, playerY, playerZ) {
        // Spawning
        this.spawnCheckTimer -= dt;
        if (this.spawnCheckTimer <= 0) {
            this.tryNaturalSpawnClione(playerX, playerZ);
            this.spawnCheckTimer = 5;
        }
        this.meowlSpawnTimer -= dt;
        if (this.meowlSpawnTimer <= 0) {
            this.tryNaturalSpawnMeowl(playerX, playerZ);
            this.meowlSpawnTimer = 12 + Math.random() * 10;
        }
        this.bloopSpawnTimer -= dt;
        if (this.bloopSpawnTimer <= 0) {
            this.tryNaturalSpawnBloop(playerX, playerZ);
            this.bloopSpawnTimer = 15 + Math.random() * 15;
        }

        // Build helper lists without .filter() - reuse arrays
        const cliones = [];
        const majas = [];
        for (let i = 0; i < this.entities.length; i++) {
            const e = this.entities[i];
            if (!e.alive || e.tamed) continue;
            if (e.type === 'clione') cliones.push(e);
            else if (e.type === 'maja') majas.push(e);
        }

        // Clean dead entities first
        let writeIdx = 0;
        for (let i = 0; i < this.entities.length; i++) {
            const entity = this.entities[i];
            if (!entity.alive) {
                this.scene.remove(entity.mesh);
                continue;
            }
            this.entities[writeIdx++] = entity;
        }
        this.entities.length = writeIdx;

        // Clear stale attack targets
        for (let i = 0; i < this.entities.length; i++) {
            const e = this.entities[i];
            if (e.attackTarget && !e.attackTarget.alive) e.attackTarget = null;
        }

        // Update all entities
        for (let i = this.entities.length - 1; i >= 0; i--) {
            const entity = this.entities[i];
            const dx = entity.mesh.position.x - playerX;
            const dy = entity.mesh.position.y - playerY;
            const dz = entity.mesh.position.z - playerZ;
            const distSq = dx * dx + dy * dy + dz * dz;
            const distToPlayer = Math.sqrt(distSq);

            // Taming
            if (!entity.tamed) {
                if (distToPlayer <= TAME_RANGE) {
                    entity.nearPlayerTime += dt;
                    if (entity.nearPlayerTime >= TAME_TIME) {
                        entity.tamed = true;
                        entity.nearPlayerTime = 0;
                        this._addTameIndicator(entity);
                    }
                } else {
                    entity.nearPlayerTime = Math.max(0, entity.nearPlayerTime - dt);
                }
            }

            // Tamed behavior
            if (entity.tamed) {
                if (entity.attackTarget && (entity.attackTarget.tamed || !entity.attackTarget.alive)) {
                    entity.attackTarget = null;
                }
                if (entity.attackTarget && entity.attackTarget.alive) {
                    const t = entity.attackTarget.mesh.position;
                    const tdx = t.x - entity.mesh.position.x;
                    const tdy = t.y - entity.mesh.position.y;
                    const tdz = t.z - entity.mesh.position.z;
                    const tDist = Math.sqrt(tdx * tdx + tdy * tdy + tdz * tdz);
                    if (tDist > 1.5) {
                        const s = 5.0 / tDist;
                        entity.velocity.set(tdx * s, tdy * s, tdz * s);
                    } else {
                        entity.attackTarget.alive = false;
                        entity.attackTarget = null;
                    }
                } else if (distToPlayer > FOLLOW_DIST) {
                    const s = 5.0 / distToPlayer;
                    entity.velocity.set(-dx * s, -dy * s, -dz * s);
                }
            }

            // Movement
            if (entity.tamed && (entity.attackTarget || distToPlayer > FOLLOW_DIST)) {
                entity.mesh.position.x += entity.velocity.x * dt;
                entity.mesh.position.y += entity.velocity.y * dt;
                entity.mesh.position.z += entity.velocity.z * dt;
                if (Math.abs(entity.velocity.x) > 0.01 || Math.abs(entity.velocity.z) > 0.01) {
                    const targetYaw = Math.atan2(entity.velocity.x, entity.velocity.z) + Math.PI;
                    let diff = targetYaw - entity.mesh.rotation.y;
                    if (diff > Math.PI) diff -= Math.PI * 2;
                    if (diff < -Math.PI) diff += Math.PI * 2;
                    entity.mesh.rotation.y += diff * dt * 3;
                }
            } else {
                if (entity.type === 'maja' && !entity.tamed) entity.update(dt, this.world, cliones);
                else if (entity.type === 'bloop' && !entity.tamed) entity.update(dt, this.world, cliones, majas);
                else if (entity.type === 'meowl') entity.update(dt);
                else entity.update(dt, this.world);
            }

            // Despawn (not tamed)
            if (!entity.tamed) {
                const hDistSq = dx * dx + dz * dz;
                const maxD = (entity.type === 'maja' || entity.type === 'bloop') ? 100 : 60;
                if (hDistSq > maxD * maxD) {
                    this.scene.remove(entity.mesh);
                    this.entities[i] = this.entities[this.entities.length - 1];
                    this.entities.pop();
                }
            }
        }
    }

    _addTameIndicator(entity) {
        // Add a small green diamond above the entity to show it's tamed
        const indicator = new THREE.Mesh(
            new THREE.BoxGeometry(0.15, 0.15, 0.15),
            new THREE.MeshBasicMaterial({ color: 0x00ff44 })
        );
        indicator.position.set(0, 1.2, 0);
        indicator.rotation.set(Math.PI / 4, Math.PI / 4, 0);
        indicator.name = 'tameIndicator';
        entity.mesh.add(indicator);
    }
}
