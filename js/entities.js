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
// Wither - summoned by placing Black Skull on Soul Dirt
// Size scales with connected Soul Dirt blocks. Flies, hostile to all mobs.
// ============================================================

function createWitherMesh(scale) {
    const group = new THREE.Group();
    const dark = 0x1a1a1a;
    const bone = 0x2a2a2a;
    const eye = 0xccff00;
    const s = scale;

    // Center head
    const headGeo = new THREE.BoxGeometry(0.6 * s, 0.6 * s, 0.6 * s);
    const headMat = new THREE.MeshLambertMaterial({ color: dark });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0, 0.5 * s, 0);
    group.add(head);

    // Center eyes (glowing yellow)
    const eyeMat = new THREE.MeshBasicMaterial({ color: eye });
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.12 * s, 0.1 * s, 0.05 * s), eyeMat);
    eyeL.position.set(-0.15 * s, 0.55 * s, -0.32 * s);
    group.add(eyeL);
    const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.12 * s, 0.1 * s, 0.05 * s), eyeMat);
    eyeR.position.set(0.15 * s, 0.55 * s, -0.32 * s);
    group.add(eyeR);
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.2 * s, 0.06 * s, 0.05 * s), eyeMat);
    mouth.position.set(0, 0.38 * s, -0.32 * s);
    group.add(mouth);

    // Left head
    const headL = new THREE.Mesh(new THREE.BoxGeometry(0.45 * s, 0.45 * s, 0.45 * s), headMat);
    headL.position.set(-0.6 * s, 0.3 * s, 0);
    group.add(headL);
    const eyeLL = new THREE.Mesh(new THREE.BoxGeometry(0.1 * s, 0.08 * s, 0.05 * s), eyeMat);
    eyeLL.position.set(-0.7 * s, 0.35 * s, -0.25 * s);
    group.add(eyeLL);
    const eyeLR = new THREE.Mesh(new THREE.BoxGeometry(0.1 * s, 0.08 * s, 0.05 * s), eyeMat);
    eyeLR.position.set(-0.5 * s, 0.35 * s, -0.25 * s);
    group.add(eyeLR);

    // Right head
    const headR = new THREE.Mesh(new THREE.BoxGeometry(0.45 * s, 0.45 * s, 0.45 * s), headMat);
    headR.position.set(0.6 * s, 0.3 * s, 0);
    group.add(headR);
    const eyeRL = new THREE.Mesh(new THREE.BoxGeometry(0.1 * s, 0.08 * s, 0.05 * s), eyeMat);
    eyeRL.position.set(0.5 * s, 0.35 * s, -0.25 * s);
    group.add(eyeRL);
    const eyeRR = new THREE.Mesh(new THREE.BoxGeometry(0.1 * s, 0.08 * s, 0.05 * s), eyeMat);
    eyeRR.position.set(0.7 * s, 0.35 * s, -0.25 * s);
    group.add(eyeRR);

    // Spine / ribcage
    const spineMat = new THREE.MeshLambertMaterial({ color: bone });
    for (let i = 0; i < 5; i++) {
        const ribW = (0.8 - i * 0.1) * s;
        const rib = new THREE.Mesh(new THREE.BoxGeometry(ribW, 0.15 * s, 0.2 * s), spineMat);
        rib.position.set(0, -i * 0.25 * s, 0);
        rib.name = `rib${i}`;
        group.add(rib);
    }

    // Tail (tapered)
    const tailGeo = new THREE.BoxGeometry(0.15 * s, 0.15 * s, 0.4 * s);
    const tail = new THREE.Mesh(tailGeo, spineMat);
    tail.position.set(0, -1.3 * s, 0.1 * s);
    tail.name = 'tail';
    group.add(tail);

    return group;
}

