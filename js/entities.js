import * as THREE from 'three';
import { BlockType } from './blocks.js';

// Shared helpers
const _v = new THREE.Vector3();
function box(w,h,d,color,opts={}) {
    const mat = new THREE.MeshLambertMaterial({ color, ...opts });
    return new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
}
function glow(w,h,d,color) {
    return new THREE.Mesh(new THREE.BoxGeometry(w,h,d), new THREE.MeshBasicMaterial({ color }));
}
function sph(r,color,opts={}) {
    return new THREE.Mesh(new THREE.SphereGeometry(r,8,6), new THREE.MeshLambertMaterial({ color, ...opts }));
}

// Base entity mixin
function initBase(e, type, x, y, z, speed) {
    e.type = type;
    e.alive = true;
    e.tamed = false;
    e.time = Math.random() * Math.PI * 2;
    e.dirTimer = 2 + Math.random() * 4;
    e.velocity = new THREE.Vector3((Math.random()-0.5)*speed, 0, (Math.random()-0.5)*speed);
    e.mesh.position.set(x, y, z);
}
function faceDir(mesh, vx, vz, dt, offset=Math.PI) {
    if (Math.abs(vx) < 0.01 && Math.abs(vz) < 0.01) return;
    const yaw = Math.atan2(vx, vz) + offset;
    let diff = yaw - mesh.rotation.y;
    if (diff > Math.PI) diff -= Math.PI*2;
    if (diff < -Math.PI) diff += Math.PI*2;
    mesh.rotation.y += diff * dt * 3;
}
function stayInWater(e, world) {
    const p = e.mesh.position;
    const bx = Math.floor(p.x+0.5), by = Math.floor(p.y+0.5), bz = Math.floor(p.z+0.5);
    if (world.getBlock(bx,by,bz) !== BlockType.WATER) {
        if (world.getBlock(bx,by+1,bz) === BlockType.WATER) e.velocity.y = 0.3;
        else if (world.getBlock(bx,by-1,bz) === BlockType.WATER) e.velocity.y = -0.3;
        else { e.velocity.x *= -1; e.velocity.z *= -1; }
    }
    if (p.y < 1) { p.y = 1; e.velocity.y = 0.2; }
}
function moveAndBob(e, dt, bobSpeed=2) {
    const p = e.mesh.position;
    p.x += e.velocity.x * dt;
    p.y += e.velocity.y * dt;
    p.z += e.velocity.z * dt;
    p.y += Math.sin(e.time * bobSpeed) * 0.01;
}
function wander(e, dt, speed) {
    e.dirTimer -= dt;
    if (e.dirTimer <= 0) {
        e.velocity.x = (Math.random()-0.5) * speed;
        e.velocity.z = (Math.random()-0.5) * speed;
        e.velocity.y = (Math.random()-0.5) * 0.2;
        e.dirTimer = 2 + Math.random() * 5;
    }
}
function huntNearest(e, targets, range, speed, dt, eatRange=1.5) {
    let nearest = null, nearDist = range;
    const p = e.mesh.position;
    for (const t of targets) {
        if (!t.alive) continue;
        _v.subVectors(t.mesh.position, p);
        const d = _v.length();
        if (d < nearDist) { nearDist = d; nearest = t; }
    }
    if (nearest) {
        _v.subVectors(nearest.mesh.position, p);
        const d = _v.length();
        if (d > eatRange) {
            _v.normalize().multiplyScalar(speed);
            e.velocity.lerp(_v, dt * 3);
        } else {
            nearest.alive = false;
            return true;
        }
    }
    return false;
}

// ==================== CLIONE ====================
function createClioneMesh() {
    const g = new THREE.Group();
    g.add(box(0.2,0.4,0.15, 0xe8d8d0, {transparent:true,opacity:0.55}));
    const organ = box(0.08,0.12,0.06, 0xff6030, {transparent:true,opacity:0.8});
    organ.position.y = 0.02; g.add(organ);
    const head = box(0.16,0.1,0.12, 0xf0e0d8, {transparent:true,opacity:0.6});
    head.position.y = 0.25; g.add(head);
    for (const sx of [-0.04,0.04]) {
        const horn = box(0.03,0.08,0.03, 0xff7040, {transparent:true,opacity:0.75});
        horn.position.set(sx, 0.33, 0); g.add(horn);
    }
    const wm = {color:0xf0e8e0, transparent:true, opacity:0.4, side:THREE.DoubleSide};
    for (const [sx,name] of [[-0.16,'wingL'],[0.16,'wingR']]) {
        const w = box(0.15,0.1,0.02, 0, wm);
        w.position.set(sx, 0.08, 0); w.name = name; g.add(w);
    }
    const tail = box(0.1,0.08,0.08, 0xe0d0c8, {transparent:true,opacity:0.45});
    tail.position.y = -0.24; g.add(tail);
    return g;
}
class Clione {
    constructor(x,y,z) {
        this.mesh = createClioneMesh();
        initBase(this, 'clione', x, y, z, 0.4);
    }
    update(dt, world) {
        if (!this.alive) return;
        this.time += dt;
        const wL = this.mesh.getObjectByName('wingL'), wR = this.mesh.getObjectByName('wingR');
        if (wL) wL.rotation.z = Math.sin(this.time*6)*0.5;
        if (wR) wR.rotation.z = -Math.sin(this.time*6)*0.5;
        wander(this, dt, 0.4);
        moveAndBob(this, dt);
        faceDir(this.mesh, this.velocity.x, this.velocity.z, dt);
        stayInWater(this, world);
    }
}

