class ArenaMap extends GameObject3D {
    constructor(scene) {
        super(scene);
        this.name = 'ArenaMap';
        this.colliders = [];
        this.redSpawns = [];
        this.blueSpawns = [];
        this.coverPositions = [];
        this.buyPillars = [];
        this._particleTime = 0;
        this.createMap();
    }

    createMap() {
        this.mesh = new THREE.Group();

        // ── Materials ─────────────────────────────────────────────────────────
        const floorMat  = new THREE.MeshStandardMaterial({ color: 0x14151a, roughness: 0.95, metalness: 0.0 });
        const wallMat   = new THREE.MeshStandardMaterial({ color: 0x1e2128, roughness: 0.80, metalness: 0.1 });
        const trimMat   = new THREE.MeshStandardMaterial({ color: 0x2e3240, roughness: 0.5,  metalness: 0.5, emissive: 0x0a0d18, emissiveIntensity: 0.3 });
        const concMat   = new THREE.MeshStandardMaterial({ color: 0x282c38, roughness: 0.90, metalness: 0.05 });
        const steelMat  = new THREE.MeshStandardMaterial({ color: 0x323844, roughness: 0.45, metalness: 0.75 });
        const redMat    = new THREE.MeshStandardMaterial({ color: 0x3a0c0c, roughness: 0.9, emissive: 0x440000, emissiveIntensity: 0.25 });
        const blueMat   = new THREE.MeshStandardMaterial({ color: 0x0c0c3a, roughness: 0.9, emissive: 0x000044, emissiveIntensity: 0.25 });

        // ── Floor ─────────────────────────────────────────────────────────────
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.mesh.add(floor);

        // Subtle grid overlay
        const grid = new THREE.GridHelper(80, 40, 0x1e2230, 0x191c28);
        grid.position.y = 0.005;
        this.mesh.add(grid);

        // ── Outer Boundary Walls ──────────────────────────────────────────────
        const H = 7, T = 1, half = 40;
        this._addWallWithTrim(0,  H/2, -half, 80, H, T, wallMat, trimMat);
        this._addWallWithTrim(0,  H/2,  half, 80, H, T, wallMat, trimMat);
        this._addWallWithTrim(-half, H/2, 0, T, H, 80, wallMat, trimMat);
        this._addWallWithTrim( half, H/2, 0, T, H, 80, wallMat, trimMat);

        // ── Spawn Zones (A-site = red right, B-site = blue left) ─────────────
        const redPad  = new THREE.Mesh(new THREE.PlaneGeometry(16, 20), redMat);
        redPad.rotation.x = -Math.PI / 2;
        redPad.position.set(33, 0.02, 0);
        this.mesh.add(redPad);

        const bluePad = new THREE.Mesh(new THREE.PlaneGeometry(16, 20), blueMat);
        bluePad.rotation.x = -Math.PI / 2;
        bluePad.position.set(-33, 0.02, 0);
        this.mesh.add(bluePad);

        // Spawn zone ring markers
        this._addFloorRing( 33, 0, 9, 12, 0xff2222, 0.04);
        this._addFloorRing(-33, 0, 9, 12, 0x2244ff, 0.04);

        // Spawn lights
        this.mesh.add(Object.assign(new THREE.PointLight(0xff3322, 2.5, 22), { position: new THREE.Vector3(33, 5, 0) }));
        this.mesh.add(Object.assign(new THREE.PointLight(0x2244ff, 2.5, 22), { position: new THREE.Vector3(-33, 5, 0) }));

        // ── Spawn Gates ───────────────────────────────────────────────────────
        this._buildSpawnGate( 38, 0, 'red');
        this._buildSpawnGate(-38, 0, 'blue');

        // ── MID — Central Control Building (walkthrough structure) ────────────
        // Main building box with open doorways (three separate wall segments)
        this.addWall( 0, 2.5,  0, 8, 5, 1.5, steelMat);   // front face
        this.addWall( 0, 2.5,  0, 8, 5, 1.5, steelMat);   // (symmetric)
        // Left and right sides of mid building
        this.addWall(-4.5, 2.5, 0, 1.5, 5, 8, steelMat);
        this.addWall( 4.5, 2.5, 0, 1.5, 5, 8, steelMat);
        // Roof
        this.addWall(0, 5.2, 0, 8, 0.4, 8, steelMat);
        // Catwalk/ledge players can use for height
        this.addWall(0, 3.0, 3.5, 6, 0.3, 1, steelMat);
        this.addWall(0, 3.0, -3.5, 6, 0.3, 1, steelMat);

        // Mid ambient light
        this.mesh.add(Object.assign(new THREE.PointLight(0xffffff, 1.2, 18), { position: new THREE.Vector3(0, 5, 0) }));

        this.coverPositions.push(
            new THREE.Vector3(6, 0, 0), new THREE.Vector3(-6, 0, 0),
            new THREE.Vector3(0, 0, 6), new THREE.Vector3(0, 0, -6)
        );

        // ── BUY TERMINALS (N and S of mid) ────────────────────────────────────
        const t1 = new THREE.Vector3(0, 2, 22);
        const t2 = new THREE.Vector3(0, 2, -22);
        this._buildBuyTerminal(t1.x, t1.z);
        this._buildBuyTerminal(t2.x, t2.z);
        this.buyPillars.push(t1, t2);

        // ── CORRIDORS — North and South lanes with walls ──────────────────────
        // North corridor wall segments (leave gaps as doors/chokepoints)
        this.addWall(-20, 2, 16, 18, 4, 1.5, wallMat);   // left block N
        this.addWall( 20, 2, 16, 18, 4, 1.5, wallMat);   // right block N
        this.addWall(-20, 2,-16, 18, 4, 1.5, wallMat);   // left block S
        this.addWall( 20, 2,-16, 18, 4, 1.5, wallMat);   // right block S

        // ── A-SITE COVER (red side, x > 10) ──────────────────────────────────
        // Large L-wall near A
        this.addWall(18, 1.5,  6, 1.5, 3, 10, concMat);
        this.addWall(22, 1.5, 10, 7,   3, 1.5, concMat);
        // Two crates
        this.addWall(24, 1.2,  0, 3, 2.4, 3, steelMat);
        this.addWall(15, 1.2,  8, 2.5, 2.4, 2.5, steelMat);
        // Low barrier across entrance
        this.addWall(12, 0.8, -4, 5, 1.6, 1.2, concMat);

        this.coverPositions.push(
            new THREE.Vector3(17, 0,  5), new THREE.Vector3(23, 0, 10),
            new THREE.Vector3(25, 0,  0), new THREE.Vector3(14, 0,  7),
            new THREE.Vector3(11, 0, -3)
        );

        // ── B-SITE COVER (blue side, x < -10) ────────────────────────────────
        this.addWall(-18, 1.5, -6, 1.5, 3, 10, concMat);
        this.addWall(-22, 1.5,-10, 7,   3, 1.5, concMat);
        this.addWall(-24, 1.2,  0, 3, 2.4, 3, steelMat);
        this.addWall(-15, 1.2, -8, 2.5, 2.4, 2.5, steelMat);
        this.addWall(-12, 0.8,  4, 5, 1.6, 1.2, concMat);

        this.coverPositions.push(
            new THREE.Vector3(-17, 0, -5), new THREE.Vector3(-23, 0,-10),
            new THREE.Vector3(-25, 0,  0), new THREE.Vector3(-14, 0, -7),
            new THREE.Vector3(-11, 0,  3)
        );

        // ── FLANK ROUTES — diagonal pillars at corners ────────────────────────
        for (const [sx, sz] of [[1,1],[1,-1],[-1,1],[-1,-1]]) {
            this.addWall(sx*28, 2, sz*28, 4, 4, 1.5, concMat);
            this.addWall(sx*28, 2, sz*24, 1.5, 4, 4,   concMat);
        }

        // ── Ambient/Ceiling Lights ─────────────────────────────────────────────
        this._addStripLights();

        // ── Spawn Points ──────────────────────────────────────────────────────
        this.redSpawns = [
            new THREE.Vector3(33, 1.5, -4), new THREE.Vector3(33, 1.5,  4),
            new THREE.Vector3(31, 1.5,  0), new THREE.Vector3(35, 1.5,  0),
        ];
        this.blueSpawns = [
            new THREE.Vector3(-33, 1.5, -4), new THREE.Vector3(-33, 1.5,  4),
            new THREE.Vector3(-31, 1.5,  0), new THREE.Vector3(-35, 1.5,  0),
        ];

        this.mesh.position.copy(this.position);
        this.scene.add(this.mesh);

        this._particles = [];
        this._initParticles();
    }