class Wither {
    constructor(x, y, z, scale) {
        this.type = 'wither';
        this.scale = scale;
        this.mesh = createWitherMesh(scale);
        this.mesh.position.set(x, y + 1, z);
        this.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 1.5,
            0.5,
            (Math.random() - 0.5) * 1.5
        );
        this.time = Math.random() * Math.PI * 2;
        this.dirChangeTimer = 2 + Math.random() * 3;
        this.alive = true;
        this.huntTarget = null;
        this.tamed = false;
    }

    update(dt, world, allMobs, playerX, playerY, playerZ) {
        if (!this.alive) return;
        this.time += dt;

        // Rib wave animation
        for (let i = 0; i < 5; i++) {
            const rib = this.mesh.getObjectByName(`rib${i}`);
            if (rib) rib.position.x = Math.sin(this.time * 3 + i * 0.8) * 0.05 * this.scale;
        }
        const tail = this.mesh.getObjectByName('tail');
        if (tail) tail.rotation.y = Math.sin(this.time * 2.5) * 0.4;

        const myPos = this.mesh.position;
        const speed = 2.0;

        if (this.tamed) {
            // Follow player if far
            const pdx = playerX - myPos.x, pdy = playerY - myPos.y, pdz = playerZ - myPos.z;
            const pDist = Math.sqrt(pdx * pdx + pdy * pdy + pdz * pdz);
            if (pDist > 12) {
                const s = 4.0 / pDist;
                this.velocity.set(pdx * s, pdy * s, pdz * s);
            } else {
                // Idle near player
                this.dirChangeTimer -= dt;
                if (this.dirChangeTimer <= 0) {
                    this.velocity.x = (Math.random() - 0.5) * 0.8;
                    this.velocity.z = (Math.random() - 0.5) * 0.8;
                    this.velocity.y = (Math.random() - 0.5) * 0.3;
                    this.dirChangeTimer = 2 + Math.random() * 3;
                }
            }
        } else {
            // Hunt nearest non-wither mob
            this.huntTarget = null;
            let nearestDist = 20;
            for (const m of allMobs) {
                if (!m.alive || m.type === 'wither') continue;
                const dx = m.mesh.position.x - myPos.x;
                const dy = m.mesh.position.y - myPos.y;
                const dz = m.mesh.position.z - myPos.z;
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    this.huntTarget = m;
                }
            }

            if (this.huntTarget) {
                const t = this.huntTarget.mesh.position;
                const dx = t.x - myPos.x, dy = t.y - myPos.y, dz = t.z - myPos.z;
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                if (dist > 1.5) {
                    const s = speed / dist;
                    this.velocity.set(dx * s, dy * s, dz * s);
                } else {
                    this.huntTarget.alive = false;
                    this.huntTarget = null;
                }
            } else {
                this.dirChangeTimer -= dt;
                if (this.dirChangeTimer <= 0) {
                    this.velocity.x = (Math.random() - 0.5) * 1.5;
                    this.velocity.z = (Math.random() - 0.5) * 1.5;
                    this.velocity.y = (Math.random() - 0.5) * 0.5;
                    this.dirChangeTimer = 2 + Math.random() * 3;
                }
            }
        }

        myPos.x += this.velocity.x * dt;
        myPos.y += this.velocity.y * dt;
        myPos.z += this.velocity.z * dt;
        myPos.y += Math.sin(this.time * 1.2) * 0.02;

        // Stay above ground
        if (myPos.y < 22) myPos.y = 22;
        if (myPos.y > 50) myPos.y = 50;

        // Face direction
        if (Math.abs(this.velocity.x) > 0.01 || Math.abs(this.velocity.z) > 0.01) {
            const targetYaw = Math.atan2(this.velocity.x, this.velocity.z) + Math.PI;
            let diff = targetYaw - this.mesh.rotation.y;
            if (diff > Math.PI) diff -= Math.PI * 2;
            if (diff < -Math.PI) diff += Math.PI * 2;
            this.mesh.rotation.y += diff * dt * 3;
        }
    }
}

