// Multiplayer using PeerJS (WebRTC P2P)
// Same seed = same terrain, sync player positions + block changes

import * as THREE from 'three';

export class Multiplayer {
    constructor(scene) {
        this.scene = scene;
        this.peer = null;
        this.connections = new Map(); // peerId -> connection
        this.remotePlayers = new Map(); // peerId -> mesh
        this.onBlockChange = null; // callback(x, y, z, type)
        this.localPosition = { x: 0, y: 0, z: 0, yaw: 0 };
        this.isHost = false;
        this.roomId = null;
        this.connected = false;
    }

    async host() {
        return new Promise((resolve, reject) => {
            const id = 'mc-' + Math.random().toString(36).substring(2, 8);
            this.peer = new Peer(id);
            this.isHost = true;

            this.peer.on('open', (peerId) => {
                this.roomId = peerId;
                this.connected = true;
                resolve(peerId);
            });

            this.peer.on('connection', (conn) => {
                this._setupConnection(conn);
            });

            this.peer.on('error', (err) => reject(err));
        });
    }

    async join(roomId) {
        return new Promise((resolve, reject) => {
            this.peer = new Peer();
            this.isHost = false;

            this.peer.on('open', () => {
                const conn = this.peer.connect(roomId, { reliable: true });
                conn.on('open', () => {
                    this._setupConnection(conn);
                    this.connected = true;
                    this.roomId = roomId;
                    resolve(roomId);
                });
                conn.on('error', (err) => reject(err));
            });

            this.peer.on('error', (err) => reject(err));
        });
    }

    _setupConnection(conn) {
        const peerId = conn.peer;
        this.connections.set(peerId, conn);

        // Create remote player mesh
        const playerMesh = this._createPlayerMesh();
        this.scene.add(playerMesh);
        this.remotePlayers.set(peerId, playerMesh);

        conn.on('data', (data) => {
            if (data.type === 'position') {
                const mesh = this.remotePlayers.get(peerId);
                if (mesh) {
                    mesh.position.set(data.x, data.y - 0.8, data.z);
                    mesh.rotation.y = data.yaw;
                }
            } else if (data.type === 'block') {
                if (this.onBlockChange) {
                    this.onBlockChange(data.x, data.y, data.z, data.blockType, true);
                }
            }
        });

        conn.on('close', () => {
            const mesh = this.remotePlayers.get(peerId);
            if (mesh) this.scene.remove(mesh);
            this.remotePlayers.delete(peerId);
            this.connections.delete(peerId);
        });

        // If host, relay new connection to existing peers
        if (this.isHost) {
            for (const [existingId, existingConn] of this.connections) {
                if (existingId !== peerId) {
                    existingConn.send({ type: 'newPeer', peerId });
                }
            }
        }
    }

    _createPlayerMesh() {
        const group = new THREE.Group();
        const color = Math.random() * 0xffffff;

        // Body
        const body = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 0.8, 0.3),
            new THREE.MeshLambertMaterial({ color })
        );
        body.position.y = 0.4;
        group.add(body);

        // Head
        const head = new THREE.Mesh(
            new THREE.BoxGeometry(0.4, 0.4, 0.4),
            new THREE.MeshLambertMaterial({ color: 0xffcc88 })
        );
        head.position.y = 1.0;
        group.add(head);

        // Eyes
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
        const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.05), eyeMat);
        eyeL.position.set(-0.1, 1.05, -0.2);
        group.add(eyeL);
        const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.05), eyeMat);
        eyeR.position.set(0.1, 1.05, -0.2);
        group.add(eyeR);

        // Arms
        const armMat = new THREE.MeshLambertMaterial({ color });
        const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.25), armMat);
        armL.position.set(-0.35, 0.35, 0);
        group.add(armL);
        const armR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.25), armMat);
        armR.position.set(0.35, 0.35, 0);
        group.add(armR);

        // Legs
        const legMat = new THREE.MeshLambertMaterial({ color: 0x333366 });
        const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.25), legMat);
        legL.position.set(-0.12, -0.3, 0);
        group.add(legL);
        const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.25), legMat);
        legR.position.set(0.12, -0.3, 0);
        group.add(legR);

        // Name tag
        return group;
    }

    sendPosition(x, y, z, yaw) {
        this.localPosition = { x, y, z, yaw };
        const data = { type: 'position', x, y, z, yaw };
        for (const conn of this.connections.values()) {
            if (conn.open) conn.send(data);
        }
    }

    sendBlockChange(x, y, z, blockType) {
        const data = { type: 'block', x, y, z, blockType };
        for (const conn of this.connections.values()) {
            if (conn.open) conn.send(data);
        }
    }

    getPlayerCount() {
        return this.connections.size + 1;
    }

    destroy() {
        for (const mesh of this.remotePlayers.values()) {
            this.scene.remove(mesh);
        }
        this.remotePlayers.clear();
        this.connections.clear();
        if (this.peer) this.peer.destroy();
    }
}