    _addWallWithTrim(x, y, z, w, h, d, wallMat, trimMat) {
        this.addWall(x, y, z, w, h, d, wallMat);
        // Add a thin glowing trim strip at the base and top of each wall
        const isZ = d > w; // wall runs along Z axis
        const trimH = 0.12;
        const geo = new THREE.BoxGeometry(w + 0.02, trimH, d + 0.02);
        const topTrim = new THREE.Mesh(geo, trimMat);
        topTrim.position.set(x, y + h / 2 - trimH / 2, z);
        this.mesh.add(topTrim);
        const botTrim = new THREE.Mesh(geo, trimMat);
        botTrim.position.set(x, y - h / 2 + trimH / 2, z);
        this.mesh.add(botTrim);
    }

    _buildSpawnGate(cx, cz, team) {
        const isRed = team === 'red';
        const emissiveColor = isRed ? 0x660000 : 0x000066;
        const color = isRed ? 0x991111 : 0x111199;
        const mat = new THREE.MeshStandardMaterial({
            color, roughness: 0.3, metalness: 0.8,
            emissive: emissiveColor, emissiveIntensity: 1.0
        });
        // Two vertical pillars
        const pillarGeo = new THREE.BoxGeometry(0.4, 6, 0.4);
        for (const dz of [-5, 5]) {
            const p = new THREE.Mesh(pillarGeo, mat);
            p.position.set(cx + (isRed ? -0.5 : 0.5), 3, cz + dz);
            this.mesh.add(p);
        }
        // Horizontal top bar
        const barGeo = new THREE.BoxGeometry(0.4, 0.4, 10.4);
        const bar = new THREE.Mesh(barGeo, mat);
        bar.position.set(cx + (isRed ? -0.5 : 0.5), 6, cz);
        this.mesh.add(bar);
        // Team label plane (colored fill)
        const panelGeo = new THREE.PlaneGeometry(0.1, 5);
        const panel = new THREE.Mesh(panelGeo, mat);
        panel.position.set(cx + (isRed ? -0.5 : 0.5), 3, cz);
        panel.rotation.y = Math.PI / 2;
        this.mesh.add(panel);
    }

