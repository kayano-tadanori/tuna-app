"""A1 intermediate playback, deliberately NOT an ORIGAMI_WORKS exporter.

Matrices are row-major, column vectors; paper (x,y) maps to (x,0,-y).
Zero thickness geometry and face-specific layer ranks are separate channels.
"""
import sys
sys.dont_write_bytecode = True
import argparse
import copy
import hashlib
import json
import math
from pathlib import Path

from origami_recipe import HERE, RecipeError, parse, replay, resolve, source_polygon
from fold2d import xf_apply, xf_inv_apply
from to_work_js import build_bones


def identity():
    return [[float(i == j) for j in range(4)] for i in range(4)]


def multiply(a, b):
    return [[sum(a[i][k]*b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]


def apply(m, p, vector=False):
    q = list(p) + [0 if vector else 1]
    return [sum(m[i][j]*q[j] for j in range(4)) for i in range(3)]


def rotation(origin, axis, angle):
    x, y, z = axis
    c, s, t = math.cos(angle), math.sin(angle), 1-math.cos(angle)
    m = identity()
    m[:3] = [[t*x*x+c, t*x*y-s*z, t*x*z+s*y, 0],
             [t*x*y+s*z, t*y*y+c, t*y*z-s*x, 0],
             [t*x*z-s*y, t*y*z+s*x, t*z*z+c, 0]]
    for i in range(3):
        m[i][3] = origin[i] - sum(m[i][j]*origin[j] for j in range(3))
    return m


def matrices(data, angles):
    out = []
    for bone, angle in zip(data['bones'], angles):
        parent = identity() if bone['parent'] == -1 else out[bone['parent']]
        h = bone['hinge']
        out.append(parent if h is None else multiply(parent, rotation(h['origin'], h['axis'], angle)))
    return out


def ancestor(frame, face_id):
    found = [p for p in frame if face_id == p['recipeFace']['faceId'] or
             face_id.startswith(p['recipeFace']['faceId'] + '/')]
    if len(found) != 1:
        raise RecipeError('ambiguous playback face ancestry: ' + face_id)
    return found[0]


def compile_playback(recipe):
    state, frames = replay(recipe)
    raw_bones, ids = build_bones(state)
    ratio = recipe['paper']['aspectRatio']
    bones = []
    for b in raw_bones:
        h = b['hinge']
        hinge = None
        if h:
            a, q = h['a'], h['b']
            length = math.dist(a, q)
            if length < 1e-8:
                raise RecipeError('degenerate playback hinge')
            hinge = {'origin': [a[0], 0, -a[1]],
                     'axis': [(q[0]-a[0])/length, 0, -(q[1]-a[1])/length]}
        bones.append({'parent': b['parent'], 'hinge': hinge,
                      'sourceStepIndex': b['step'], 'sourceStepIds': [recipe['steps'][i]['id'] for i in b['key']]})
    faces, verts, tris, vertex_bones = [], [], [], []
    for p in state.panels:
        src = source_polygon(p)
        # Source winding is always positive, independent of final front/back.
        if sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(src, src[1:]+src[:1])) < 0:
            src.reverse()
        bi, start, tri_start = ids[tuple(p['hist'])], len(verts), len(tris)
        verts.extend([[x, 0, -y] for x,y in src])
        vertex_bones.extend([bi]*len(src))
        tris.extend([[start, start+j, start+j+1] for j in range(1, len(src)-1)])
        faces.append({**copy.deepcopy(p['recipeFace']), 'boneId': bi,
                      'sourcePolygon': [[x,y*ratio] for x,y in src],
                      'vertexIds': list(range(start, len(verts))),
                      'triangleIds': list(range(tri_start, len(tris)))})
    canonical = json.dumps(recipe, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False)
    data = {'format': 'origami-playback', 'version': 1, 'status': 'intermediate-only',
            'coordinateConvention': 'row-major-column-vector; paper(x,y)->(x,0,-y/aspectRatio)',
            'recipe': copy.deepcopy(recipe), 'recipeSha256': hashlib.sha256(canonical.encode()).hexdigest(),
            'bones': bones, 'faces': faces,
            'mesh': {'verts': verts, 'tris': tris, 'panel': vertex_bones},
            'steps': [], 'frames': [],
            'limitations': ['Layer ranks are a 2D replay oracle, not a 3D collision simulation.',
                            'Original hints are preserved, not rewritten for an app camera.',
                            'No app registration or work JS export.']}
    pose, angles, recorded = identity(), [0.0]*len(bones), []

    def snapshot(frame):
        mapping = []
        for f in faces:
            p = ancestor(frame, f['faceId'])
            mapping.append({'faceId': p['recipeFace']['faceId'],
                            'layerPath': copy.deepcopy(p['recipeFace']['layerPath']),
                            'oracleAffine': list(p['xf']),
                            'layerRank': p['layer']})
        # body rank is unchanged by flip; pose supplies the sign once.
        return {'bodyPose': copy.deepcopy(pose), 'boneAngles': list(angles),
                'recordedCreases': list(recorded), 'faceStates': mapping,
                'bodyLayerRanks': [m['layerRank']*pose[1][1] for m in mapping]}

    data['frames'].append(snapshot(frames[0]))
    for i, step in enumerate(recipe['steps']):
        event = {'sourceStepId': step['id'], 'diagramStep': step['diagramStep'],
                 'op': step['op'], 'originalInstruction': step['instruction'],
                 'beforeFrame': i, 'afterFrame': i+1, 'boneIds': []}
        if step['op'] == 'flip':
            axis = [0,0,1] if step['axis'] == 'v' else [1,0,0]
            event.update(axis=step['axis'], rotationAxis=axis, angle=math.pi)
            pose = multiply(rotation([0,0,0], axis, math.pi), pose)
        else:
            target_ids = {resolve(frames[i], ref)['recipeFace']['faceId'] for ref in step['targets']}
            target_faces = [j for j,f in enumerate(faces) if ancestor(frames[i], f['faceId'])['recipeFace']['faceId'] in target_ids]
            event.update(kind=step['kind'], reference=copy.deepcopy(step['reference']),
                         targets=copy.deepcopy(step['targets']), targetFaceIndices=target_faces,
                         line=copy.deepcopy(step['line']), movingSidePoint=copy.deepcopy(step['movingSidePoint']))
            # Each target gets its own original-coordinate line, even on reflected layers.
            ref = resolve(frames[i], step['reference'])
            current_line = [xf_apply(ref['xf'], (x,y/ratio)) for x,y in step['line']]
            event['targetLines'] = []
            for ref_id in sorted(target_ids):
                p = resolve(frames[i], {'faceId': ref_id})
                event['targetLines'].append({'faceId': ref_id,
                    'sourceLine': [[x,y*ratio] for x,y in [xf_inv_apply(p['xf'], q) for q in current_line]],
                    'clipToFace': True})
            if step['op'] == 'crease':
                recorded.append(step['id'])
            else:
                active = [j for j,b in enumerate(bones) if b['sourceStepIndex'] == i]
                if not active:
                    raise RecipeError('fold has no playback bone')
                event['boneIds'] = active
                for bi in active:
                    # Use a descendant's interior point: a virtual parent may have no mesh.
                    candidates = [j for j,p in enumerate(state.panels) if tuple(p['hist'][:len(raw_bones[bi]['key'])]) == tuple(raw_bones[bi]['key'])]
                    sample = max(([sum(verts[v][k] for v in faces[j]['vertexIds'])/len(faces[j]['vertexIds']) for k in range(3)] for j in candidates),
                                 key=lambda p: math.dist(p, bones[bi]['hinge']['origin']))
                    probe = list(angles); probe[bi] = math.pi/2
                    pm = matrices(data, probe)
                    lift = apply(multiply(pose, pm[bi]), sample)[1]
                    if abs(lift) < 1e-8:
                        raise RecipeError('cannot determine fold rotation direction')
                    angles[bi] = math.pi * (1 if lift*(1 if step['kind']=='V' else -1) > 0 else -1)
                event['targetAngles'] = [angles[j] for j in active]
                # Moving descendants must all belong to explicitly selected layers.
                affected = [j for j,p in enumerate(state.panels) if i in p['hist']]
                if not set(affected) <= set(target_faces):
                    raise RecipeError('bone moves an untargeted face')
                event['movingFaceIndices'] = affected
        data['steps'].append(event)
        data['frames'].append(snapshot(frames[i+1]))
    verify_playback(data)
    return data


def verify_playback(data, tolerance=1e-5):
    """Compare a serialized artifact's bone kinematics with a fresh 2D replay.

Checks layer transfer separately; this does not prove physical nonintersection.
"""
    recipe = data['recipe']
    _, oracle = replay(recipe)
    if len(data['frames']) != len(oracle) or len(data['steps']) != len(recipe['steps']):
        raise RecipeError('playback frame/step count mismatch')
    canonical = json.dumps(recipe, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False)
    if data['recipeSha256'] != hashlib.sha256(canonical.encode()).hexdigest():
        raise RecipeError('recipe hash mismatch')
    if data.get('format') != 'origami-playback' or data.get('version') != 1:
        raise RecipeError('unsupported playback format')
    json.dumps(data, allow_nan=False)
    for i, b in enumerate(data['bones']):
        if not -1 <= b['parent'] < i:
            raise RecipeError('invalid bone parent')
        if b['hinge'] and abs(math.dist(b['hinge']['axis'], [0,0,0])-1) > tolerance:
            raise RecipeError('invalid hinge axis')
    for frame in data['frames']:
        if len(frame['boneAngles']) != len(data['bones']) or len(frame['faceStates']) != len(data['faces']):
            raise RecipeError('invalid frame dimensions')
    vertex_ids, triangle_ids = [], []
    ratio = recipe['paper']['aspectRatio']
    for face in data['faces']:
        if not 0 <= face['boneId'] < len(data['bones']):
            raise RecipeError('invalid face bone')
        if len(face['vertexIds']) != len(face['sourcePolygon']) or len(face['vertexIds']) < 3:
            raise RecipeError('invalid face polygon')
        for vi, src in zip(face['vertexIds'], face['sourcePolygon']):
            if math.dist(data['mesh']['verts'][vi], [src[0],0,-src[1]/ratio]) > tolerance or data['mesh']['panel'][vi] != face['boneId']:
                raise RecipeError('source vertex/bone mismatch')
        for ti in face['triangleIds']:
            if len(data['mesh']['tris'][ti]) != 3 or not set(data['mesh']['tris'][ti]) <= set(face['vertexIds']):
                raise RecipeError('triangle face mismatch')
        vertex_ids.extend(face['vertexIds']); triangle_ids.extend(face['triangleIds'])
    if sorted(vertex_ids) != list(range(len(data['mesh']['verts']))) or sorted(triangle_ids) != list(range(len(data['mesh']['tris']))):
        raise RecipeError('mesh coverage mismatch')
    for i, (event, step) in enumerate(zip(data['steps'], recipe['steps'])):
        if (event['sourceStepId'], event['op'], event['originalInstruction'], event['beforeFrame'], event['afterFrame']) != (step['id'], step['op'], step['instruction'], i, i+1):
            raise RecipeError('step mapping mismatch')
        before, after = data['frames'][i:i+2]
        active = event['boneIds']
        for bi in range(len(data['bones'])):
            if bi not in active and before['boneAngles'][bi] != after['boneAngles'][bi]:
                raise RecipeError('inactive bone changed')
        if step['op'] != 'flip' and before['bodyPose'] != after['bodyPose']:
            raise RecipeError('local operation changed global pose')
        if step['op'] in ('crease', 'flip') and active:
            raise RecipeError('non-fold operation has fold bones')
        if step['op'] == 'flip':
            axis = [0,0,1] if step['axis']=='v' else [1,0,0]
            want = multiply(rotation([0,0,0], axis, math.pi), before['bodyPose'])
            if event['axis'] != step['axis'] or any(abs(want[r][c]-after['bodyPose'][r][c]) > tolerance for r in range(4) for c in range(4)):
                raise RecipeError('flip pose mismatch')
            if any(abs(a-b)>tolerance for a,b in zip(before['bodyLayerRanks'], after['bodyLayerRanks'])):
                raise RecipeError('flip changed body layer order')
        else:
            for field in ('line', 'kind', 'reference', 'targets', 'movingSidePoint'):
                if event[field] != step[field]:
                    raise RecipeError('original operation metadata lost')
            target_ids = {resolve(oracle[i], r)['recipeFace']['faceId'] for r in step['targets']}
            targets = [j for j,f in enumerate(data['faces']) if ancestor(oracle[i],f['faceId'])['recipeFace']['faceId'] in target_ids]
            if event['targetFaceIndices'] != targets:
                raise RecipeError('target mapping mismatch')
            if step['op']=='fold':
                want_active = [j for j,b in enumerate(data['bones']) if b['sourceStepIndex']==i]
                if active != want_active or event['targetAngles'] != [after['boneAngles'][j] for j in active]:
                    raise RecipeError('fold bone mapping mismatch')
                midpoint = list(before['boneAngles'])
                for bi in active:
                    midpoint[bi] = after['boneAngles'][bi]/2
                mm = matrices(data, midpoint)
                moved = []
                for j,f in enumerate(data['faces']):
                    chain, bi = [], f['boneId']
                    while bi >= 0:
                        chain.append(bi); bi=data['bones'][bi]['parent']
                    if not set(chain).intersection(active):
                        continue
                    moved.append(j)
                    sample = [sum(data['mesh']['verts'][v][k] for v in f['vertexIds'])/len(f['vertexIds']) for k in range(3)]
                    lift = apply(multiply(before['bodyPose'], mm[f['boneId']]), sample)[1]
                    if lift*(1 if step['kind']=='V' else -1) <= 1e-8:
                        raise RecipeError('fold rotation direction mismatch')
                if moved != event['movingFaceIndices'] or not set(moved) <= set(targets):
                    raise RecipeError('moving face mapping mismatch')
    max_error = 0.0
    for k, (frame, expected) in enumerate(zip(data['frames'], oracle)):
        bm = matrices(data, frame['boneAngles'])
        for j, face in enumerate(data['faces']):
            p = ancestor(expected, face['faceId'])
            m = multiply(frame['bodyPose'], bm[face['boneId']])
            for vi in face['vertexIds']:
                v = data['mesh']['verts'][vi]
                xy = xf_apply(p['xf'], (v[0], -v[2]))
                error = math.dist(apply(m, v), [xy[0], 0, -xy[1]])
                max_error = max(max_error, error)
                if error > tolerance:
                    raise RecipeError(f'frame {k} face {j}: position mismatch {error}')
            det = p['xf'][0]*p['xf'][3]-p['xf'][1]*p['xf'][2]
            if apply(m, [0,1,0], vector=True)[1]*det < 1-tolerance:
                raise RecipeError(f'frame {k} face {j}: front/back mismatch')
            fs = frame['faceStates'][j]
            if fs['oracleAffine'] != list(p['xf']):
                raise RecipeError('oracle affine mismatch')
            if fs['faceId'] != p['recipeFace']['faceId'] or fs['layerPath'] != p['recipeFace']['layerPath']:
                raise RecipeError('face provenance mismatch')
            if fs['layerRank'] != p['layer'] or abs(frame['bodyLayerRanks'][j]*frame['bodyPose'][1][1]-p['layer']) > tolerance:
                raise RecipeError('layer transfer mismatch')
        expected_creases = [s['id'] for s in recipe['steps'][:k] if s['op']=='crease']
        if frame['recordedCreases'] != expected_creases:
            raise RecipeError('crease record mismatch')
    return {'frames': len(oracle), 'faces': len(data['faces']), 'bones': len(data['bones']),
            'maxPositionError': max_error, 'tolerance': tolerance, 'layerCheck': '2D oracle transfer only'}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args(argv)
    try:
        data = compile_playback(parse(args.input.read_text(encoding='utf-8-sig')))
        report = verify_playback(data)
        if args.output:
            output = args.output.resolve()
            if not output.is_relative_to(HERE) or output.suffix != '.json':
                raise RecipeError('output must be a new .json inside tools/')
            text = json.dumps(data, ensure_ascii=False, allow_nan=False, indent=2)+'\n'
            with output.open('x', encoding='utf-8') as stream:
                stream.write(text)
        print(json.dumps(report))
        return 0
    except (RecipeError, OSError, ValueError) as exc:
        print(f'ERROR: {exc}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
