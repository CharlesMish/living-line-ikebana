import { clamp, cross, dot, length, normalize, quaternionFromAxisAngle, rotateVector, scale, type Quat, type Vec3 } from './math.ts';
export const rotationVector = (q: Quat): Vec3 => {
    const sine = Math.hypot(q.x, q.y, q.z);
    return sine < 1e-15 ? { x: 0, y: 0, z: 0 } : scale(q, 2 * Math.atan2(sine, q.w) / sine);
};
export const rotationQuaternion = (w: Vec3): Quat => quaternionFromAxisAngle(w, length(w));
const multiply = (a: Quat, b: Quat): Quat => ({
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
});
/** Shortest rigid rotation between two accepted/desired acquisition-relative poses. */
export function rotationPath(from: Vec3, to: Vec3) {
    const first = rotationQuaternion(from), last = rotationQuaternion(to);
    let relative = multiply(last, { x: -first.x, y: -first.y, z: -first.z, w: first.w });
    if (relative.w < 0)
        relative = { x: -relative.x, y: -relative.y, z: -relative.z, w: -relative.w };
    const vector = rotationVector(relative), angle = length(vector), axis = normalize(vector);
    return {
        angle,
        at: (t: number) => t === 0 ? first : t === 1 ? last : multiply(quaternionFromAxisAngle(axis, angle * t), first),
        /** Earliest exit-floor crossing. Split at exact sinusoid extrema, not samples. */
        floorFraction(tangent: Vec3, floor: number): number {
            if (angle < 1e-14)
                return 1;
            const exit = rotateVector(tangent, first);
            const c = axis.y * dot(axis, exit), a = exit.y - c, b = cross(axis, exit).y;
            const y = (theta: number) => a * Math.cos(theta) + b * Math.sin(theta) + c;
            const points = [0, angle];
            const phase = Math.atan2(b, a);
            for (let k = -2; k <= 2; k++) {
                const x = phase + k * Math.PI;
                if (x > 0 && x < angle)
                    points.push(x);
            }
            points.sort((a, b) => a - b);
            for (let i = 1; i < points.length; i++)
                if (y(points[i]) < floor - 1e-12) {
                    let lo = points[i - 1], hi = points[i];
                    for (let j = 0; j < 48; j++) {
                        const mid = (lo + hi) / 2;
                        if (y(mid) >= floor)
                            lo = mid;
                        else
                            hi = mid;
                    }
                    return clamp(lo / angle, 0, 1);
                }
            return 1;
        },
    };
}