// ==================== EL GRAN MAJA ====================
function createMajaMesh() {
    const g = new THREE.Group();
    const c = 0x4060a0, d = 0x2a3a70;
    // Head
    const head = sph(0.8, c); head.scale.set(1.7,0.55,1.2); head.position.set(0,0.15,-1.5); g.add(head);
    const snout = sph(0.7, c); snout.scale.set(1.5,0.45,0.9); snout.position.set(0,0.05,-2.1); g.add(snout);
    // 6 eyes in row
    for (let i=0;i<6;i++) {
        const x = (i-2.5)*0.18;
        const eye = glow(0.13,0.13,0.13, 0x40ffcc);
        eye.position.set(x, 0.12, -2.7); eye.name=`eye${i}`; g.add(eye);
    }
    // Jaw
    const uj = sph(0.7, c); uj.scale.set(1.3,0.25,0.9); uj.rotation.x=Math.PI; uj.position.set(0,-0.2,-2.2); g.add(uj);
    const ljG = new THREE.Group(); ljG.name='lowerJaw'; ljG.position.set(0,-0.5,-2.15);
    ljG.add(box(1.4,0.2,0.7, d));
    const gum = box(1.3,0.06,0.65, 0xbb2020); gum.position.y=0.1; ljG.add(gum);
    const tm = new THREE.MeshLambertMaterial({color:0xe8e8dd});
    for (let i=-5;i<=5;i++) { const h=0.2+Math.random()*0.12; const t=new THREE.Mesh(new THREE.ConeGeometry(0.04,h,4),tm); t.position.set(i*0.11,0.1+h/2,-0.05); ljG.add(t); }
    g.add(ljG);
    const ugum = box(1.4,0.06,0.7, 0xbb2020); ugum.position.set(0,-0.27,-2.2); g.add(ugum);
    for (let i=-6;i<=6;i++) { const h=0.22+Math.random()*0.15; const t=new THREE.Mesh(new THREE.ConeGeometry(0.045,h,4),tm); t.position.set(i*0.1,-0.27-h/2,-2.25); t.rotation.x=Math.PI; g.add(t); }
    g.add(box(1.1,0.35,0.5, 0x3a0808)).position.set(0,-0.18,-1.9);
    // Body segments
    for (let i=0;i<8;i++) { const t=i/8, r=0.7*(1-t*0.55); const s=sph(r,c); s.scale.set(1,0.7,0.9); s.position.set(0,-0.03*i,i*0.55); s.name=`seg${i}`; g.add(s); }
    const tail = sph(0.25,d); tail.scale.set(1,0.6,2); tail.position.set(0,-0.2,8*0.55+0.3); tail.name='tail'; g.add(tail);
    return g;
}
class ElGranMaja {
    constructor(x,y,z) {
        this.mesh = createMajaMesh();
        initBase(this, 'maja', x, y, z, 0.6);
        this.jawOpen = 0; this.eating = false; this.eatTimer = 0;
    }
    update(dt, world, cliones) {
        if (!this.alive) return;
        this.time += dt;
        for (let i=0;i<6;i++) { const e=this.mesh.getObjectByName(`eye${i}`); if(e) e.material.opacity = 0.7+Math.sin(this.time*3+i)*0.3; }
        for (let i=0;i<8;i++) { const s=this.mesh.getObjectByName(`seg${i}`); if(s) s.position.x = Math.sin(this.time*2+i*0.7)*0.06*i; }
        const lj = this.mesh.getObjectByName('lowerJaw');
        if (lj) { const tj = this.eating?0.35:0; this.jawOpen += (tj-this.jawOpen)*dt*3; lj.position.y = -0.5-this.jawOpen; }
        if (this.eating) { this.eatTimer -= dt; if (this.eatTimer<=0) this.eating=false; }
        else if (huntNearest(this, cliones, 15, 1.8, dt)) { this.eating=true; this.eatTimer=1.5; }
        else wander(this, dt, 0.6);
        moveAndBob(this, dt, 0.8);
        faceDir(this.mesh, this.velocity.x, this.velocity.z, dt);
        stayInWater(this, world);
    }
}

