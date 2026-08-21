import * as THREE from 'three';
import { SimplexNoise } from './noise.js';
import { BlockType, isTransparent, isSolid } from './blocks.js';

export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 64;
const WATER_LEVEL = 18;
const SEA_LEVEL = 20;

export class World {
    constructor(scene, blockMaterials, seed = 42) {
        this.scene = scene;
        this.blockMaterials = blockMaterials;
        this.chunks = new Map();
        this.noise = new SimplexNoise(seed);
        this.renderDistance = 3;
        this.dimension = 'overworld'; // 'overworld' or 'nether'
    }

    switchDimension(newDimension) {
        // Clear all chunks
        for (const [key, chunk] of this.chunks) {
            for (const m of chunk.meshes) {
                this.scene.remove(m);
                if (m.geometry) m.geometry.dispose();
            }
        }
        this.chunks.clear();
        this.dimension = newDimension;
    }

    getChunkKey(cx, cz) {
        return `${cx},${cz}`;
    }

    // Get terrain height at world x, z
    getHeight(wx, wz) {
        const scale1 = 0.01, scale2 = 0.03, scale3 = 0.005;
        const n1 = this.noise.fbm(wx * scale1, wz * scale1, 4) * 20;
        const n2 = this.noise.fbm(wx * scale2, wz * scale2, 2) * 8;
        const n3 = this.noise.fbm(wx * scale3, wz * scale3, 3) * 10;
        return Math.floor(SEA_LEVEL + n1 + n2 + n3);
    }

    generateChunkData(cx, cz) {
        if (this.dimension === 'nether') return this._generateNetherChunk(cx, cz);
        return this._generateOverworldChunk(cx, cz);
    }