// ============================================================
// Ghast - Nether flying mob, tame with Fire to ride
// ============================================================

function createGhastMesh() {
    const group = new THREE.Group();
    const white = 0xe8e8e8;

    // Body - large cube
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(2, 2, 2),
        new THREE.MeshLambertMaterial({ color: white })
    );
    group.add(body);

    // Eyes - sad/crying
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, 0.1), eyeMat);
    eyeL.position.set(-0.35, 0.2, -1.05);
    group.add(eyeL);
    const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, 0.1), eyeMat);
    eyeR.position.set(0.35, 0.2, -1.05);
    group.add(eyeR);

    // Mouth
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.1), eyeMat);
    mouth.position.set(0, -0.25, -1.05);
    group.add(mouth);

    // Tears
    const tearMat = new THREE.MeshBasicMaterial({ color: 0x4444aa });
    const tearL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.05), tearMat);
    tearL.position.set(-0.35, -0.1, -1.08);
    tearL.name = 'tearL';
    group.add(tearL);
    const tearR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.05), tearMat);
    tearR.position.set(0.35, -0.1, -1.08);
    tearR.name = 'tearR';
    group.add(tearR);

    // Tentacles (9 hanging)
    const tentMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });
    for (let tx = -1; tx <= 1; tx++) {
        for (let tz = -1; tz <= 1; tz++) {
            const len = 1.5 + Math.random() * 1.5;
            const tent = new THREE.Mesh(new THREE.BoxGeometry(0.2, len, 0.2), tentMat);
            tent.position.set(tx * 0.55, -1 - len / 2, tz * 0.55);
            tent.name = `tent${(tx+1)*3+(tz+1)}`;
            group.add(tent);
        }
    }

    return group;
}

class Ghast {
    constructor(x, y, z) {
        this.type = 'ghast';
        this.mesh = createGhastMesh();
        this.mesh.position.set(x, y, z);
        this.velocity = new THREE.Vector3((Math.random()-0.5)*0.8, 0, (Math.random()-0.5)*0.8);
        this.time = Math.random() * Math.PI * 2;
        this.dirChangeTimer = 3 + Math.random() * 4;
        this.alive = true;
        this.tamed = false;
        this.rider = null; // player reference when riding
    }

    update(dt) {
        if (!this.alive) return;
        this.time += dt;

        // Tentacle sway
        for (let i = 0; i < 9; i++) {
            const tent = this.mesh.getObjectByName(`tent${i}`);
            if (tent) tent.rotation.x = Math.sin(this.time * 1.5 + i * 0.7) * 0.15;
        }
        // Tear animation
        const tearL = this.mesh.getObjectByName('tearL');
        const tearR = this.mesh.getObjectByName('tearR');
        if (tearL) tearL.position.y = -0.1 + Math.sin(this.time * 2) * 0.05;
        if (tearR) tearR.position.y = -0.1 + Math.sin(this.time * 2 + 1) * 0.05;

        if (!this.tamed) {
            // Idle float
            this.dirChangeTimer -= dt;
            if (this.dirChangeTimer <= 0) {
                this.velocity.x = (Math.random()-0.5) * 0.8;
                this.velocity.z = (Math.random()-0.5) * 0.8;
                this.velocity.y = (Math.random()-0.5) * 0.3;
                this.dirChangeTimer = 3 + Math.random() * 4;
            }
        }

        const pos = this.mesh.position;
        pos.x += this.velocity.x * dt;
        pos.y += this.velocity.y * dt;
        pos.z += this.velocity.z * dt;
        pos.y += Math.sin(this.time * 0.8) * 0.01;

        if (pos.y < 15) this.velocity.y = Math.abs(this.velocity.y) + 0.2;
        if (pos.y > 45) this.velocity.y = -Math.abs(this.velocity.y) - 0.2;

        if (Math.abs(this.velocity.x) > 0.01 || Math.abs(this.velocity.z) > 0.01) {
            const yaw = Math.atan2(this.velocity.x, this.velocity.z) + Math.PI;
            let diff = yaw - this.mesh.rotation.y;
            if (diff > Math.PI) diff -= Math.PI * 2;
            if (diff < -Math.PI) diff += Math.PI * 2;
            this.mesh.rotation.y += diff * dt * 2;
        }
    }
}