// ==================== BLOOP ====================
function createBloopMesh() {
    const g = new THREE.Group();
    const c = 0x8a8a50, d = 0x707040, b = 0xa0a070;
    g.add(box(1.6,1.0,1.8, c)).position.set(0,0.1,-1.8);
    g.add(box(1.4,0.5,0.8, c)).position.set(0,0.3,-2.9);
    for (const sx of [-0.5,0.5]) { g.add(glow(0.12,0.12,0.12, 0x101010)).position.set(sx,0.5,-2.6); }
    g.add(box(1.5,0.3,1.0, c)).position.set(0,-0.15,-2.8);
    const ljG = new THREE.Group(); ljG.name='lowerJaw'; ljG.position.set(0,-0.55,-2.6);
    ljG.add(box(1.4,0.25,1.0, b));
    const tm = new THREE.MeshLambertMaterial({color:0xe8e0c8});
    for (let i=-4;i<=4;i++) { const h=0.15+Math.random()*0.06; const t=new THREE.Mesh(new THREE.BoxGeometry(0.09,h,0.07),tm); t.position.set(i*0.14,0.15+h/2,-0.3); ljG.add(t); }
    g.add(ljG);
    g.add(box(1.4,0.06,0.9, 0xaa3020)).position.set(0,-0.22,-2.8);
    for (let i=-4;i<=4;i++) { const h=0.18+Math.random()*0.08; const t=new THREE.Mesh(new THREE.BoxGeometry(0.1,h,0.08),tm); t.position.set(i*0.14,-0.35-h/2,-3.15); g.add(t); }
    g.add(box(1.2,0.5,0.8, 0xaa3020)).position.set(0,-0.35,-2.5);
    for (let i=0;i<6;i++) { const t=i/6, w=1.5*(1-t*0.5), h=1.0*(1-t*0.4); const s=box(w,h,0.7,c); s.position.set(0,-0.02*i,i*0.65); s.name=`seg${i}`; g.add(s); }
    g.add(box(0.8,0.08,0.5, d)).position.set(-0.9,-0.3,-0.5);
    g.add(box(0.8,0.08,0.5, d)).position.set(0.9,-0.3,-0.5);
    g.add(box(0.1,0.5,0.6, d)).position.set(0,0.6,-0.3);
    const tail = box(0.4,0.35,0.6, d); tail.position.set(0,-0.1,6*0.65+0.2); tail.name='tail'; g.add(tail);
    return g;
}
class Bloop {
    constructor(x,y,z) {
        this.mesh = createBloopMesh();
        initBase(this, 'bloop', x, y, z, 0.5);
        this.eating=false; this.eatTimer=0; this.fighting=false; this.fightTarget=null; this.fightTimer=0;
    }
    update(dt, world, cliones, majas) {
        if (!this.alive) return;
        this.time += dt;
        for (let i=0;i<6;i++) { const s=this.mesh.getObjectByName(`seg${i}`); if(s) s.position.x=Math.sin(this.time*1.5+i*0.6)*0.05*i; }
        const lj = this.mesh.getObjectByName('lowerJaw');
        if (lj) lj.position.y = -0.55 - (this.eating||this.fighting ? 0.3 : 0);
        // Fight Maja
        if (this.fighting) {
            this.fightTimer -= dt;
            if (this.fightTarget && this.fightTarget.alive) {
                _v.subVectors(this.fightTarget.mesh.position, this.mesh.position);
                if (_v.length()>0.5) { _v.normalize().multiplyScalar(3.5); this.velocity.copy(_v); }
            }
            if (this.fightTimer<=0) { this.alive=false; return; }
        } else {
            for (const m of majas) {
                if (!m.alive) continue;
                _v.subVectors(m.mesh.position, this.mesh.position);
                if (_v.length()<15) { this.fighting=true; this.fightTarget=m; this.fightTimer=5; break; }
            }
        }
        if (!this.fighting) {
            if (this.eating) { this.eatTimer-=dt; if(this.eatTimer<=0) this.eating=false; }
            else if (huntNearest(this, cliones, 15, 1.6, dt)) { this.eating=true; this.eatTimer=1.5; }
            else wander(this, dt, 0.5);
        }
        moveAndBob(this, dt, 0.7);
        faceDir(this.mesh, this.velocity.x, this.velocity.z, dt);
        stayInWater(this, world);
    }
}

