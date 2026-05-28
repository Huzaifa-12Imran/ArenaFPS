class Projectile extends GameObject3D {
    /**
     * @param {THREE.Scene}   scene
     * @param {THREE.Vector3} origin    - world-space start of the tracer
     * @param {THREE.Vector3} direction - normalised shoot direction
     * @param {string}        team
     * @param {THREE.Vector3} [endPoint] - if supplied, the tracer ends here
     *                                     (wall/target hit point). Otherwise
     *                                     falls back to origin + dir * 100.
     */
    constructor(scene, origin, direction, team, endPoint) {
        super(scene);
        this.name = 'Projectile';
        this.team = team;
        this.lifetime = 0.15;

        // Lower the visual start slightly below the camera so the trace line
        // appears to come from roughly chest/gun level instead of floating
        // above the character's head when seen by other players.
        const visualOrigin = origin.clone();
        visualOrigin.y -= 0.25;

        this.position.copy(visualOrigin);
        this.endPoint = endPoint
            ? endPoint.clone()
            : visualOrigin.clone().add(direction.clone().multiplyScalar(100));
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