// ============================================================
// Guardian - Ocean mob, tame with Clione egg -> creates End Portal
// ============================================================

function createGuardianMesh() {
    const group = new THREE.Group();
    const teal = 0x3a8a7a;
    const dark = 0x2a5a5a;
    const orange = 0xdd6622;

    // Body - spiky diamond shape
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.8, 1.2),
        new THREE.MeshLambertMaterial({ color: teal })
    );
    body.rotation.y = Math.PI / 4;
    group.add(body);

    // Eye - single large orange
    const eyeBg = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.1), new THREE.MeshLambertMaterial({ color: 0xeeeeee }));
    eyeBg.position.set(0, 0.05, -0.65);
    group.add(eyeBg);
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.12), new THREE.MeshBasicMaterial({ color: orange }));
    eye.position.set(0, 0.05, -0.68);
    eye.name = 'eye';
    group.add(eye);

    // Spikes
    const spikeMat = new THREE.MeshLambertMaterial({ color: dark });
    const spikePositions = [
        [0, 0.55, 0], [0, -0.55, 0],
        [0.7, 0, 0], [-0.7, 0, 0],
        [0, 0, 0.7], [0, 0, -0.7],
        [0.5, 0.35, 0.5], [-0.5, 0.35, -0.5],
        [0.5, -0.35, -0.5], [-0.5, -0.35, 0.5],
    ];
    spikePositions.forEach(([sx, sy, sz], i) => {
        const spike = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.3, 0.15), spikeMat);
        spike.position.set(sx, sy, sz);
        spike.lookAt(sx * 2, sy * 2, sz * 2);
        spike.name = `spike${i}`;
        group.add(spike);
    });

    // Tail
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.5), new THREE.MeshLambertMaterial({ color: teal }));
    tail.position.set(0, 0, 0.85);
    tail.name = 'tail';
    group.add(tail);

    return group;
}

class Guardian {
    constructor(x, y, z) {
        this.type = 'guardian';
        this.mesh = createGuardianMesh();
        this.mesh.position.set(x, y, z);
        this.velocity = new THREE.Vector3((Math.random()-0.5)*0.6, 0, (Math.random()-0.5)*0.6);
        this.time = Math.random() * Math.PI * 2;
        this.dirChangeTimer = 2 + Math.random() * 4;
        this.alive = true;
        this.tamed = false;
    }