// ==================== MEOWL ====================
function createMeowlMesh() {
    const g = new THREE.Group();
    const brown = 0x8b7355, dark = 0x6b5535, white = 0xf0ece0, pink = 0xeea0a0;
    // Head
    g.add(box(0.7,0.65,0.6, brown)).position.set(0,0.55,-0.3);
    g.add(box(0.5,0.35,0.05, white)).position.set(0,0.45,-0.63);
    for (const [sx,r] of [[-0.22,0.15],[0.22,-0.15]]) {
        const ear = box(0.18,0.25,0.15, brown); ear.position.set(sx,0.95,-0.3); ear.rotation.z=r; g.add(ear);
        g.add(box(0.1,0.15,0.05, pink)).position.set(sx,0.93,-0.38);
    }
    for (const sx of [-0.15,0.15]) {
        g.add(box(0.2,0.22,0.05, 0xffffff)).position.set(sx,0.58,-0.63);
        g.add(glow(0.12,0.16,0.06, 0x101010)).position.set(sx,0.57,-0.65);
    }
    g.add(box(0.08,0.06,0.06, pink)).position.set(0,0.44,-0.65);
    for (const s of [-1,1]) for (let j=0;j<2;j++) { g.add(box(0.15,0.02,0.02,dark)).position.set(s*0.28,0.42-j*0.06,-0.55); }
    // Body
    g.add(box(0.8,0.7,0.9, brown)).position.set(0,0.05,0.15);
    g.add(box(0.55,0.55,0.05, white)).position.set(0,0.05,-0.3);
    // Wings
    for (const [sx,name] of [[-0.4,'wingL'],[0.4,'wingR']]) {
        const wg = new THREE.Group(); wg.name=name; wg.position.set(sx,0.15,0.15);
        wg.add(box(0.6,0.08,0.7, brown)).position.set(sx<0?-0.3:0.3, 0, 0);
        wg.add(box(0.25,0.06,0.5, dark)).position.set(sx<0?-0.55:0.55, 0, 0.05);
        g.add(wg);
    }
    g.add(box(0.35,0.06,0.3, dark)).position.set(0,-0.05,0.65);
    for (const sx of [-0.15,0.15]) g.add(box(0.12,0.1,0.15, 0xd4a050)).position.set(sx,-0.35,0.1);
    return g;
}
class Meowl {
    constructor(x,y,z) {
        this.mesh = createMeowlMesh();
        initBase(this, 'meowl', x, y, z, 1.2);
    }
    update(dt) {
        if (!this.alive) return;
        this.time += dt;
        const wL=this.mesh.getObjectByName('wingL'), wR=this.mesh.getObjectByName('wingR');
        if (wL) wL.rotation.z = Math.sin(this.time*4)*0.6;
        if (wR) wR.rotation.z = -Math.sin(this.time*4)*0.6;
        wander(this, dt, 1.2);
        moveAndBob(this, dt, 1.5);
        const p = this.mesh.position;
        if (p.y<30) this.velocity.y = Math.abs(this.velocity.y)+0.3;
        if (p.y>55) this.velocity.y = -Math.abs(this.velocity.y)-0.3;
        faceDir(this.mesh, this.velocity.x, this.velocity.z, dt);
        this.mesh.rotation.z = -this.velocity.x * 0.15;
    }
}

// ==================== WITHER ====================
function createWitherMesh(s) {
    const g = new THREE.Group();
    const bk=0x1a1a1a, bn=0x2a2a2a, ey=0xccff00;
    // 3 heads
    for (const [ox,sz] of [[0,0.6],[-0.6,0.45],[0.6,0.45]]) {
        const h = box(sz*s,sz*s,sz*s, bk); h.position.set(ox*s, (ox===0?0.5:0.3)*s, 0); g.add(h);
        for (const ex of [ox-0.15, ox+0.15]) {
            g.add(glow(0.12*s,0.1*s,0.05*s, ey)).position.set(ex*s, (ox===0?0.55:0.35)*s, -(sz/2+0.02)*s);
        }
    }
    g.add(glow(0.2*s,0.06*s,0.05*s, ey)).position.set(0, 0.38*s, -0.32*s);
    for (let i=0;i<5;i++) { const w=(0.8-i*0.1)*s; const r=box(w,0.15*s,0.2*s,bn); r.position.set(0,-i*0.25*s,0); r.name=`rib${i}`; g.add(r); }
    const tail = box(0.15*s,0.15*s,0.4*s, bn); tail.position.set(0,-1.3*s,0.1*s); tail.name='tail'; g.add(tail);
    return g;
}
class Wither {
    constructor(x,y,z,scale) {
        this.scale = scale;
        this.mesh = createWitherMesh(scale);
        initBase(this, 'wither', x, y+1, z, 1.5);
    }
    update(dt, world, allMobs, px, py, pz) {
        if (!this.alive) return;
        this.time += dt;
        for (let i=0;i<5;i++) { const r=this.mesh.getObjectByName(`rib${i}`); if(r) r.position.x=Math.sin(this.time*3+i*0.8)*0.05*this.scale; }
        const tail=this.mesh.getObjectByName('tail'); if(tail) tail.rotation.y=Math.sin(this.time*2.5)*0.4;
        if (this.tamed) {
            _v.set(px-this.mesh.position.x, py-this.mesh.position.y, pz-this.mesh.position.z);
            if (_v.length()>12) { _v.normalize().multiplyScalar(4); this.velocity.copy(_v); }
            else wander(this, dt, 0.8);
        } else {
            if (!huntNearest(this, allMobs.filter(m=>m.type!=='wither'), 20, 2, dt)) wander(this, dt, 1.5);
        }
        moveAndBob(this, dt, 1.2);
        const p = this.mesh.position;
        if (p.y<22) p.y=22; if (p.y>50) p.y=50;
        faceDir(this.mesh, this.velocity.x, this.velocity.z, dt);
    }
}

