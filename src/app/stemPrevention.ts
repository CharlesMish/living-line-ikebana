import { aimRotation, applyAimRotation, applyBendRotation, bendRotationVector, translatePendingGraph, translatePlantBaseWithResult } from '../core/edit.ts';
import { sampleBranch } from '../core/arcLength.ts';
import { clonePlantGraph } from '../core/clone.ts';
import { clamp, length, normalize, subtract, type Vec3 } from '../core/math.ts';
import { rotationPath, rotationVector } from '../core/rotationPath.ts';
import { aimPointSpeeds, bendPointSpeeds, contactEnvironment, insertionContacts, interpolateParameter, limitStemMotion, parameterDistance, type ContactEnvironment } from '../core/stemContact.ts';
import type { PlantGraph } from '../core/types.ts';
import type { StemOverlap } from '../core/stemOverlaps.ts';
import type { AimSpec, BendSpec, BaseSpec } from '../input/types.ts';
import type { StudioContextMap } from './domainAdapters.ts';
export interface PreventionFeedback {
    reason: 'clear' | 'contact' | 'budget' | 'insertion';
    existingPairs: number;
    marks: StemOverlap[];
}
interface Session {
    parameter: Vec3;
    environment: ContactEnvironment;
}
const zero = () => ({ x: 0, y: 0, z: 0 });
/** One instance per coordinator; WeakMap specs expire with each transaction. */
export class StemPrevention {
    feedback: PreventionFeedback = { reason: 'clear', existingPairs: 0, marks: [] };
    private sessions = new WeakMap<object, Session>();
    constructor(readonly enabled: () => boolean, readonly plants: () => Iterable<PlantGraph>) { }
    private session(snapshot: PlantGraph, spec: object, start: Vec3): Session {
        let session = this.sessions.get(spec);
        if (!session) {
            session = { parameter: { ...start }, environment: contactEnvironment(snapshot, [...this.plants()].map(clonePlantGraph)) };
            this.sessions.set(spec, session);
        }
        return session;
    }
    insert(graph: PlantGraph) {
        const marks = insertionContacts(graph, contactEnvironment(graph, this.plants(), false));
        this.feedback = { reason: marks.length ? 'insertion' : 'clear', existingPairs: 0, marks };
        return marks.length === 0;
    }
    aim(snapshot: PlantGraph, spec: AimSpec<StudioContextMap['aim']>, target: Vec3) {
        const branch = snapshot.branches.get(spec.branchId)!;
        const grip = spec.context.surfaceGrip ?? sampleBranch(branch, spec.grabbedMaterialDistance).position;
        const desired = rotationVector(aimRotation(snapshot, spec.branchId, grip, target));
        const session = this.session(snapshot, spec, zero());
        const path = rotationPath(session.parameter, desired);
        const exit = normalize(subtract(branch.points[1], branch.points[0]));
        const floor = Math.min(exit.y, clamp(.08 / Math.max(branch.activeLength, 1e-6), 0, 1));
        const end = branch.kind === 'trunk' ? path.floorFraction(exit, floor) : 1;
        const result = limitStemMotion({
            at: t => applyAimRotation(snapshot, spec.branchId, path.at(t * end)),
            speeds: aimPointSpeeds(snapshot, spec.branchId, path.angle * end),
        }, session.environment);
        session.parameter = rotationVector(path.at(result.fraction * end));
        this.feedback = { reason: end < 1 && result.reason === 'clear' ? 'contact' : result.reason, existingPairs: session.environment.exempt.size, marks: result.marks };
        return result.graph;
    }
    bend(snapshot: PlantGraph, spec: BendSpec<StudioContextMap['bend']>, target: Vec3) {
        const request = { branchId: spec.branchId, stationDistance: spec.stationDistance, target };
        const desired = bendRotationVector(snapshot, request), session = this.session(snapshot, spec, zero());
        // The shared authored law caps at .996 radians for stiffness in [0,1].
        // Fail closed if a future solver exceeds the proof's <=1-radian domain.
        if (length(desired) > 1 || length(session.parameter) > 1) {
            this.feedback = { reason: 'budget', existingPairs: session.environment.exempt.size, marks: [] };
            return applyBendRotation(snapshot, request, session.parameter);
        }
        const from = session.parameter;
        const result = limitStemMotion({
            at: t => applyBendRotation(snapshot, request, interpolateParameter(from, desired, t)),
            speeds: bendPointSpeeds(snapshot, spec.branchId, parameterDistance(from, desired), spec.stationDistance),
        }, session.environment);
        session.parameter = interpolateParameter(from, desired, result.fraction);
        this.feedback = { reason: result.reason, existingPairs: session.environment.exempt.size, marks: result.marks };
        return result.graph;
    }
    base(snapshot: PlantGraph, spec: BaseSpec<StudioContextMap['base']>, requested: Vec3) {
        const root = snapshot.branches.get(snapshot.rootBranchId)!;
        const session = this.session(snapshot, spec, root.points[0]);
        const desired = translatePlantBaseWithResult(snapshot, requested).base, from = session.parameter;
        const speed = parameterDistance(from, desired);
        const result = limitStemMotion({
            at: t => translatePendingGraph(snapshot, interpolateParameter(from, desired, t)),
            speeds: new Map([...snapshot.branches.keys()].map(id => [id, speed])),
            translation: subtract(desired, from),
        }, session.environment);
        session.parameter = interpolateParameter(from, desired, result.fraction);
        this.feedback = { reason: result.reason, existingPairs: session.environment.exempt.size, marks: result.marks };
        return result.graph;
    }
}