    update(dt, world) {
        if (!this.alive) return;
        this.time += dt;

        // Eye tracking animation
        const eye = this.mesh.getObjectByName('eye');
        if (eye) eye.position.x = Math.sin(this.time * 1.5) * 0.05;

        // Spike pulse
        for (let i = 0; i < 10; i++) {
            const spike = this.mesh.getObjectByName(`spike${i}`);
            if (spike) {
                const s = 1 + Math.sin(this.time * 2 + i) * 0.15;
                spike.scale.set(s, s, s);
            }
        }
        // Tail
        const tail = this.mesh.getObjectByName('tail');
        if (tail) tail.rotation.y = Math.sin(this.time * 3) * 0.4;

        if (!this.tamed) {
            this.dirChangeTimer -= dt;
            if (this.dirChangeTimer <= 0) {
                this.velocity.x = (Math.random()-0.5) * 0.6;
                this.velocity.z = (Math.random()-0.5) * 0.6;
                this.velocity.y = (Math.random()-0.5) * 0.2;
                this.dirChangeTimer = 2 + Math.random() * 4;
            }
        }

        const pos = this.mesh.position;
        pos.x += this.velocity.x * dt;
        pos.y += this.velocity.y * dt;
        pos.z += this.velocity.z * dt;
        pos.y += Math.sin(this.time) * 0.01;

        // Stay in water
        const bx = Math.floor(pos.x+0.5), by = Math.floor(pos.y+0.5), bz = Math.floor(pos.z+0.5);
        if (world.getBlock(bx, by, bz) !== BlockType.WATER) {
            if (world.getBlock(bx, by+1, bz) === BlockType.WATER) this.velocity.y = 0.3;
            else if (world.getBlock(bx, by-1, bz) === BlockType.WATER) this.velocity.y = -0.3;
            else { this.velocity.x *= -1; this.velocity.z *= -1; }
        }
        if (pos.y < 1) { pos.y = 1; this.velocity.y = 0.2; }

        if (Math.abs(this.velocity.x) > 0.01 || Math.abs(this.velocity.z) > 0.01) {
            const yaw = Math.atan2(this.velocity.x, this.velocity.z) + Math.PI;
            let diff = yaw - this.mesh.rotation.y;
            if (diff > Math.PI) diff -= Math.PI * 2;
            if (diff < -Math.PI) diff += Math.PI * 2;
            this.mesh.rotation.y += diff * dt * 2;
        }
    }
}

// ============================================================
// Ender Dragon - Final boss in Ender World
// ============================================================

function createEnderDragonMesh() {
    const group = new THREE.Group();
    const black = 0x111118;
    const purple = 0x6622aa;
    const eyeColor = 0xcc44ff;

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 1.5), new THREE.MeshLambertMaterial({ color: black }));
    head.position.set(0, 0.5, -2.5);
    group.add(head);

    // Snout
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.8), new THREE.MeshLambertMaterial({ color: black }));
    snout.position.set(0, 0.3, -3.4);
    group.add(snout);

    // Eyes - purple glowing
    const eMat = new THREE.MeshBasicMaterial({ color: eyeColor });
    const eleft = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.2, 0.1), eMat);
    eleft.position.set(-0.35, 0.65, -3.25);
    group.add(eleft);
    const eright = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.2, 0.1), eMat);
    eright.position.set(0.35, 0.65, -3.25);
    group.add(eright);

    // Jaw
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 0.7), new THREE.MeshLambertMaterial({ color: 0x1a1a25 }));
    jaw.position.set(0, 0.0, -3.3);
    jaw.name = 'jaw';
    group.add(jaw);

    // Horns
    const hornMat = new THREE.MeshLambertMaterial({ color: 0x333340 });
    const hornL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.5, 0.15), hornMat);
    hornL.position.set(-0.35, 1.0, -2.3);
    hornL.rotation.x = -0.3;
    group.add(hornL);
    const hornR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.5, 0.15), hornMat);
    hornR.position.set(0.35, 1.0, -2.3);
    hornR.rotation.x = -0.3;
    group.add(hornR);

    // Neck
    for (let i = 0; i < 3; i++) {
        const neck = new THREE.Mesh(new THREE.BoxGeometry(0.7 + i * 0.1, 0.6, 0.6), new THREE.MeshLambertMaterial({ color: black }));
        neck.position.set(0, 0.3 - i * 0.05, -1.5 + i * 0.5);
        neck.name = `neck${i}`;
        group.add(neck);
    }

    // Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(2, 1.2, 3), new THREE.MeshLambertMaterial({ color: black }));
    body.position.set(0, 0, 0.5);
    group.add(body);

    // Spine ridge (purple)
    const spineMat = new THREE.MeshLambertMaterial({ color: purple });
    for (let i = 0; i < 6; i++) {
        const spine = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.3 + (3-Math.abs(i-2.5))*0.1, 0.3), spineMat);
        spine.position.set(0, 0.7, -1 + i * 0.6);
        group.add(spine);
    }

    // Wings
    const wingMat = new THREE.MeshLambertMaterial({ color: 0x1a1a25, side: THREE.DoubleSide });
    const wingMemb = new THREE.MeshLambertMaterial({ color: purple, transparent: true, opacity: 0.5, side: THREE.DoubleSide });

    // Left wing
    const wingLG = new THREE.Group();
    wingLG.name = 'wingL';
    wingLG.position.set(-1, 0.5, 0);
    const wingLBone = new THREE.Mesh(new THREE.BoxGeometry(3, 0.12, 0.2), wingMat);
    wingLBone.position.set(-1.5, 0, 0);
    wingLG.add(wingLBone);
    const wingLMem = new THREE.Mesh(new THREE.BoxGeometry(3, 0.05, 1.8), wingMemb);
    wingLMem.position.set(-1.5, -0.05, 0.4);
    wingLG.add(wingLMem);
    group.add(wingLG);

    // Right wing
    const wingRG = new THREE.Group();
    wingRG.name = 'wingR';
    wingRG.position.set(1, 0.5, 0);
    const wingRBone = new THREE.Mesh(new THREE.BoxGeometry(3, 0.12, 0.2), wingMat);
    wingRBone.position.set(1.5, 0, 0);
    wingRG.add(wingRBone);
    const wingRMem = new THREE.Mesh(new THREE.BoxGeometry(3, 0.05, 1.8), wingMemb);
    wingRMem.position.set(1.5, -0.05, 0.4);
    wingRG.add(wingRMem);
    group.add(wingRG);

    // Tail
    for (let i = 0; i < 4; i++) {
        const ts = 0.6 - i * 0.12;
        const tail = new THREE.Mesh(new THREE.BoxGeometry(ts, ts * 0.6, 0.8), new THREE.MeshLambertMaterial({ color: black }));
        tail.position.set(0, -0.1 - i * 0.1, 2.2 + i * 0.7);
        tail.name = `tail${i}`;
        group.add(tail);
    }

    // Legs
    const legMat = new THREE.MeshLambertMaterial({ color: 0x1a1a25 });
    for (const sx of [-0.6, 0.6]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.3), legMat);
        leg.position.set(sx, -0.9, 0.2);
        group.add(leg);
        const foot = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.5), legMat);
        foot.position.set(sx, -1.35, 0.1);
        group.add(foot);
    }

    return group;
}