// ==================== GHAST ====================
function createGhastMesh() {
    const g = new THREE.Group();
    // Main body - large white cube with bumpy texture
    g.add(box(2.2,2.2,2.2, 0xe8e8e8));
    // Cheek bumps
    g.add(box(0.3,0.3,0.15, 0xdddddd)).position.set(-0.7,0,-1.15);
    g.add(box(0.3,0.3,0.15, 0xdddddd)).position.set(0.7,0,-1.15);
    // Eyes - large sad drooping
    for (const [sx,name] of [[-0.4,'eyeL'],[0.4,'eyeR']]) {
        const eyeBg = box(0.4,0.45,0.1, 0xffffff); eyeBg.position.set(sx,0.25,-1.15); g.add(eyeBg);
        const pupil = glow(0.2,0.3,0.12, 0x111111); pupil.position.set(sx,0.2,-1.18); pupil.name=name; g.add(pupil);
        // Tear streak
        const tear = glow(0.06,0.35,0.05, 0x5555cc); tear.position.set(sx,-0.1,-1.16); tear.name=`tear_${name}`; g.add(tear);
    }
    // Mouth - dark sad frown
    g.add(glow(0.5,0.15,0.1, 0x333333)).position.set(0,-0.35,-1.15);
    g.add(glow(0.35,0.08,0.1, 0x551111)).position.set(0,-0.3,-1.13);
    // Tentacles - 9 long wavy ones
    for (let tx=-1;tx<=1;tx++) for (let tz=-1;tz<=1;tz++) {
        const tg = new THREE.Group(); tg.name=`tg${(tx+1)*3+(tz+1)}`;
        tg.position.set(tx*0.6, -1.1, tz*0.6);
        const segs = 3 + Math.floor(Math.random()*2);
        for (let s=0;s<segs;s++) {
            const w = 0.2 - s*0.03;
            const seg = box(w, 0.6, w, s===0 ? 0xcccccc : 0xbbbbbb);
            seg.position.y = -s*0.55;
            seg.name = `ts${s}`;
            tg.add(seg);
        }
        g.add(tg);
    }
    return g;
}
class Ghast {
    constructor(x,y,z) {
        this.mesh = createGhastMesh();
        initBase(this, 'ghast', x, y, z, 0.8);
    }
    update(dt) {
        if (!this.alive) return;
        this.time += dt;
        // Tentacle wave animation
        for (let i=0;i<9;i++) {
            const tg = this.mesh.getObjectByName(`tg${i}`);
            if (!tg) continue;
            tg.rotation.x = Math.sin(this.time*1.2+i*0.8)*0.12;
            tg.rotation.z = Math.cos(this.time*0.9+i*1.1)*0.08;
            for (let s=0;s<5;s++) {
                const seg = tg.getObjectByName(`ts${s}`);
                if (seg) seg.rotation.x = Math.sin(this.time*1.5+i+s*0.6)*0.1*(s+1);
            }
        }
        // Tear drip
        for (const n of ['tear_eyeL','tear_eyeR']) {
            const t = this.mesh.getObjectByName(n);
            if (t) t.position.y = -0.1 + Math.sin(this.time*2.5)*0.06;
        }
        // Eye tracking subtle
        for (const n of ['eyeL','eyeR']) {
            const e = this.mesh.getObjectByName(n);
            if (e) e.position.x += Math.sin(this.time*0.8)*0.003;
        }
        if (!this.tamed) wander(this, dt, 0.8);
        moveAndBob(this, dt, 0.8);
        const p = this.mesh.position;
        if (p.y<15) this.velocity.y=Math.abs(this.velocity.y)+0.2;
        if (p.y>45) this.velocity.y=-Math.abs(this.velocity.y)-0.2;
        faceDir(this.mesh, this.velocity.x, this.velocity.z, dt);
    }
}

// ==================== GUARDIAN ====================
function createGuardianMesh() {
    const g = new THREE.Group();
    const teal=0x3a8a7a, dark=0x2a5a5a, orange=0xdd6622;
    // Main body - rotated cube (diamond)
    const body = box(1.4,1.0,1.4, teal); body.rotation.y=Math.PI/4; g.add(body);
    // Inner body detail
    const inner = box(1.0,0.7,1.0, 0x4a9a8a); inner.rotation.y=Math.PI/4; g.add(inner);
    // Eye - large single cyclopean eye
    g.add(box(0.45,0.45,0.08, 0xf0f0f0)).position.set(0,0.05,-0.75);
    const iris = glow(0.25,0.25,0.1, orange); iris.position.set(0,0.05,-0.78); iris.name='iris'; g.add(iris);
    const pupil = glow(0.1,0.18,0.11, 0x111111); pupil.position.set(0,0.05,-0.8); pupil.name='pupil'; g.add(pupil);
    // Spikes - 12 retractable spines
    const spines = [
        [0,0.7,0], [0,-0.7,0],
        [0.8,0,0], [-0.8,0,0], [0,0,0.8], [0,0,-0.8],
        [0.5,0.4,0.5], [-0.5,0.4,-0.5], [0.5,-0.4,-0.5], [-0.5,-0.4,0.5],
        [0.5,0.4,-0.5], [-0.5,-0.4,-0.5],
    ];
    spines.forEach(([sx,sy,sz],i) => {
        const spine = box(0.12,0.35,0.12, dark);
        spine.position.set(sx,sy,sz);
        spine.lookAt(sx*3,sy*3,sz*3);
        spine.name=`sp${i}`;
        g.add(spine);
    });
    // Tail fin
    const tail = box(0.25,0.2,0.6, teal); tail.position.set(0,0,1.0); tail.name='tail'; g.add(tail);
    const tailTip = box(0.4,0.15,0.3, dark); tailTip.position.set(0,0,1.35); tailTip.name='tailTip'; g.add(tailTip);
    // Beam emitter (orange dot under eye)
    const beam = glow(0.08,0.08,0.08, 0xff8800); beam.position.set(0,-0.2,-0.75); beam.name='beam'; g.add(beam);
    return g;
}
class Guardian {
    constructor(x,y,z) {
        this.mesh = createGuardianMesh();
        initBase(this, 'guardian', x, y, z, 0.6);
    }
    update(dt, world) {
        if (!this.alive) return;
        this.time += dt;
        // Eye tracking
        const iris = this.mesh.getObjectByName('iris');
        const pupil = this.mesh.getObjectByName('pupil');
        if (iris) iris.position.x = Math.sin(this.time*1.2)*0.06;
        if (pupil) pupil.position.x = Math.sin(this.time*1.2)*0.06;
        // Spine pulse - extend/retract
        for (let i=0;i<12;i++) {
            const sp = this.mesh.getObjectByName(`sp${i}`);
            if (sp) {
                const pulse = 1 + Math.sin(this.time*2.5+i*0.5)*0.25;
                sp.scale.y = pulse;
            }
        }
        // Tail swish
        const tail = this.mesh.getObjectByName('tail');
        const tailTip = this.mesh.getObjectByName('tailTip');
        if (tail) tail.rotation.y = Math.sin(this.time*3)*0.5;
        if (tailTip) tailTip.rotation.y = Math.sin(this.time*3+0.5)*0.6;
        // Beam pulse
        const beam = this.mesh.getObjectByName('beam');
        if (beam) beam.material.opacity = 0.5 + Math.sin(this.time*4)*0.5;
        // Body slow rotation
        this.mesh.rotation.x = Math.sin(this.time*0.5)*0.05;
        if (!this.tamed) wander(this, dt, 0.6);
        moveAndBob(this, dt, 1);
        faceDir(this.mesh, this.velocity.x, this.velocity.z, dt);
        stayInWater(this, world);
    }
}

