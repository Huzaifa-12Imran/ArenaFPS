class Projectile extends GameObject3D {
    constructor(scene, origin, direction, team) {
        super(scene);
        this.name = 'Projectile';
        this.team = team;
        this.lifetime = 0.15;
        this.position.copy(origin);
        this.endPoint = origin.clone().add(direction.clone().multiplyScalar(100));
        this.createMesh();
    }

    createMesh() {
        // Lazy-load shared materials to prevent initialization order crashes
        if (!Projectile.MAT_RED) {
            Projectile.MAT_RED = new THREE.LineBasicMaterial({ color: 0xff6633, transparent: true, opacity: 0.8 });
            Projectile.MAT_BLUE = new THREE.LineBasicMaterial({ color: 0x3399ff, transparent: true, opacity: 0.8 });
        }

        // Tracer line
        const points = [this.position.clone(), this.endPoint.clone()];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = this.team === 'red' ? Projectile.MAT_RED : Projectile.MAT_BLUE;
        this.mesh = new THREE.Line(geometry, material);
        this.scene.add(this.mesh);
    }

    update(dt) {
        this.lifetime -= dt;
        if (this.lifetime <= 0) {
            this.destroy();
            return true; // should remove
        }
        return false;
    }
}