class EnderDragon {
    constructor(x, y, z) {
        this.type = 'enderdragon';
        this.mesh = createEnderDragonMesh();
        this.mesh.position.set(x, y, z);
        this.velocity = new THREE.Vector3(1, 0, 0);
        this.time = Math.random() * Math.PI * 2;
        this.alive = true;
        this.hp = 100;
        this.orbitAngle = 0;
        this.orbitRadius = 25;
        this.orbitY = 35;
        this.orbitCenter = new THREE.Vector3(0, 0, 0);
    }

    update(dt) {
        if (!this.alive) return;
        this.time += dt;

        // Wing flap
        const wingL = this.mesh.getObjectByName('wingL');
        const wingR = this.mesh.getObjectByName('wingR');
        if (wingL) wingL.rotation.z = Math.sin(this.time * 2.5) * 0.5;
        if (wingR) wingR.rotation.z = -Math.sin(this.time * 2.5) * 0.5;

        // Tail wave
        for (let i = 0; i < 4; i++) {
            const tail = this.mesh.getObjectByName(`tail${i}`);
            if (tail) tail.position.x = Math.sin(this.time * 2 + i * 0.8) * 0.15 * (i + 1);
        }

        // Neck wave
        for (let i = 0; i < 3; i++) {
            const neck = this.mesh.getObjectByName(`neck${i}`);
            if (neck) neck.position.x = Math.sin(this.time * 1.5 + i * 0.5) * 0.08;
        }

        // Jaw
        const jaw = this.mesh.getObjectByName('jaw');
        if (jaw) jaw.position.y = -0.05 + Math.sin(this.time * 1.2) * 0.05;

        // Orbit flight pattern
        this.orbitAngle += dt * 0.3;
        const targetX = this.orbitCenter.x + Math.cos(this.orbitAngle) * this.orbitRadius;
        const targetZ = this.orbitCenter.z + Math.sin(this.orbitAngle) * this.orbitRadius;
        const targetY = this.orbitY + Math.sin(this.time * 0.5) * 5;

        const pos = this.mesh.position;
        pos.x += (targetX - pos.x) * dt * 2;
        pos.y += (targetY - pos.y) * dt * 2;
        pos.z += (targetZ - pos.z) * dt * 2;

        // Face flight direction
        const yaw = this.orbitAngle + Math.PI / 2;
        this.mesh.rotation.y = yaw;
        this.mesh.rotation.z = Math.sin(this.orbitAngle) * 0.15;
    }