// ==================== ENDER DRAGON ====================
function createEnderDragonMesh() {
    const g = new THREE.Group();
    const bk=0x111118, dk=0x0a0a12, pu=0x6622aa, ey=0xcc44ff;

    // HEAD - angular dragon skull
    const skull = box(1.4,0.9,1.6, bk); skull.position.set(0,0.5,-2.5); g.add(skull);
    // Brow ridge
    g.add(box(1.5,0.2,0.6, dk)).position.set(0,0.95,-2.3);
    // Snout
    const snout = box(0.9,0.6,1.0, bk); snout.position.set(0,0.25,-3.3); g.add(snout);
    // Nostrils
    for (const sx of [-0.2,0.2]) g.add(glow(0.1,0.08,0.08, 0x331155)).position.set(sx,0.45,-3.82);
    // Eyes - large glowing purple
    for (const sx of [-0.4,0.4]) {
        g.add(box(0.3,0.25,0.1, 0x220044)).position.set(sx,0.7,-3.25);
        g.add(glow(0.22,0.18,0.12, ey)).position.set(sx,0.7,-3.28);
    }
    // Jaw
    const jawG = new THREE.Group(); jawG.name='jaw'; jawG.position.set(0,0,-3.0);
    jawG.add(box(0.8,0.2,0.8, dk));
    // Teeth
    for (let i=-3;i<=3;i++) {
        const t = new THREE.Mesh(new THREE.ConeGeometry(0.04,0.12,4), new THREE.MeshLambertMaterial({color:0xddddcc}));
        t.position.set(i*0.1, 0.12, -0.35); jawG.add(t);
        const t2 = t.clone(); t2.position.set(i*0.1, -0.05, -0.35); t2.rotation.x=Math.PI; jawG.add(t2);
    }
    g.add(jawG);
    // Horns - curved back
    for (const sx of [-0.45,0.45]) {
        const h1 = box(0.12,0.55,0.15, 0x333340); h1.position.set(sx,1.05,-2.2); h1.rotation.x=-0.4; g.add(h1);
        const h2 = box(0.08,0.3,0.1, 0x444450); h2.position.set(sx,1.35,-2.0); h2.rotation.x=-0.6; g.add(h2);
    }

    // NECK - 4 segments, flexible
    for (let i=0;i<4;i++) {
        const w = 0.8+i*0.15;
        const n = box(w,0.65,0.55, bk);
        n.position.set(0, 0.35-i*0.04, -1.6+i*0.45);
        n.name=`neck${i}`;
        g.add(n);
    }

    // BODY - large thorax
    g.add(box(2.2,1.4,3.2, bk)).position.set(0,0,0.5);
    // Belly (slightly lighter)
    g.add(box(1.6,0.15,2.8, 0x1a1a28)).position.set(0,-0.7,0.5);

    // Spine ridge - purple spines along back
    for (let i=0;i<8;i++) {
        const h = 0.2 + Math.sin(i/7*Math.PI)*0.25;
        const spine = box(0.12, h, 0.2, pu);
        spine.position.set(0, 0.75+h/2, -1.5+i*0.55);
        g.add(spine);
    }

    // WINGS - large with bone structure and membrane
    const wingBone = new THREE.MeshLambertMaterial({color:dk});
    const wingMem = new THREE.MeshLambertMaterial({color:pu, transparent:true, opacity:0.45, side:THREE.DoubleSide});
    for (const [sx,name] of [[-1.1,'wingL'],[1.1,'wingR']]) {
        const wg = new THREE.Group(); wg.name=name; wg.position.set(sx,0.6,0);
        const dir = sx<0 ? -1 : 1;
        // Upper arm bone
        const arm = box(2.5,0.15,0.2, 0, {color:dk}); arm.material = wingBone;
        arm.position.set(dir*1.25,0,0); wg.add(arm);
        // Forearm
        const fore = box(2.0,0.1,0.15, 0, {color:dk}); fore.material = wingBone;
        fore.position.set(dir*2.6,-0.15,0.3); fore.rotation.z=dir*0.15; wg.add(fore);
        // Membrane
        const mem1 = new THREE.Mesh(new THREE.BoxGeometry(2.8,0.04,2.0), wingMem);
        mem1.position.set(dir*1.5,-0.1,0.5); wg.add(mem1);
        const mem2 = new THREE.Mesh(new THREE.BoxGeometry(2.0,0.04,1.4), wingMem);
        mem2.position.set(dir*2.8,-0.2,0.6); wg.add(mem2);
        // Wing finger tips
        for (let f=0;f<3;f++) {
            const finger = box(0.06, 0.06, 1.0+f*0.3, dk);
            finger.position.set(dir*(1.0+f*0.7), -0.05, 1.2+f*0.15);
            wg.add(finger);
        }
        g.add(wg);
    }

    // TAIL - 5 segments tapering
    for (let i=0;i<5;i++) {
        const s = 0.7-i*0.12;
        const t = box(s, s*0.55, 0.8, bk);
        t.position.set(0, -0.1-i*0.08, 2.3+i*0.7);
        t.name=`tail${i}`;
        g.add(t);
    }
    // Tail spike
    const spike = box(0.15,0.15,0.4, pu); spike.position.set(0,-0.5,5.8); spike.name='tailSpike'; g.add(spike);

    // LEGS - front & back
    for (const [lx,lz,scale] of [[-0.7,0.0,1],[ 0.7,0.0,1],[-0.5,1.8,0.8],[0.5,1.8,0.8]]) {
        const thigh = box(0.25*scale,0.7*scale,0.25*scale, dk); thigh.position.set(lx,-0.8,lz); g.add(thigh);
        const shin = box(0.2*scale,0.5*scale,0.2*scale, dk); shin.position.set(lx,-1.25,lz+0.1); g.add(shin);
        // Claws
        for (let c=-1;c<=1;c++) {
            const claw = box(0.06*scale,0.08*scale,0.15*scale, 0x333340);
            claw.position.set(lx+c*0.08*scale, -1.5*scale+0.05, lz-0.05);
            g.add(claw);
        }
    }

    return g;
}
class EnderDragon {
    constructor(x,y,z) {
        this.mesh = createEnderDragonMesh();
        initBase(this, 'enderdragon', x, y, z, 0);
        this.hp = 100;
        this.orbitAngle = 0;
        this.orbitCenter = new THREE.Vector3(x, 0, z);
        this.jawOpen = 0;
    }
    update(dt) {
        if (!this.alive) return;
        this.time += dt;
        // Wing flap
        const wL=this.mesh.getObjectByName('wingL'), wR=this.mesh.getObjectByName('wingR');
        if (wL) wL.rotation.z = Math.sin(this.time*2.5)*0.55;
        if (wR) wR.rotation.z = -Math.sin(this.time*2.5)*0.55;
        // Tail wave
        for (let i=0;i<5;i++) {
            const t=this.mesh.getObjectByName(`tail${i}`);
            if(t) t.position.x = Math.sin(this.time*1.8+i*0.7)*0.12*(i+1);
        }
        const spike = this.mesh.getObjectByName('tailSpike');
        if (spike) spike.position.x = Math.sin(this.time*1.8+4)*0.5;
        // Neck wave
        for (let i=0;i<4;i++) {
            const n=this.mesh.getObjectByName(`neck${i}`);
            if(n) n.position.x = Math.sin(this.time*1.5+i*0.4)*0.06*(i+1);
        }
        // Jaw open/close
        const jaw = this.mesh.getObjectByName('jaw');
        if (jaw) {
            this.jawOpen = Math.max(0, Math.sin(this.time*0.8)*0.15);
            jaw.position.y = -this.jawOpen;
            jaw.rotation.x = this.jawOpen * 0.5;
        }
        // Orbit flight
        this.orbitAngle += dt * 0.3;
        const p = this.mesh.position;
        const tx = this.orbitCenter.x + Math.cos(this.orbitAngle)*25;
        const tz = this.orbitCenter.z + Math.sin(this.orbitAngle)*25;
        const ty = 35 + Math.sin(this.time*0.5)*5;
        p.x += (tx-p.x)*dt*2; p.y += (ty-p.y)*dt*2; p.z += (tz-p.z)*dt*2;
        this.mesh.rotation.y = this.orbitAngle + Math.PI/2;
        this.mesh.rotation.z = Math.sin(this.orbitAngle)*0.12;
        // Slight pitch during flight
        this.mesh.rotation.x = Math.sin(this.time*0.5)*0.05;
    }
    takeDamage(n) { this.hp -= n; if (this.hp<=0) this.alive=false; }
}