    _buildBuyTerminal(x, z) {
        const baseMat = new THREE.MeshStandardMaterial({
            color: 0x1a2a1a, roughness: 0.4, metalness: 0.6,
            emissive: 0x042204, emissiveIntensity: 0.4
        });
        const glowMat = new THREE.MeshStandardMaterial({
            color: 0x00ff66, roughness: 0.2, metalness: 0.9,
            emissive: 0x00cc44, emissiveIntensity: 1.2
        });
        const screenMat = new THREE.MeshStandardMaterial({
            color: 0x004422, roughness: 0.1,
            emissive: 0x00ff88, emissiveIntensity: 0.8
        });

        // Plinth
        const plinth = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.3, 2.4), baseMat);
        plinth.position.set(x, 0.15, z);
        this.mesh.add(plinth);

        // Terminal body
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 3.2, 1.6), baseMat);
        body.position.set(x, 1.9, z);
        body.castShadow = true;
        this.mesh.add(body);
        this.colliders.push(new THREE.Box3(
            new THREE.Vector3(x - 0.8, 0, z - 0.8),
            new THREE.Vector3(x + 0.8, 3.5, z + 0.8)
        ));

        // Glowing edge strips (4 vertical corners)
        for (const [dx, dz] of [[-0.82,-0.82],[0.82,-0.82],[-0.82,0.82],[0.82,0.82]]) {
            const strip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.2, 0.08), glowMat);
            strip.position.set(x + dx, 1.9, z + dz);
            this.mesh.add(strip);
        }

        // Screen face
        const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.8), screenMat);
        screen.position.set(x, 2.2, z + 0.82);
        screen.rotation.y = 0;
        this.mesh.add(screen);
        const screen2 = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.8), screenMat);
        screen2.position.set(x, 2.2, z - 0.82);
        screen2.rotation.y = Math.PI;
        this.mesh.add(screen2);

        // Top antenna
        const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.0, 6), glowMat);
        ant.position.set(x, 4.0, z);
        this.mesh.add(ant);
        const antTip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), glowMat);
        antTip.position.set(x, 4.55, z);
        this.mesh.add(antTip);

        // Point light
        const light = new THREE.PointLight(0x00ff66, 2.0, 10);
        light.position.set(x, 3.5, z);
        this.mesh.add(light);
    }

    _addFloorRing(cx, cz, r, segments, color, y) {
        const mat = new THREE.MeshStandardMaterial({
            color, emissive: color, emissiveIntensity: 0.6, roughness: 0.3
        });
        const pts = [];
        for (let i = 0; i <= segments; i++) {
            const a = (i / segments) * Math.PI * 2;
            pts.push(new THREE.Vector3(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r));
        }
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, linewidth: 2 }));
        this.mesh.add(line);
    }

    _addStripLights() {
        // Subtle colored strip lights along the top of the arena walls
        const positions = [
            { x: 0,    z: -39, color: 0x334466 },
            { x: 0,    z:  39, color: 0x334466 },
            { x: -39,  z: 0,   color: 0x334466 },
            { x:  39,  z: 0,   color: 0x334466 },
        ];
        for (const p of positions) {
            const l = new THREE.PointLight(p.color, 0.8, 25);
            l.position.set(p.x, 6.5, p.z);
            this.mesh.add(l);
        }
    }

    _initParticles() {
        // Floating ambient dust particles (very subtle)
        const count = 80;
        const positions = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            positions[i * 3]     = (Math.random() - 0.5) * 70;
            positions[i * 3 + 1] = Math.random() * 5;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 70;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const mat = new THREE.PointsMaterial({ color: 0x6666aa, size: 0.08, transparent: true, opacity: 0.4 });
        this._dustPoints = new THREE.Points(geo, mat);
        this._dustPositions = positions;
        this.mesh.add(this._dustPoints);
    }

    addWall(x, y, z, w, h, d, material) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.mesh.add(mesh);
        this.colliders.push(new THREE.Box3(
            new THREE.Vector3(x - w / 2, y - h / 2, z - d / 2),
            new THREE.Vector3(x + w / 2, y + h / 2, z + d / 2)
        ));
    }

    getSpawn(team) {
        const spawns = team === 'red' ? this.redSpawns : this.blueSpawns;
        return spawns[Math.floor(Math.random() * spawns.length)].clone();
    }

    checkCollision(pos, radius) {
        const minX = pos.x - radius, maxX = pos.x + radius;
        const minY = pos.y - 1.5,   maxY = pos.y + 0.5;
        const minZ = pos.z - radius, maxZ = pos.z + radius;
        for (const col of this.colliders) {
            if (maxX > col.min.x && minX < col.max.x &&
                maxY > col.min.y && minY < col.max.y &&
                maxZ > col.min.z && minZ < col.max.z) return true;
        }
        return false;
    }

    resolveCollision(oldPos, newPos, radius) {
        if (!this.checkCollision(newPos, radius)) return newPos.clone();
        const tryX = new THREE.Vector3(newPos.x, newPos.y, oldPos.z);
        if (!this.checkCollision(tryX, radius)) return tryX;
        const tryZ = new THREE.Vector3(oldPos.x, newPos.y, newPos.z);
        if (!this.checkCollision(tryZ, radius)) return tryZ;
        return new THREE.Vector3(oldPos.x, newPos.y, oldPos.z);
    }

    raycast(origin, direction, maxDist) {
        const ray = new THREE.Ray(origin, direction.clone().normalize());
        let closestDist = maxDist;
        let hit = false;
        const _pt = new THREE.Vector3();
        for (const col of this.colliders) {
            const intersection = ray.intersectBox(col, _pt);
            if (intersection) {
                const dist = origin.distanceTo(intersection);
                if (dist < closestDist) { closestDist = dist; hit = true; }
            }
        }
        return { hit, distance: closestDist };
    }

    isPathObstructed(start, end, radius) {
        const dist = start.distanceTo(end);
        if (dist === 0) return false;
        const steps = Math.ceil(dist / Math.max(0.1, radius * 0.5));
        const step = new THREE.Vector3().subVectors(end, start).divideScalar(steps);
        const pos = start.clone();
        for (let i = 0; i < steps; i++) {
            if (this.checkCollision(pos, radius)) return true;
            pos.add(step);
        }
        return false;
    }

    update(dt) {
        // Animate dust particles
        if (!this._dustPoints) return;
        this._particleTime += dt;
        const pos = this._dustPositions;
        const count = pos.length / 3;
        for (let i = 0; i < count; i++) {
            pos[i * 3 + 1] += Math.sin(this._particleTime * 0.5 + i) * 0.002;
            if (pos[i * 3 + 1] > 5.5) pos[i * 3 + 1] = 0.1;
        }
        this._dustPoints.geometry.attributes.position.needsUpdate = true;
    }
}