    takeDamage(amount) {
        this.hp -= amount;
        if (this.hp <= 0) {
            this.alive = false;
        }
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
        this.maxCliones = 12;
        this.maxBloops = 2;
        this.maxMeowls = 3;
        this.maxGhasts = 2;
        this.maxGuardians = 2;
        this.ghastSpawnTimer = 5;
        this.guardianSpawnTimer = 8;
        this.dragonSpawned = false;
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

    spawnWither(x, y, z, scale) {
        const wither = new Wither(x, y, z, scale);
        this.entities.push(wither);
        this.scene.add(wither.mesh);
        return wither;
    }

    spawnGhast(x, y, z) {
        const g = new Ghast(x, y, z);
        this.entities.push(g);
        this.scene.add(g.mesh);
        return g;
    }

    spawnGuardian(x, y, z) {
        const g = new Guardian(x, y, z);
        this.entities.push(g);
        this.scene.add(g.mesh);
        return g;
    }

    spawnEnderDragon(x, y, z) {
        const d = new EnderDragon(x, y, z);
        this.entities.push(d);
        this.scene.add(d.mesh);
        return d;
    }

    spawnBloop(x, y, z) {
        const bloop = new Bloop(x, y, z);
        this.entities.push(bloop);
        this.scene.add(bloop.mesh);
        return bloop;
    }

    tryNaturalSpawnClione(playerX, playerZ) {
        let count = 0;
        for (const e of this.entities) if (e.type === 'clione' && e.alive) count++;
        if (count >= this.maxCliones) return;

        const angle = Math.random() * Math.PI * 2;
        const dist = 10 + Math.random() * 20;
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
        let count = 0;
        for (const e of this.entities) if (e.type === 'bloop' && e.alive) count++;
        if (count >= this.maxBloops) return;

        const angle = Math.random() * Math.PI * 2;
        const dist = 15 + Math.random() * 20;
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
        let count = 0;
        for (const e of this.entities) if (e.type === 'meowl' && e.alive) count++;
        if (count >= this.maxMeowls) return;

        const angle = Math.random() * Math.PI * 2;
        const dist = 15 + Math.random() * 20;
        const sx = playerX + Math.cos(angle) * dist;
        const sz = playerZ + Math.sin(angle) * dist;
        const sy = 30 + Math.random() * 15;

        const meowl = new Meowl(sx, sy, sz);
        this.entities.push(meowl);
        this.scene.add(meowl.mesh);
    }

    update(dt, playerX, playerY, playerZ, dimension) {
        // Dimension-specific spawning
        if (dimension === 'overworld') {
            this.spawnCheckTimer -= dt;
            if (this.spawnCheckTimer <= 0) { this.tryNaturalSpawnClione(playerX, playerZ); this.spawnCheckTimer = 2; }
            this.meowlSpawnTimer -= dt;
            if (this.meowlSpawnTimer <= 0) { this.tryNaturalSpawnMeowl(playerX, playerZ); this.meowlSpawnTimer = 6 + Math.random() * 6; }
            this.bloopSpawnTimer -= dt;
            if (this.bloopSpawnTimer <= 0) { this.tryNaturalSpawnBloop(playerX, playerZ); this.bloopSpawnTimer = 10 + Math.random() * 10; }
            // Guardian in water
            this.guardianSpawnTimer -= dt;
            if (this.guardianSpawnTimer <= 0) {
                let gc = 0; for (const e of this.entities) if (e.type === 'guardian' && e.alive) gc++;
                if (gc < this.maxGuardians) {
                    const a = Math.random() * Math.PI * 2, d = 15 + Math.random() * 20;
                    const sx = Math.floor(playerX + Math.cos(a) * d), sz = Math.floor(playerZ + Math.sin(a) * d);
                    for (let y = 10; y <= 18; y++) {
                        if (this.world.getBlock(sx, y, sz) === BlockType.WATER) { this.spawnGuardian(sx, y, sz); break; }
                    }
                }
                this.guardianSpawnTimer = 12 + Math.random() * 10;
            }
        } else if (dimension === 'nether') {
            // Ghast spawning in nether
            this.ghastSpawnTimer -= dt;
            if (this.ghastSpawnTimer <= 0) {
                let gc = 0; for (const e of this.entities) if (e.type === 'ghast' && e.alive) gc++;
                if (gc < this.maxGhasts) {
                    const a = Math.random() * Math.PI * 2, d = 15 + Math.random() * 20;
                    const sx = playerX + Math.cos(a) * d, sz = playerZ + Math.sin(a) * d;
                    this.spawnGhast(sx, 25 + Math.random() * 15, sz);
                }
                this.ghastSpawnTimer = 8 + Math.random() * 8;
            }
        } else if (dimension === 'ender') {
            // Ender Dragon - one per visit
            if (!this.dragonSpawned) {
                this.spawnEnderDragon(playerX, 35, playerZ);
                this.dragonSpawned = true;
            }
        }

        const cliones = [];
        const majas = [];
        for (let i = 0; i < this.entities.length; i++) {
            const e = this.entities[i];
            if (!e.alive) continue;
            if (e.type === 'clione') cliones.push(e);
            else if (e.type === 'maja') majas.push(e);
        }

        // Clean dead
        let writeIdx = 0;
        for (let i = 0; i < this.entities.length; i++) {
            const entity = this.entities[i];
            if (!entity.alive) { this.scene.remove(entity.mesh); continue; }
            this.entities[writeIdx++] = entity;
        }
        this.entities.length = writeIdx;

        // Update
        for (let i = this.entities.length - 1; i >= 0; i--) {
            const entity = this.entities[i];

            if (entity.type === 'maja') entity.update(dt, this.world, cliones);
            else if (entity.type === 'bloop') entity.update(dt, this.world, cliones, majas);
            else if (entity.type === 'wither') entity.update(dt, this.world, this.entities, playerX, playerY, playerZ);
            else if (entity.type === 'ghast') entity.update(dt);
            else if (entity.type === 'guardian') entity.update(dt, this.world);
            else if (entity.type === 'enderdragon') entity.update(dt);
            else if (entity.type === 'meowl') entity.update(dt);
            else entity.update(dt, this.world);

            const dx = entity.mesh.position.x - playerX;
            const dz = entity.mesh.position.z - playerZ;
            if (entity.type === 'enderdragon') continue; // dragon never despawns
            if (entity.tamed) continue; // tamed never despawn
            const maxD = (entity.type === 'wither' || entity.type === 'ghast') ? 120 : (entity.type === 'maja' || entity.type === 'bloop' || entity.type === 'guardian') ? 80 : (entity.type === 'meowl' ? 80 : 50);
            if (dx * dx + dz * dz > maxD * maxD) {
                this.scene.remove(entity.mesh);
                this.entities[i] = this.entities[this.entities.length - 1];
                this.entities.pop();
            }
        }
    }
}