// ==================== ENTITY MANAGER ====================
export class EntityManager {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        this.entities = [];
        this.timers = { clione:0, meowl:0, bloop:0, ghast:5, guardian:8 };
        this.max = { clione:12, meowl:3, bloop:2, ghast:2, guardian:2 };
        this.dragonSpawned = false;
    }

    spawn(Type, x, y, z, ...args) {
        const e = new Type(x, y, z, ...args);
        this.entities.push(e);
        this.scene.add(e.mesh);
        return e;
    }
    spawnClione(x,y,z) { return this.spawn(Clione,x,y,z); }
    spawnMaja(x,y,z) { return this.spawn(ElGranMaja,x,y,z); }
    spawnWither(x,y,z,s) { return this.spawn(Wither,x,y,z,s); }
    spawnGhast(x,y,z) { return this.spawn(Ghast,x,y,z); }
    spawnGuardian(x,y,z) { return this.spawn(Guardian,x,y,z); }
    spawnEnderDragon(x,y,z) { return this.spawn(EnderDragon,x,y,z); }

    _trySpawnInWater(px, pz, Type, type) {
        let c=0; for (const e of this.entities) if(e.type===type && e.alive) c++;
        if (c >= this.max[type]) return;
        const a=Math.random()*Math.PI*2, d=10+Math.random()*20;
        const sx=Math.floor(px+Math.cos(a)*d), sz=Math.floor(pz+Math.sin(a)*d);
        for (let y=10;y<=18;y++) if (this.world.getBlock(sx,y,sz)===BlockType.WATER) { this.spawn(Type,sx,y,sz); return; }
    }

    update(dt, px, py, pz, dimension) {
        // Dimension spawning
        if (dimension === 'overworld') {
            this.timers.clione -= dt;
            if (this.timers.clione<=0) { this._trySpawnInWater(px,pz,Clione,'clione'); this.timers.clione=2; }
            this.timers.meowl -= dt;
            if (this.timers.meowl<=0) {
                let c=0; for(const e of this.entities) if(e.type==='meowl'&&e.alive) c++;
                if (c<this.max.meowl) { const a=Math.random()*Math.PI*2, d=15+Math.random()*20; this.spawn(Meowl, px+Math.cos(a)*d, 30+Math.random()*15, pz+Math.sin(a)*d); }
                this.timers.meowl = 6+Math.random()*6;
            }
            this.timers.bloop -= dt;
            if (this.timers.bloop<=0) { this._trySpawnInWater(px,pz,Bloop,'bloop'); this.timers.bloop=10+Math.random()*10; }
            this.timers.guardian -= dt;
            if (this.timers.guardian<=0) { this._trySpawnInWater(px,pz,Guardian,'guardian'); this.timers.guardian=12+Math.random()*10; }
        } else if (dimension === 'nether') {
            this.timers.ghast -= dt;
            if (this.timers.ghast<=0) {
                let c=0; for(const e of this.entities) if(e.type==='ghast'&&e.alive) c++;
                if (c<this.max.ghast) { const a=Math.random()*Math.PI*2, d=15+Math.random()*20; this.spawn(Ghast, px+Math.cos(a)*d, 25+Math.random()*15, pz+Math.sin(a)*d); }
                this.timers.ghast = 8+Math.random()*8;
            }
        } else if (dimension === 'ender') {
            if (!this.dragonSpawned) { this.spawnEnderDragon(px, 35, pz); this.dragonSpawned = true; }
        }

        // Build helper lists
        const cliones=[], majas=[];
        for (const e of this.entities) { if(!e.alive) continue; if(e.type==='clione') cliones.push(e); else if(e.type==='maja') majas.push(e); }

        // Clean dead
        let w=0;
        for (let i=0;i<this.entities.length;i++) {
            if (!this.entities[i].alive) { this.scene.remove(this.entities[i].mesh); continue; }
            this.entities[w++] = this.entities[i];
        }
        this.entities.length = w;

        // Update
        for (let i=this.entities.length-1; i>=0; i--) {
            const e = this.entities[i];
            if (e.type==='maja') e.update(dt, this.world, cliones);
            else if (e.type==='bloop') e.update(dt, this.world, cliones, majas);
            else if (e.type==='wither') e.update(dt, this.world, this.entities, px, py, pz);
            else if (e.type==='guardian') e.update(dt, this.world);
            else if (e.type==='ghast'||e.type==='meowl'||e.type==='enderdragon') e.update(dt);
            else e.update(dt, this.world);

            // Despawn
            if (e.type==='enderdragon' || e.tamed) continue;
            const dx=e.mesh.position.x-px, dz=e.mesh.position.z-pz;
            const maxD = (e.type==='wither'||e.type==='ghast') ? 120 : (e.type==='maja'||e.type==='bloop'||e.type==='guardian'||e.type==='meowl') ? 80 : 50;
            if (dx*dx+dz*dz > maxD*maxD) { this.scene.remove(e.mesh); this.entities[i]=this.entities[this.entities.length-1]; this.entities.pop(); }
        }
    }
}
