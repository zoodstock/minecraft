import * as THREE from 'three';

// Block type definitions
export const BlockType = {
    AIR: 0,
    GRASS: 1,
    DIRT: 2,
    STONE: 3,
    WOOD: 4,
    LEAVES: 5,
    SAND: 6,
    WATER: 7,
};

export const BLOCK_NAMES = {
    [BlockType.GRASS]: 'Grass',
    [BlockType.DIRT]: 'Dirt',
    [BlockType.STONE]: 'Stone',
    [BlockType.WOOD]: 'Wood',
    [BlockType.LEAVES]: 'Leaves',
    [BlockType.SAND]: 'Sand',
    [BlockType.WATER]: 'Water',
};

export const PLACEABLE_BLOCKS = [
    BlockType.GRASS, BlockType.DIRT, BlockType.STONE,
    BlockType.WOOD, BlockType.LEAVES, BlockType.SAND, BlockType.WATER
];

// Generate procedural textures using canvas
function createTexture(draw, size = 16) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    draw(ctx, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    return tex;
}

function addNoise(ctx, size, baseColor, variance = 20) {
    const [r, g, b] = baseColor;
    for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
            const v = (Math.random() - 0.5) * variance;
            ctx.fillStyle = `rgb(${r + v},${g + v},${b + v})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }
}

export function createBlockTextures() {
    const textures = {};

    // Grass top
    const grassTop = createTexture((ctx, s) => addNoise(ctx, s, [76, 153, 0], 25));
    // Grass side
    const grassSide = createTexture((ctx, s) => {
        addNoise(ctx, s, [139, 90, 43], 15);
        for (let x = 0; x < s; x++) {
            for (let y = 0; y < 4; y++) {
                const v = (Math.random() - 0.5) * 25;
                ctx.fillStyle = `rgb(${76 + v},${153 + v},${0 + v})`;
                ctx.fillRect(x, y, 1, 1);
            }
        }
    });
    // Dirt
    const dirt = createTexture((ctx, s) => addNoise(ctx, s, [139, 90, 43], 15));
    // Stone
    const stone = createTexture((ctx, s) => addNoise(ctx, s, [128, 128, 128], 20));
    // Wood side
    const woodSide = createTexture((ctx, s) => {
        addNoise(ctx, s, [101, 67, 33], 12);
        for (let y = 0; y < s; y += 3) {
            ctx.fillStyle = 'rgba(60,40,20,0.3)';
            ctx.fillRect(0, y, s, 1);
        }
    });
    // Wood top
    const woodTop = createTexture((ctx, s) => {
        addNoise(ctx, s, [120, 80, 40], 15);
        ctx.strokeStyle = 'rgba(80,50,20,0.5)';
        ctx.beginPath();
        ctx.arc(s / 2, s / 2, 4, 0, Math.PI * 2);
        ctx.stroke();
    });
    // Leaves
    const leaves = createTexture((ctx, s) => addNoise(ctx, s, [34, 120, 15], 30));
    // Sand
    const sand = createTexture((ctx, s) => addNoise(ctx, s, [210, 190, 130], 18));
    // Water
    const water = createTexture((ctx, s) => addNoise(ctx, s, [30, 100, 200], 20));

    textures[BlockType.GRASS] = { top: grassTop, bottom: dirt, side: grassSide };
    textures[BlockType.DIRT] = { top: dirt, bottom: dirt, side: dirt };
    textures[BlockType.STONE] = { top: stone, bottom: stone, side: stone };
    textures[BlockType.WOOD] = { top: woodTop, bottom: woodTop, side: woodSide };
    textures[BlockType.LEAVES] = { top: leaves, bottom: leaves, side: leaves };
    textures[BlockType.SAND] = { top: sand, bottom: sand, side: sand };
    textures[BlockType.WATER] = { top: water, bottom: water, side: water };

    return textures;
}

// Create materials for each block face
export function createBlockMaterials(textures) {
    const materials = {};
    for (const type of PLACEABLE_BLOCKS) {
        const tex = textures[type];
        const transparent = type === BlockType.WATER || type === BlockType.LEAVES;
        const opacity = type === BlockType.WATER ? 0.7 : (type === BlockType.LEAVES ? 0.9 : 1.0);
        materials[type] = {
            top: new THREE.MeshLambertMaterial({ map: tex.top, transparent, opacity }),
            bottom: new THREE.MeshLambertMaterial({ map: tex.bottom, transparent, opacity }),
            side: new THREE.MeshLambertMaterial({ map: tex.side, transparent, opacity }),
        };
    }
    return materials;
}

export function isTransparent(blockType) {
    return blockType === BlockType.AIR || blockType === BlockType.WATER || blockType === BlockType.LEAVES;
}

export function isSolid(blockType) {
    return blockType !== BlockType.AIR && blockType !== BlockType.WATER;
}
