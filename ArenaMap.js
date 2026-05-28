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

        // ── Materials — desert/dust palette ──────────────────────────────────
        // Sand & ground
        const sandMat = new THREE.MeshStandardMaterial({ color: 0xc8a96e, roughness: 0.95, metalness: 0.0 });
        const dirtMat = new THREE.MeshStandardMaterial({ color: 0xa8814a, roughness: 1.0, metalness: 0.0 });
        // Adobe/stone walls
        const adobeMat = new THREE.MeshStandardMaterial({ color: 0xc4a06a, roughness: 0.92, metalness: 0.0 });
        const stoneWall = new THREE.MeshStandardMaterial({ color: 0x9e8460, roughness: 0.88, metalness: 0.02 });
        const concreteMat = new THREE.MeshStandardMaterial({ color: 0xb0976d, roughness: 0.85, metalness: 0.0 });
        // Darker stone detail
        const darkStone = new THREE.MeshStandardMaterial({ color: 0x7a6445, roughness: 0.90, metalness: 0.0 });
        // Wooden crates
        const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.90, metalness: 0.0 });
        const woodDark = new THREE.MeshStandardMaterial({ color: 0x6b4f10, roughness: 0.95, metalness: 0.0 });
        // Metal pipes / barrel
        const metalMat = new THREE.MeshStandardMaterial({ color: 0x706050, roughness: 0.55, metalness: 0.6 });
        const rustMat = new THREE.MeshStandardMaterial({ color: 0x7a4530, roughness: 0.80, metalness: 0.3 });
        // Spawn team accents
        const redMat = new THREE.MeshStandardMaterial({ color: 0x8b1a1a, roughness: 0.9, emissive: 0x3a0808, emissiveIntensity: 0.3 });
        const blueMat = new THREE.MeshStandardMaterial({ color: 0x1a2a8b, roughness: 0.9, emissive: 0x08083a, emissiveIntensity: 0.3 });
        // Rooftop / ceiling slabs
        const roofMat = new THREE.MeshStandardMaterial({ color: 0xb09060, roughness: 0.85, metalness: 0.0 });

        // ── Skybox / ambient lighting ─────────────────────────────────────────
        // Bright desert sun from above-right
        const sunLight = new THREE.DirectionalLight(0xffe8b0, 2.2);
        sunLight.position.set(30, 50, 20);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.set(2048, 2048);
        sunLight.shadow.camera.near = 1;
        sunLight.shadow.camera.far = 200;
        sunLight.shadow.camera.left = -60;
        sunLight.shadow.camera.right = 60;
        sunLight.shadow.camera.top = 60;
        sunLight.shadow.camera.bottom = -60;
        this.mesh.add(sunLight);

        // Soft blue-sky fill (hemisphere)
        const hemi = new THREE.HemisphereLight(0x9ab4d4, 0xc8a96e, 0.6);
        this.mesh.add(hemi);

        // ── Ground / Floor — sandy terrain ────────────────────────────────────
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), sandMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.mesh.add(floor);

        // Darker dirt patches at spawn pads
        const redPad = new THREE.Mesh(new THREE.PlaneGeometry(18, 22), dirtMat);
        redPad.rotation.x = -Math.PI / 2;
        redPad.position.set(36, 0.01, 0);
        this.mesh.add(redPad);

        const bluePad = new THREE.Mesh(new THREE.PlaneGeometry(18, 22), dirtMat);
        bluePad.rotation.x = -Math.PI / 2;
        bluePad.position.set(-36, 0.01, 0);
        this.mesh.add(bluePad);

        // Tactile darker path across mid
        const midPath = new THREE.Mesh(new THREE.PlaneGeometry(20, 10), dirtMat);
        midPath.rotation.x = -Math.PI / 2;
        midPath.position.set(0, 0.01, 0);
        this.mesh.add(midPath);

        // ── Outer Boundary — thick adobe walls ───────────────────────────────
        const H = 9, T = 2, half = 48;
        this._addAdobeWall(0, H / 2, -half, 96, H, T, adobeMat);
        this._addAdobeWall(0, H / 2, half, 96, H, T, adobeMat);
        this._addAdobeWall(-half, H / 2, 0, T, H, 96, adobeMat);
        this._addAdobeWall(half, H / 2, 0, T, H, 96, adobeMat);

        // Wall top cap trim (slightly darker overhang)
        this._addWallCap(0, H, -half, 98, 0.5, T + 0.4, darkStone);
        this._addWallCap(0, H, half, 98, 0.5, T + 0.4, darkStone);
        this._addWallCap(-half, H, 0, T + 0.4, 0.5, 98, darkStone);
        this._addWallCap(half, H, 0, T + 0.4, 0.5, 98, darkStone);

        // ── Spawn Gates (wooden/metal archways) ──────────────────────────────
        this._buildSpawnGate(42, 0, 'red', woodMat, redMat);
        this._buildSpawnGate(-42, 0, 'blue', woodMat, blueMat);

        // ── MID — Central Raised Platform / Catwalk Building ─────────────────
        // Ground-level pass-through: two side walls with open front/back
        this.addWall(-5.0, 2.5, 0, 1.5, 5, 10, stoneWall);  // left mid wall
        this.addWall(5.0, 2.5, 0, 1.5, 5, 10, stoneWall);  // right mid wall
        // Short cross-wall segments leaving doorways (front/back open)
        this.addWall(-2.0, 2.5, 5.0, 2.0, 5, 1.5, stoneWall);
        this.addWall(2.0, 2.5, 5.0, 2.0, 5, 1.5, stoneWall);
        this.addWall(-2.0, 2.5, -5.0, 2.0, 5, 1.5, stoneWall);
        this.addWall(2.0, 2.5, -5.0, 2.0, 5, 1.5, stoneWall);
        // Roof slab on top
        this.addWall(0, 5.25, 0, 12, 0.5, 12, roofMat);

        // Catwalk boost ledge (players can jump onto)
        this.addWall(0, 2.8, 7.5, 8, 0.3, 2.0, concreteMat);
        this.addWall(0, 2.8, -7.5, 8, 0.3, 2.0, concreteMat);
        
        // Stairs for catwalks
        this._buildStairs( 5.5, 0,  7.5, 3, 2, 2.95, 6, -1, 0, concreteMat);
        this._buildStairs(-5.5, 0,  7.5, 3, 2, 2.95, 6,  1, 0, concreteMat);
        this._buildStairs( 5.5, 0, -7.5, 3, 2, 2.95, 6, -1, 0, concreteMat);
        this._buildStairs(-5.5, 0, -7.5, 3, 2, 2.95, 6,  1, 0, concreteMat);

        // Wooden crate stack at mid
        this._buildCrateStack(0, 1.2, 0, woodMat, woodDark);

        this.coverPositions.push(
            new THREE.Vector3(7, 0, 0), new THREE.Vector3(-7, 0, 0),
            new THREE.Vector3(0, 0, 8), new THREE.Vector3(0, 0, -8),
        );

        // Mid ambient fill
        const midLight = new THREE.PointLight(0xffe0a0, 0.5, 20);
        midLight.position.set(0, 7, 0);
        this.mesh.add(midLight);

        // ── BUY TERMINALS — stone pillars with wooden sign boards ────────────
        const t1 = new THREE.Vector3(0, 1.5, 24);
        const t2 = new THREE.Vector3(0, 1.5, -24);
        this._buildBuyTerminal(t1.x, t1.z, stoneWall, woodMat);
        this._buildBuyTerminal(t2.x, t2.z, stoneWall, woodMat);
        this.buyPillars.push(t1, t2);

        // ── LONG A — North corridor between spawn and A-site ─────────────────
        // Long wall on the left (negative Z side)
        this.addWall(-22, 3.0, 16, 20, 6, 1.5, adobeMat);   // upper long wall
        this.addWall(22, 3.0, 16, 20, 6, 1.5, adobeMat);   // mirrored
        this.addWall(-22, 3.0, -16, 20, 6, 1.5, adobeMat);   // lower long wall
        this.addWall(22, 3.0, -16, 20, 6, 1.5, adobeMat);   // mirrored

        // Catwalk / raised walkway on A-long (Z = 24 area)
        this.addWall(14, 2.0, 24, 14, 0.4, 3, concreteMat);   // catwalk slab
        this.addWall(14, 1.0, 24, 0.4, 2.0, 3, stoneWall);    // support pillar
        
        // Stairs to A-long catwalk
        this._buildStairs(5, 0, 24, 4, 3, 2.2, 5, 1, 0, concreteMat);
        this._buildStairs(23, 0, 24, 4, 3, 2.2, 5, -1, 0, concreteMat);

        // ── A-SITE COVER (red side, x > 10) ──────────────────────────────────
        // Big L-shaped adobe wall
        this.addWall(20, 3.0, 8, 1.5, 6, 12, adobeMat);   // long left face
        this.addWall(24, 3.0, 13, 8, 6, 1.5, adobeMat);  // short back face
        // Car (box proxy)
        this._buildCar(25, 0, 2, concreteMat, darkStone);
        // Wooden crate clusters
        this._buildCrateStack(16, 1.2, 9, woodMat, woodDark);
        this._buildCrateStack(27, 1.0, -1, woodMat, woodDark);
        // Low barrier
        this.addWall(13, 0.9, -5, 6, 1.8, 1.2, stoneWall);
        // Barrels
        this._buildBarrel(18, 0, 3, rustMat, metalMat);
        this._buildBarrel(19, 0, 3, rustMat, metalMat);

        this.coverPositions.push(
            new THREE.Vector3(19, 0, 7), new THREE.Vector3(23, 0, 12),
            new THREE.Vector3(26, 0, 0), new THREE.Vector3(15, 0, 8),
            new THREE.Vector3(12, 0, -4)
        );

        // A-site fill light (warm afternoon sun)
        const aLight = new THREE.PointLight(0xffcc80, 0.8, 25);
        aLight.position.set(22, 6, 5);
        this.mesh.add(aLight);

        // ── B-SITE COVER (blue side, x < -10) ────────────────────────────────
        this.addWall(-20, 3.0, -8, 1.5, 6, 12, adobeMat);
        this.addWall(-24, 3.0, -13, 8, 6, 1.5, adobeMat);
        this._buildCar(-25, 0, -2, concreteMat, darkStone);
        this._buildCrateStack(-16, 1.2, -9, woodMat, woodDark);
        this._buildCrateStack(-27, 1.0, 1, woodMat, woodDark);
        this.addWall(-13, 0.9, 5, 6, 1.8, 1.2, stoneWall);
        this._buildBarrel(-18, 0, -3, rustMat, metalMat);
        this._buildBarrel(-19, 0, -3, rustMat, metalMat);

        this.coverPositions.push(
            new THREE.Vector3(-19, 0, -7), new THREE.Vector3(-23, 0, -12),
            new THREE.Vector3(-26, 0, 0), new THREE.Vector3(-15, 0, -8),
            new THREE.Vector3(-12, 0, 4)
        );

        const bLight = new THREE.PointLight(0xffcc80, 0.8, 25);
        bLight.position.set(-22, 6, -5);
        this.mesh.add(bLight);

        // ── FLANK ROUTES — corner diagonal structures ─────────────────────────
        for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
            this.addWall(sx * 30, 3, sz * 28, 4, 6, 1.5, adobeMat);
            this.addWall(sx * 30, 3, sz * 24, 1.5, 6, 4, adobeMat);
            // Corner watch-tower base
            this.addWall(sx * 34, 2, sz * 34, 5, 4, 5, stoneWall);
            // Tower roof
            this.addWall(sx * 34, 4.25, sz * 34, 5.6, 0.5, 5.6, roofMat);
            
            // Stairs up to watch-tower
            this._buildStairs(sx * 30, 0, sz * 34, 4, 3, 4.0, 8, sx, 0, stoneWall);
            this._buildStairs(sx * 34, 0, sz * 30, 3, 4, 4.0, 8, 0, sz, stoneWall);
        }

        // ── A-SITE RAMP / PLATFORM ────────────────────────────────────────────
        // A-site has a raised platform (players can stand on top)
        this.addWall(28, 1.0, -12, 8, 2.0, 6, stoneWall);   // ramp body
        this.addWall(28, 2.1, -12, 8.4, 0.2, 6.4, concreteMat); // platform top
        this._buildStairs(28, 0, -8, 4, 3, 2.2, 5, 0, -1, stoneWall); // from south
        this._buildStairs(22.5, 0, -12, 3, 4, 2.2, 5, 1, 0, stoneWall); // from west
        this.coverPositions.push(new THREE.Vector3(28, 2.2, -12));

        // B-site mirror platform
        this.addWall(-28, 1.0, 12, 8, 2.0, 6, stoneWall);
        this.addWall(-28, 2.1, 12, 8.4, 0.2, 6.4, concreteMat);
        this._buildStairs(-28, 0, 8, 4, 3, 2.2, 5, 0, 1, stoneWall); // from north
        this._buildStairs(-22.5, 0, 12, 3, 4, 2.2, 5, -1, 0, stoneWall); // from east
        this.coverPositions.push(new THREE.Vector3(-28, 2.2, 12));

        // ── MID BUILDING — two-storey adobe with window cutout ────────────────
        // Back wall of mid building (facing A)
        this.addWall(8, 3.0, 0, 1.5, 6, 8, adobeMat);
        // Back wall of mid building (facing B)
        this.addWall(-8, 3.0, 0, 1.5, 6, 8, adobeMat);

        // ── Spawn Points ──────────────────────────────────────────────────────
        this.redSpawns = [
            new THREE.Vector3(37, 1.5, -5),
            new THREE.Vector3(37, 1.5, 5),
            new THREE.Vector3(34, 1.5, 0),
            new THREE.Vector3(40, 1.5, 0),
        ];
        this.blueSpawns = [
            new THREE.Vector3(-37, 1.5, -5),
            new THREE.Vector3(-37, 1.5, 5),
            new THREE.Vector3(-34, 1.5, 0),
            new THREE.Vector3(-40, 1.5, 0),
        ];

        // ── Dust particles (floating sand/dust motes) ─────────────────────────
        this._particles = [];
        this._initParticles();

        this.mesh.position.copy(this.position);
        this.scene.add(this.mesh);
    }

    // ── Helper: thick adobe wall (with face-darkened sides) ──────────────────
    _addAdobeWall(x, y, z, w, h, d, mat) {
        this.addWall(x, y, z, w, h, d, mat);
    }

    // ── Helper: flat cap slab on top of wall ─────────────────────────────────
    _addWallCap(x, y, z, w, h, d, mat) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        mesh.position.set(x, y, z);
        mesh.receiveShadow = true;
        this.mesh.add(mesh);
    }

    // ── Helper: wooden crate stack (2-3 boxes) ────────────────────────────────
    _buildCrateStack(x, baseY, z, woodMat, darkMat) {
        const sizes = [
            [2.2, 2.2, 2.2, 0],
            [2.0, 2.0, 2.0, 2.2],
            [1.8, 1.8, 1.8, 4.2],
        ];
        for (const [w, h, d, yOff] of sizes) {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), yOff === 0 ? woodMat : darkMat);
            mesh.position.set(x, baseY + yOff, z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.mesh.add(mesh);
            this.colliders.push(new THREE.Box3(
                new THREE.Vector3(x - w / 2, yOff, z - d / 2),
                new THREE.Vector3(x + w / 2, baseY + yOff + h, z + d / 2)
            ));
            if (yOff > 0) break; // Only stack 2 high by default
        }
        // Wooden plank strips (darker lines on crate face)
        const strip = new THREE.Mesh(new THREE.BoxGeometry(2.22, 0.12, 2.22), darkMat);
        strip.position.set(x, baseY + 1.0, z);
        this.mesh.add(strip);
    }

    // ── Helper: car prop (simplified 3-box vehicle) ───────────────────────────
    _buildCar(x, y, z, bodyMat, detailMat) {
        // Body
        const body = new THREE.Mesh(new THREE.BoxGeometry(5, 1.4, 2.4), bodyMat);
        body.position.set(x, y + 0.8, z);
        body.castShadow = true;
        this.mesh.add(body);
        // Cabin
        const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.1, 2.2), detailMat);
        cabin.position.set(x - 0.4, y + 1.85, z);
        cabin.castShadow = true;
        this.mesh.add(cabin);
        // Collider for full car
        this.colliders.push(new THREE.Box3(
            new THREE.Vector3(x - 2.5, y, z - 1.2),
            new THREE.Vector3(x + 2.5, y + 2.8, z + 1.2)
        ));
        // Wheels (4 cylinders)
        const wGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.28, 10);
        for (const [dx, dz] of [[-1.6, -1.35], [-1.6, 1.35], [1.6, -1.35], [1.6, 1.35]]) {
            const w = new THREE.Mesh(wGeo, detailMat);
            w.rotation.z = Math.PI / 2;
            w.position.set(x + dx, y + 0.38, z + dz);
            this.mesh.add(w);
        }
    }

    // ── Helper: rusty barrel ─────────────────────────────────────────────────
    _buildBarrel(x, y, z, rustMat, metalMat) {
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 1.1, 10), rustMat);
        body.position.set(x, y + 0.55, z);
        body.castShadow = true;
        this.mesh.add(body);
        // Metal band rings
        for (const dy of [0.3, 0.8]) {
            const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.40, 0.40, 0.07, 10), metalMat);
            ring.position.set(x, y + dy, z);
            this.mesh.add(ring);
        }
        this.colliders.push(new THREE.Box3(
            new THREE.Vector3(x - 0.42, y, z - 0.42),
            new THREE.Vector3(x + 0.42, y + 1.2, z + 0.42)
        ));
    }

    // ── Helper: spawn gate — wooden beam + pillars ────────────────────────────
    _buildSpawnGate(cx, cz, team, woodMat, teamMat) {
        const sign = team === 'red' ? 1 : -1;
        const pillarGeo = new THREE.BoxGeometry(0.5, 7, 0.5);
        for (const dz of [-5.5, 5.5]) {
            const p = new THREE.Mesh(pillarGeo, woodMat);
            p.position.set(cx - sign * 0.8, 3.5, cz + dz);
            p.castShadow = true;
            this.mesh.add(p);
        }
        // Horizontal beam
        const beam = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 11.5), woodMat);
        beam.position.set(cx - sign * 0.8, 7.2, cz);
        this.mesh.add(beam);
        // Team color lantern / sign block
        const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.2, 1.2), teamMat);
        lantern.position.set(cx - sign * 0.8, 6.0, cz);
        this.mesh.add(lantern);
        // Spawn light
        const color = team === 'red' ? 0xff4422 : 0x4466ff;
        const light = new THREE.PointLight(color, 1.5, 18);
        light.position.set(cx - sign * 0.8, 6, cz);
        this.mesh.add(light);
    }

    // ── Helper: stone pillar buy terminal with wooden sign ───────────────────
    _buildBuyTerminal(x, z, stoneMat, woodMat) {
        // Plinth base
        const base = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.3, 2.0), stoneMat);
        base.position.set(x, 0.15, z);
        this.mesh.add(base);
        // Stone pillar body
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 3.0, 0.9), stoneMat);
        pillar.position.set(x, 1.65, z);
        pillar.castShadow = true;
        this.mesh.add(pillar);
        this.colliders.push(new THREE.Box3(
            new THREE.Vector3(x - 0.5, 0, z - 0.5),
            new THREE.Vector3(x + 0.5, 3.2, z + 0.5)
        ));
        // Wooden sign board
        const sign = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 0.1), woodMat);
        sign.position.set(x, 2.5, z + 0.5);
        this.mesh.add(sign);
        // Warm torch light beside terminal
        const light = new THREE.PointLight(0xffaa44, 1.2, 8);
        light.position.set(x, 3.0, z);
        this.mesh.add(light);
    }

    // ── Helper: floating sand dust particles ─────────────────────────────────
    _initParticles() {
        const count = 120;
        const positions = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 80;
            positions[i * 3 + 1] = Math.random() * 4;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 80;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        // Sandy dust color
        const mat = new THREE.PointsMaterial({ color: 0xd4b882, size: 0.1, transparent: true, opacity: 0.35 });
        this._dustPoints = new THREE.Points(geo, mat);
        this._dustPositions = positions;
        this.mesh.add(this._dustPoints);
    }

    // ── Core wall helper ─────────────────────────────────────────────────────
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

    // ── Spawn & collision API (unchanged interface) ───────────────────────────
    getSpawn(team) {
        const spawns = team === 'red' ? this.redSpawns : this.blueSpawns;
        return spawns[Math.floor(Math.random() * spawns.length)].clone();
    }

    checkCollision(pos, radius) {
        const stepHeight = 0.55;
        const minX = pos.x - radius, maxX = pos.x + radius;
        const minY = pos.y - 1.5 + stepHeight, maxY = pos.y + 0.5;
        const minZ = pos.z - radius, maxZ = pos.z + radius;
        for (const col of this.colliders) {
            if (maxX > col.min.x && minX < col.max.x &&
                maxY > col.min.y && minY < col.max.y &&
                maxZ > col.min.z && minZ < col.max.z) {
                return true;
            }
        }
        return false;
    }

    getGroundY(pos, radius) {
        let maxGroundY = 1.5;
        const minX = pos.x - radius, maxX = pos.x + radius;
        const minZ = pos.z - radius, maxZ = pos.z + radius;
        const stepHeight = 0.55;
        const footY = pos.y - 1.5 + stepHeight; 
        
        for (const col of this.colliders) {
            if (maxX > col.min.x && minX < col.max.x && maxZ > col.min.z && minZ < col.max.z) {
                if (col.max.y <= footY && (col.max.y + 1.5) > maxGroundY) {
                    maxGroundY = col.max.y + 1.5;
                }
            }
        }
        return maxGroundY;
    }

    getCeilingY(pos, radius) {
        let minCeilingY = Infinity;
        const minX = pos.x - radius, maxX = pos.x + radius;
        const minZ = pos.z - radius, maxZ = pos.z + radius;
        const headY = pos.y + 0.5; 
        
        for (const col of this.colliders) {
            if (maxX > col.min.x && minX < col.max.x && maxZ > col.min.z && minZ < col.max.z) {
                if (col.min.y >= headY && col.min.y < minCeilingY) {
                    minCeilingY = col.min.y;
                }
            }
        }
        return minCeilingY;
    }

    // ── Helper: build stairs (series of step blocks) ─────────────────────────
    _buildStairs(x, y, z, width, depth, totalHeight, numSteps, dirX, dirZ, mat) {
        const stepH = totalHeight / numSteps;
        for (let i = 0; i < numSteps; i++) {
            const h = stepH * (i + 1);
            let sx = x;
            let sz = z;
            let curW = width;
            let curD = depth;
            if (dirZ !== 0) { // stairs go along Z axis
                curD = depth / numSteps;
                sz = z - (depth / 2) + (curD / 2) + i * curD;
                if (dirZ < 0) sz = z + (depth / 2) - (curD / 2) - i * curD;
            } else if (dirX !== 0) { // stairs go along X axis
                curW = width / numSteps;
                sx = x - (width / 2) + (curW / 2) + i * curW;
                if (dirX < 0) sx = x + (width / 2) - (curW / 2) - i * curW;
            }
            this.addWall(sx, y + h / 2, sz, curW, h, curD, mat);
        }
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
        if (!this._dustPoints) return;
        this._particleTime += dt;
        const pos = this._dustPositions;
        const count = pos.length / 3;
        for (let i = 0; i < count; i++) {
            // Slow drift: slight horizontal + gentle vertical float
            pos[i * 3] += Math.sin(this._particleTime * 0.2 + i * 1.7) * 0.001;
            pos[i * 3 + 1] += Math.sin(this._particleTime * 0.3 + i) * 0.0015;
            if (pos[i * 3 + 1] > 4.5) pos[i * 3 + 1] = 0.05;
        }
        this._dustPoints.geometry.attributes.position.needsUpdate = true;
    }
}