    _generateOverworldChunk(cx, cz) {
        const data = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
        const ox = cx * CHUNK_SIZE, oz = cz * CHUNK_SIZE;

        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                const wx = ox + x, wz = oz + z;
                const height = Math.min(this.getHeight(wx, wz), CHUNK_HEIGHT - 1);

                for (let y = 0; y <= height; y++) {
                    let block;
                    if (y === height) {
                        block = height <= WATER_LEVEL + 1 ? BlockType.SAND : BlockType.GRASS;
                    } else if (y > height - 4) {
                        block = height <= WATER_LEVEL + 1 ? BlockType.SAND : BlockType.DIRT;
                    } else {
                        block = BlockType.STONE;
                    }
                    data[x * CHUNK_HEIGHT * CHUNK_SIZE + y * CHUNK_SIZE + z] = block;
                }
                for (let y = height + 1; y <= WATER_LEVEL; y++) {
                    data[x * CHUNK_HEIGHT * CHUNK_SIZE + y * CHUNK_SIZE + z] = BlockType.WATER;
                }
                if (height > WATER_LEVEL + 2 && Math.random() < 0.005 &&
                    x > 2 && x < CHUNK_SIZE - 3 && z > 2 && z < CHUNK_SIZE - 3) {
                    const treeH = 4 + Math.floor(Math.random() * 3);
                    for (let ty = 1; ty <= treeH; ty++) {
                        const by = height + ty;
                        if (by < CHUNK_HEIGHT) data[x * CHUNK_HEIGHT * CHUNK_SIZE + by * CHUNK_SIZE + z] = BlockType.WOOD;
                    }
                    const leafStart = height + treeH - 1, leafEnd = height + treeH + 2;
                    for (let lx = -2; lx <= 2; lx++) for (let lz = -2; lz <= 2; lz++) for (let ly = leafStart; ly <= leafEnd; ly++) {
                        if (ly >= CHUNK_HEIGHT) continue;
                        const nx = x + lx, nz = z + lz;
                        if (nx < 0 || nx >= CHUNK_SIZE || nz < 0 || nz >= CHUNK_SIZE) continue;
                        if (Math.abs(lx) + Math.abs(lz) + (ly - leafEnd) > 3) continue;
                        const idx = nx * CHUNK_HEIGHT * CHUNK_SIZE + ly * CHUNK_SIZE + nz;
                        if (data[idx] === BlockType.AIR) data[idx] = BlockType.LEAVES;
                    }
                }
            }
        }
        return data;
    }

    _generateNetherChunk(cx, cz) {
        const data = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
        const ox = cx * CHUNK_SIZE, oz = cz * CHUNK_SIZE;
        const LAVA_LEVEL = 12;
        const CEILING = 50;

        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                const wx = ox + x, wz = oz + z;
                // Nether floor - rough terrain
                const floorH = Math.floor(15 + this.noise.fbm(wx * 0.04, wz * 0.04, 3) * 10);
                // Nether ceiling
                const ceilH = Math.floor(CEILING - 3 + this.noise.fbm(wx * 0.03 + 100, wz * 0.03 + 100, 2) * 5);

                // Floor
                for (let y = 0; y <= Math.min(floorH, CHUNK_HEIGHT - 1); y++) {
                    if (y < 3) {
                        data[x * CHUNK_HEIGHT * CHUNK_SIZE + y * CHUNK_SIZE + z] = BlockType.OBSIDIAN;
                    } else {
                        data[x * CHUNK_HEIGHT * CHUNK_SIZE + y * CHUNK_SIZE + z] = BlockType.NETHERRACK;
                    }
                }

                // Lava fill in low areas
                for (let y = floorH + 1; y <= LAVA_LEVEL; y++) {
                    if (y < CHUNK_HEIGHT) data[x * CHUNK_HEIGHT * CHUNK_SIZE + y * CHUNK_SIZE + z] = BlockType.LAVA;
                }

                // Ceiling
                for (let y = Math.max(ceilH, 0); y < CHUNK_HEIGHT; y++) {
                    data[x * CHUNK_HEIGHT * CHUNK_SIZE + y * CHUNK_SIZE + z] = BlockType.NETHERRACK;
                }

                // Glowstone clusters on ceiling
                if (Math.random() < 0.02 && ceilH > 30) {
                    for (let gy = ceilH - 1; gy >= ceilH - 3 && gy > 0; gy--) {
                        data[x * CHUNK_HEIGHT * CHUNK_SIZE + gy * CHUNK_SIZE + z] = BlockType.GLOWSTONE;
                    }
                }

                // Soul dirt patches on floor
                if (floorH > LAVA_LEVEL && Math.random() < 0.08) {
                    data[x * CHUNK_HEIGHT * CHUNK_SIZE + floorH * CHUNK_SIZE + z] = BlockType.SOUL_DIRT;
                }
            }
        }
        return data;
    }

    getBlock(wx, wy, wz) {
        if (wy < 0 || wy >= CHUNK_HEIGHT) return BlockType.AIR;
        const cx = Math.floor(wx / CHUNK_SIZE);
        const cz = Math.floor(wz / CHUNK_SIZE);
        const key = this.getChunkKey(cx, cz);
        const chunk = this.chunks.get(key);
        if (!chunk) return BlockType.AIR;
        const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        return chunk.data[lx * CHUNK_HEIGHT * CHUNK_SIZE + wy * CHUNK_SIZE + lz];
    }

    setBlock(wx, wy, wz, type) {
        if (wy < 0 || wy >= CHUNK_HEIGHT) return;
        const cx = Math.floor(wx / CHUNK_SIZE);
        const cz = Math.floor(wz / CHUNK_SIZE);
        const key = this.getChunkKey(cx, cz);
        const chunk = this.chunks.get(key);
        if (!chunk) return;
        const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        chunk.data[lx * CHUNK_HEIGHT * CHUNK_SIZE + wy * CHUNK_SIZE + lz] = type;
        this.rebuildChunkMesh(cx, cz);
        // Rebuild neighbors if on edge
        if (lx === 0) this.rebuildChunkMesh(cx - 1, cz);
        if (lx === CHUNK_SIZE - 1) this.rebuildChunkMesh(cx + 1, cz);
        if (lz === 0) this.rebuildChunkMesh(cx, cz - 1);
        if (lz === CHUNK_SIZE - 1) this.rebuildChunkMesh(cx, cz + 1);
    }

    buildChunkMesh(cx, cz) {
        const key = this.getChunkKey(cx, cz);
        let chunk = this.chunks.get(key);
        if (!chunk) {
            const data = this.generateChunkData(cx, cz);
            chunk = { data, meshes: [] };
            this.chunks.set(key, chunk);
        }
        this._buildMesh(cx, cz, chunk);
    }

    rebuildChunkMesh(cx, cz) {
        const key = this.getChunkKey(cx, cz);
        const chunk = this.chunks.get(key);
        if (!chunk) return;
        // Remove old meshes
        for (const m of chunk.meshes) this.scene.remove(m);
        chunk.meshes = [];
        this._buildMesh(cx, cz, chunk);
    }

    _buildMesh(cx, cz, chunk) {
        const ox = cx * CHUNK_SIZE, oz = cz * CHUNK_SIZE;
        // Group geometry by block type and face
        const geometries = {}; // { blockType: { top: [], bottom: [], side: [] } }

        const faceChecks = [
            { dir: [0, 1, 0], face: 'top' },
            { dir: [0, -1, 0], face: 'bottom' },
            { dir: [1, 0, 0], face: 'side' },
            { dir: [-1, 0, 0], face: 'side' },
            { dir: [0, 0, 1], face: 'side' },
            { dir: [0, 0, -1], face: 'side' },
        ];

        // Pre-build face geometries
        const faceGeos = this._createFaceGeometries();

        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let y = 0; y < CHUNK_HEIGHT; y++) {
                for (let z = 0; z < CHUNK_SIZE; z++) {
                    const block = chunk.data[x * CHUNK_HEIGHT * CHUNK_SIZE + y * CHUNK_SIZE + z];
                    if (block === BlockType.AIR) continue;

                    for (let f = 0; f < 6; f++) {
                        const [dx, dy, dz] = faceChecks[f].dir;
                        const nx = x + dx, ny = y + dy, nz = z + dz;
                        let neighbor;
                        if (nx < 0 || nx >= CHUNK_SIZE || nz < 0 || nz >= CHUNK_SIZE) {
                            neighbor = this.getBlock(ox + nx, ny, oz + nz);
                        } else if (ny < 0 || ny >= CHUNK_HEIGHT) {
                            neighbor = BlockType.AIR;
                        } else {
                            neighbor = chunk.data[nx * CHUNK_HEIGHT * CHUNK_SIZE + ny * CHUNK_SIZE + nz];
                        }

                        if (!isTransparent(neighbor) || (neighbor === block)) continue;

                        const faceType = faceChecks[f].face;
                        if (!geometries[block]) geometries[block] = { top: [], bottom: [], side: [] };

                        const geo = faceGeos[f].clone();
                        geo.translate(ox + x, y, oz + z);
                        geometries[block][faceType].push(geo);
                    }
                }
            }
        }

        // Merge and create meshes
        for (const blockType in geometries) {
            const bt = parseInt(blockType);
            const mats = this.blockMaterials[bt];
            if (!mats) continue;
            for (const faceType of ['top', 'bottom', 'side']) {
                const geos = geometries[bt][faceType];
                if (geos.length === 0) continue;
                const merged = this._mergeGeometries(geos);
                if (!merged) continue;
                const mesh = new THREE.Mesh(merged, mats[faceType]);
                mesh.castShadow = false;
                mesh.receiveShadow = true;
                this.scene.add(mesh);
                chunk.meshes.push(mesh);
                // Dispose individual geometries
                for (const g of geos) g.dispose();
            }
        }
    }

    _createFaceGeometries() {
        const h = 0.5;
        const faces = [];
        // top (y+1)
        const topGeo = new THREE.BufferGeometry();
        topGeo.setAttribute('position', new THREE.Float32BufferAttribute([
            -h,h,-h, h,h,-h, h,h,h, -h,h,h
        ], 3));
        topGeo.setAttribute('uv', new THREE.Float32BufferAttribute([0,1,1,1,1,0,0,0], 2));
        topGeo.setIndex([0,2,1,0,3,2]);
        topGeo.computeVertexNormals();
        faces.push(topGeo);

        // bottom (y-1)
        const botGeo = new THREE.BufferGeometry();
        botGeo.setAttribute('position', new THREE.Float32BufferAttribute([
            -h,-h,-h, h,-h,-h, h,-h,h, -h,-h,h
        ], 3));
        botGeo.setAttribute('uv', new THREE.Float32BufferAttribute([0,1,1,1,1,0,0,0], 2));
        botGeo.setIndex([0,1,2,0,2,3]);
        botGeo.computeVertexNormals();
        faces.push(botGeo);

        // right (x+1)
        const rightGeo = new THREE.BufferGeometry();
        rightGeo.setAttribute('position', new THREE.Float32BufferAttribute([
            h,-h,-h, h,h,-h, h,h,h, h,-h,h
        ], 3));
        rightGeo.setAttribute('uv', new THREE.Float32BufferAttribute([0,0,0,1,1,1,1,0], 2));
        rightGeo.setIndex([0,1,2,0,2,3]);
        rightGeo.computeVertexNormals();
        faces.push(rightGeo);

        // left (x-1)
        const leftGeo = new THREE.BufferGeometry();
        leftGeo.setAttribute('position', new THREE.Float32BufferAttribute([
            -h,-h,-h, -h,h,-h, -h,h,h, -h,-h,h
        ], 3));
        leftGeo.setAttribute('uv', new THREE.Float32BufferAttribute([1,0,1,1,0,1,0,0], 2));
        leftGeo.setIndex([0,2,1,0,3,2]);
        leftGeo.computeVertexNormals();
        faces.push(leftGeo);

        // front (z+1)
        const frontGeo = new THREE.BufferGeometry();
        frontGeo.setAttribute('position', new THREE.Float32BufferAttribute([
            -h,-h,h, h,-h,h, h,h,h, -h,h,h
        ], 3));
        frontGeo.setAttribute('uv', new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1], 2));
        frontGeo.setIndex([0,1,2,0,2,3]);
        frontGeo.computeVertexNormals();
        faces.push(frontGeo);

        // back (z-1)
        const backGeo = new THREE.BufferGeometry();
        backGeo.setAttribute('position', new THREE.Float32BufferAttribute([
            -h,-h,-h, h,-h,-h, h,h,-h, -h,h,-h
        ], 3));
        backGeo.setAttribute('uv', new THREE.Float32BufferAttribute([1,0,0,0,0,1,1,1], 2));
        backGeo.setIndex([0,2,1,0,3,2]);
        backGeo.computeVertexNormals();
        faces.push(backGeo);

        return faces;
    }

    _mergeGeometries(geometries) {
        if (geometries.length === 0) return null;
        let totalVerts = 0, totalIndices = 0;
        for (const g of geometries) {
            totalVerts += g.attributes.position.count;
            totalIndices += g.index.count;
        }
        const positions = new Float32Array(totalVerts * 3);
        const uvs = new Float32Array(totalVerts * 2);
        const normals = new Float32Array(totalVerts * 3);
        const indices = new Uint32Array(totalIndices);
        let vOffset = 0, iOffset = 0, indexOffset = 0;
        for (const g of geometries) {
            const pos = g.attributes.position.array;
            const uv = g.attributes.uv.array;
            const norm = g.attributes.normal.array;
            const idx = g.index.array;
            positions.set(pos, vOffset * 3);
            normals.set(norm, vOffset * 3);
            uvs.set(uv, vOffset * 2);
            for (let i = 0; i < idx.length; i++) {
                indices[iOffset + i] = idx[i] + vOffset;
            }
            vOffset += g.attributes.position.count;
            iOffset += idx.length;
        }
        const merged = new THREE.BufferGeometry();
        merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
        merged.setIndex(new THREE.BufferAttribute(indices, 1));
        return merged;
    }

    update(playerX, playerZ) {
        const pcx = Math.floor(playerX / CHUNK_SIZE);
        const pcz = Math.floor(playerZ / CHUNK_SIZE);
        const rd = this.renderDistance;

        // Load needed chunks
        for (let x = pcx - rd; x <= pcx + rd; x++) {
            for (let z = pcz - rd; z <= pcz + rd; z++) {
                const key = this.getChunkKey(x, z);
                if (!this.chunks.has(key)) {
                    this.buildChunkMesh(x, z);
                }
            }
        }

        // Unload far chunks
        for (const [key, chunk] of this.chunks) {
            const [kx, kz] = key.split(',').map(Number);
            if (Math.abs(kx - pcx) > rd + 1 || Math.abs(kz - pcz) > rd + 1) {
                for (const m of chunk.meshes) {
                    this.scene.remove(m);
                    if (m.geometry) m.geometry.dispose();
                }
                this.chunks.delete(key);
            }
        }
    }

    // Raycast for block interaction
    raycast(origin, direction, maxDist = 8) {
        const step = 0.05;
        const pos = origin.clone();
        const dir = direction.clone().normalize().multiplyScalar(step);
        let prevX, prevY, prevZ;

        for (let d = 0; d < maxDist; d += step) {
            const bx = Math.floor(pos.x + 0.5);
            const by = Math.floor(pos.y + 0.5);
            const bz = Math.floor(pos.z + 0.5);
            const block = this.getBlock(bx, by, bz);

            if (block !== BlockType.AIR && block !== BlockType.WATER) {
                return {
                    x: bx, y: by, z: bz,
                    block,
                    placeX: prevX, placeY: prevY, placeZ: prevZ
                };
            }
            prevX = bx; prevY = by; prevZ = bz;
            pos.add(dir);
        }
        return null;
    }
}
