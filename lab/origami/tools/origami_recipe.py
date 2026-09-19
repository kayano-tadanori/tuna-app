"""Versioned, unfolded-coordinate recipes. No existing works are rebuilt.

Only the schema keywords used by the adjacent v1 schema are interpreted here;
this is intentionally not a general JSON Schema implementation.
"""
import sys
sys.dont_write_bytecode = True
import argparse
import copy
import json
import math
from pathlib import Path

from fold2d import (FoldState, xf_apply, xf_inv_apply, xf_compose, xf_is_flipped, point_in_polygon,
                    side_of_line, split_polygon, shared_edge, reflect_point, reflect_affine)

HERE = Path(__file__).resolve().parent
SCHEMA = json.loads((HERE / 'origami_recipe.schema.json').read_text(encoding='utf-8'))


class RecipeError(ValueError):
    pass


def schema_check(value, rule, path='$'):
    import re
    if rule is False:
        raise RecipeError(f'{path}: field is not allowed for this operation')
    if '$ref' in rule:
        return schema_check(value, SCHEMA['$defs'][rule['$ref'].split('/')[-1]], path)
    types = {'object': lambda x: type(x) is dict, 'array': lambda x: type(x) is list,
             'string': lambda x: type(x) is str, 'boolean': lambda x: type(x) is bool,
             'number': lambda x: type(x) in (int, float) and math.isfinite(x),
             'integer': lambda x: type(x) in (int, float) and math.isfinite(x) and int(x) == x}
    if 'type' in rule and not types[rule['type']](value):
        raise RecipeError(f'{path}: expected {rule["type"]}')
    if 'const' in rule and (type(value) is bool or value != rule['const']):
        raise RecipeError(f'{path}: expected {rule["const"]!r}')
    if 'enum' in rule and value not in rule['enum']:
        raise RecipeError(f'{path}: expected one of {rule["enum"]}')
    if isinstance(value, dict):
        for key in rule.get('required', []):
            if key not in value:
                raise RecipeError(f'{path}.{key}: required')
        props = rule.get('properties', {})
        for key, item in value.items():
            if key in props:
                schema_check(item, props[key], f'{path}.{key}')
            elif rule.get('additionalProperties') is False:
                raise RecipeError(f'{path}.{key}: unknown field')
    if isinstance(value, list):
        if len(value) < rule.get('minItems', 0) or len(value) > rule.get('maxItems', math.inf):
            raise RecipeError(f'{path}: invalid array length')
        if 'items' in rule:
            for i, item in enumerate(value):
                schema_check(item, rule['items'], f'{path}[{i}]')
    if isinstance(value, str):
        if len(value) < rule.get('minLength', 0) or len(value) > rule.get('maxLength', math.inf):
            raise RecipeError(f'{path}: invalid text length')
        if 'pattern' in rule and not re.search(rule['pattern'], value):
            raise RecipeError(f'{path}: invalid identifier')
    if type(value) in (int, float):
        if not math.isfinite(value) or value < rule.get('minimum', -math.inf) or value > rule.get('maximum', math.inf):
            raise RecipeError(f'{path}: number out of range')
    if 'oneOf' in rule:
        matches = 0
        for branch in rule['oneOf']:
            try:
                schema_check(value, branch, path)
                matches += 1
            except RecipeError:
                pass
        if matches != 1:
            raise RecipeError(f'{path}: fields do not match operation')


def validate(recipe):
    if isinstance(recipe, dict) and isinstance(recipe.get('steps'), list):
        for i, step in enumerate(recipe['steps']):
            if isinstance(step, dict) and step.get('op') not in ('fold', 'crease', 'flip', 'reverse'):
                if step.get('op') == 'petal':
                    raise RecipeError(f'steps[{i}] ({step.get("diagramStep", "?")}): unsupported operation "petal" (petal fold is a version 2 step; this reader does not replay it)')
                raise RecipeError(f'steps[{i}] ({step.get("diagramStep", "?")}): unsupported operation {step.get("op")!r}; squash/open-pocket are not supported in v1')
    schema_check(recipe, SCHEMA)
    seen = set()
    for i, step in enumerate(recipe['steps']):
        if step['id'] in seen:
            raise RecipeError(f'steps[{i}].id: duplicate step ID')
        seen.add(step['id'])
        allowed = {'id', 'diagramStep', 'op', 'instruction'} | (
            {'axis'} if step['op'] == 'flip' else
            {'reference', 'line', 'movingSidePoint', 'targets', 'hinge'} if step['op'] == 'reverse' else
            {'kind', 'reference', 'line', 'movingSidePoint', 'targets'})
        if set(step) - allowed:
            raise RecipeError(f'steps[{i}]: fields do not match operation')
    return recipe


def parse(text):
    try:
        return validate(json.loads(text,
                                   parse_constant=lambda x: (_ for _ in ()).throw(RecipeError(f'non-finite number: {x}'))))
    except (json.JSONDecodeError, RecursionError) as exc:
        raise RecipeError(f'invalid JSON: {exc}') from exc


def resolve(panels, ref):
    face_id = ref['faceId']
    # A root ID plus structural path is an alternative to the full leaf ID.
    if 'layerPath' in ref and face_id == 'paper':
        face_id += ''.join(f'/{p["stepId"]}.{p["side"]}' for p in ref['layerPath'])
    found = [p for p in panels if p['recipeFace']['faceId'] == face_id]
    if len(found) != 1:
        raise RecipeError(f'unknown or retired faceId: {face_id}')
    if 'layerPath' in ref and found[0]['recipeFace']['layerPath'] != ref['layerPath']:
        raise RecipeError(f'layerPath does not match faceId: {face_id}')
    return found[0]


def source_polygon(panel):
    return [xf_inv_apply(panel['xf'], q) for q in panel['poly']]


def assign_faces(state, previous, step, a, b):
    """Use original geometry to recover ancestry; never use bone/history indices."""
    old = [(p, source_polygon(p)) for p in previous]
    for panel in state.panels:
        src = source_polygon(panel)
        center = tuple(sum(q[k] for q in src) / len(src) for k in (0, 1))
        parents = [p for p, poly in old if point_in_polygon(center, poly)]
        if len(parents) != 1:
            raise RecipeError('ambiguous face provenance')
        parent = parents[0]
        provenance = copy.deepcopy(parent['recipeFace'])
        siblings = [q for q in state.panels if point_in_polygon(
            tuple(sum(v[k] for v in source_polygon(q)) / len(q['poly']) for k in (0, 1)), source_polygon(parent))]
        if len(siblings) > 1:
            side = 'cut' if side_of_line(xf_apply(parent['xf'], center), a, b) < 0 else 'keep'
            provenance['faceId'] += f'/{step["id"]}.{side}'
            provenance['layerPath'].append({'stepId': step['id'], 'side': side})
        panel['recipeFace'] = provenance


# ---------------------------------------------------------------------------
# 中割り（op:'reverse'）の独立した再生（2026-09-19・recipe_crane13.md 第24段）。
# freefold_engine.js とは別に書いた照合用の読み手。**JS の結び（bonds）は使わない**：
#   紙のつながり＝素材の形（原紙座標）で辺を共有する2面／背＝hinge.faceIds の2面が素材で共有する辺そのもの。
# 決めること：背の引き直しと seg の照合・頂点（線が背の線分の内側を横切る）・背の両側（背の線の片側の内部へ入る
#   つながりだけをたどる）・フラップが両側にまたがり全層を二つに分けること・先の部分は線での鏡・
#   入れ子（各側の動いた面は自分の側の内側へ順を逆に／下の側の先は上の側の先の下）・背の先の区間の反転。
# ⚠ foldableSet の関門（下に紙・裂け）はここでは見ない＝成立の判定は engine。ここは「成立した手の結果」を独立に作って照合する。
# ---------------------------------------------------------------------------
REV_TOL = 1e-9


def _centroid(poly):
    return (sum(q[0] for q in poly) / len(poly), sum(q[1] for q in poly) / len(poly))


def _area(poly):
    return abs(sum(poly[i][0] * poly[(i + 1) % len(poly)][1] - poly[(i + 1) % len(poly)][0] * poly[i][1]
                   for i in range(len(poly)))) / 2


def _clip_convex(subject, clip):
    """凸多角形どうしの共通部分（Sutherland–Hodgman）。向きは clip の符号付き面積で合わせる。"""
    sgn = 1 if sum(clip[i][0] * clip[(i + 1) % len(clip)][1] - clip[(i + 1) % len(clip)][0] * clip[i][1]
                   for i in range(len(clip))) > 0 else -1
    out = list(subject)
    for i in range(len(clip)):
        a, b = clip[i], clip[(i + 1) % len(clip)]
        inp, out = out, []
        if not inp:
            break
        for j in range(len(inp)):
            p, q = inp[j], inp[(j + 1) % len(inp)]
            sp, sq = sgn * side_of_line(p, a, b), sgn * side_of_line(q, a, b)
            if sp >= 0:
                out.append(p)
            if (sp >= 0) != (sq >= 0):
                t = sp / (sp - sq)
                out.append((p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t))
    return out if len(out) >= 3 else None


def overlap_area(p, q):
    c = _clip_convex(p, q)
    return _area(c) if c else 0.0


def _material_adjacency(panels):
    """紙のつながり：素材の形で辺を共有する2面（その共有辺＝素材座標）。"""
    src = [source_polygon(p) for p in panels]
    adj = {i: [] for i in range(len(panels))}
    for i in range(len(panels)):
        for j in range(i + 1, len(panels)):
            e = shared_edge(src[i], src[j])
            if e:
                adj[i].append((j, e))
                adj[j].append((i, e))
    return adj


def _side_set(panels, adj, start, a, b):
    """start の面から、背の線 a-b の start の側の内部へ入るつながりだけをたどって集める。"""
    L = math.dist(a, b)
    s0 = 1 if side_of_line(_centroid(panels[start]['poly']), a, b) > 0 else -1
    seen, stack = {start}, [start]
    while stack:
        i = stack.pop()
        for j, e in adj[i]:
            if j in seen:
                continue
            c = [xf_apply(panels[i]['xf'], q) for q in e]
            d = [s0 * side_of_line(q, a, b) / L for q in c]
            if d[0] <= REV_TOL and d[1] <= REV_TOL:
                continue                    # 背の線の上か、反対側
            if d[0] > REV_TOL and d[1] > REV_TOL:
                inside = math.dist(*c)
            else:                           # 片端だけ内部：内部に入っている長さ
                k = 0 if d[0] > REV_TOL else 1
                t = d[k] / (d[k] - d[1 - k])
                x = (c[k][0] + (c[1 - k][0] - c[k][0]) * t, c[k][1] + (c[1 - k][1] - c[k][1]) * t)
                inside = math.dist(c[k], x)
            if inside > 1e-7:
                seen.add(j)
                stack.append(j)
    return seen


def _static_side(pa, pb):
    """畳まれた結び a|b で、b が a の表の側(+1)か裏の側(-1)か。開いていれば 0。"""
    if xf_is_flipped(pa['xf']) == xf_is_flipped(pb['xf']):
        return 0
    return (1 if pb['layer'] > pa['layer'] else -1) * (-1 if xf_is_flipped(pa['xf']) else 1)


def reverse_step(panels, step, step_index, ratio=1.0):
    """中割りの1手。返すのは (新しい面の並び, 情報)。層は重なりの上下から振り直す（番号の値は照合しない）。"""
    by_id = {p['recipeFace']['faceId']: i for i, p in enumerate(panels)}
    reference = resolve(panels, step['reference'])
    targets = [resolve(panels, ref) for ref in step['targets']]
    if len({p['recipeFace']['faceId'] for p in targets}) != len(targets):
        raise RecipeError('duplicate targets')
    if reference not in targets:
        raise RecipeError('reference face must be a target')
    def current(pt):
        return xf_apply(reference['xf'], (pt[0], pt[1] / ratio))
    a, b = map(current, step['line'])
    moving = current(step['movingSidePoint'])
    if side_of_line(moving, a, b) > 0:
        a, b = b, a
    # 背：hinge.faceIds の2面が素材で共有する辺。保存した seg はそれと一致すること（識別の照合だけ）
    h = step['hinge']
    if any(fid not in by_id for fid in h['faceIds']):
        raise RecipeError('hinge faces are not in the current paper')
    ix, iy = (by_id[fid] for fid in h['faceIds'])
    px, py = panels[ix], panels[iy]
    e = shared_edge(source_polygon(px), source_polygon(py))
    if not e:
        raise RecipeError('hinge faces do not share an edge')
    seg = [tuple(q) for q in h['seg']]
    if not any(all(math.dist(seg[k], e[m[k]]) <= 1e-12 for k in (0, 1)) for m in ((0, 1), (1, 0))):
        raise RecipeError('hinge seg does not match the shared edge of its faces')
    cur = [xf_apply(px['xf'], q) for q in seg]
    if max(math.dist(cur[k], xf_apply(py['xf'], seg[k])) for k in (0, 1)) > 1e-7:
        raise RecipeError('hinge seg does not coincide on both faces')
    if xf_is_flipped(px['xf']) == xf_is_flipped(py['xf']):
        raise RecipeError('hinge is open (not folded)')
    # 頂点：線が背の線分の内側を横切る
    u, v = side_of_line(cur[0], a, b), side_of_line(cur[1], a, b)
    L = math.dist(a, b)
    if not ((u / L > REV_TOL and v / L < -REV_TOL) or (u / L < -REV_TOL and v / L > REV_TOL)):
        raise RecipeError('the line does not cross the hinge (vertex outside)')
    t = u / (u - v)
    vertex = (cur[0][0] + (cur[1][0] - cur[0][0]) * t, cur[0][1] + (cur[1][1] - cur[0][1]) * t)
    # 背の両側
    adj = _material_adjacency(panels)
    X, Y = _side_set(panels, adj, ix, *cur), _side_set(panels, adj, iy, *cur)
    if iy in X or ix in Y or X & Y:
        raise RecipeError('both sides of the hinge are connected elsewhere (loop)')
    tids = {by_id[p['recipeFace']['faceId']] for p in targets}
    if ix not in tids or iy not in tids or not tids <= (X | Y):
        raise RecipeError('flap is not joined by the hinge')
    if not (tids & X) or not (tids & Y):
        raise RecipeError('flap is not split across the hinge')
    lower = X if px['layer'] < py['layer'] else Y
    R = reflect_affine(a, b)
    new, info = [], []   # info[k] = (moved, side ∈ {'L','U',None}, 元の層)
    for i, p in enumerate(panels):
        side = ('L' if i in lower else 'U') if i in (X | Y) else None
        if i not in tids:
            new.append(p)
            info.append((False, side, p['layer']))
            continue
        keep, cut = split_polygon(p['poly'], a, b)
        if not (keep and cut and _area(keep) > 1e-9 and _area(cut) > 1e-9):
            raise RecipeError('the line does not cross every layer of the flap')
        rf = p['recipeFace']
        k = dict(p, poly=keep, recipeFace={'faceId': rf['faceId'] + f'/{step["id"]}.keep', 'layerPath': rf['layerPath'] + [{'stepId': step['id'], 'side': 'keep'}]})
        c = dict(p, poly=[reflect_point(q, a, b) for q in cut], xf=xf_compose(R, p['xf']), hist=p.get('hist', ()) + (step_index,), pre_xf=p['xf'],
                 recipeFace={'faceId': rf['faceId'] + f'/{step["id"]}.cut', 'layerPath': rf['layerPath'] + [{'stepId': step['id'], 'side': 'cut'}]})
        new += [k, c]
        info += [(False, side, p['layer']), (True, side, p['layer'])]
    # 入れ子：重なり（面積あり）の組ごとに上下を決め、元の層を優先した順に並べる
    n = len(new)
    below = {i: set() for i in range(n)}       # below[j] ∋ i ＝ i が j の下
    for i in range(n):
        for j in range(i + 1, n):
            if overlap_area(new[i]['poly'], new[j]['poly']) <= 1e-8:
                continue
            (mi, si, li), (mj, sj, lj) = info[i], info[j]
            if not mi and not mj:
                lo = i if li < lj else j if lj < li else None
            elif mi and mj:
                if si != sj:
                    lo = i if si == 'L' else j
                else:
                    lo = i if li > lj else j if lj > li else None   # 同じ側は順を逆に
            else:
                m, o = (i, j) if mi else (j, i)
                so = info[o][1]
                lo = o if so == 'L' else m if so == 'U' else (o if info[o][2] < info[m][2] else m)
            if lo is not None:
                hi = j if lo == i else i
                below[hi].add(lo)
    order, placed = [], set()
    while len(order) < n:
        ready = [k for k in range(n) if k not in placed and below[k] <= placed]
        if not ready:
            raise RecipeError('nesting order has a cycle')
        k = min(ready, key=lambda k: (info[k][2] + (.5 if info[k][0] else 0), k))
        order.append(k)
        placed.add(k)
    for r, k in enumerate(order):
        new[k] = dict(new[k], layer=r)
    # 背の先の区間の反転：動いた2面（x・y の先の部分）の静的な側が、元の x|y から入れかわること
    fx_cut = next(q for q in new if q['recipeFace']['faceId'] == px['recipeFace']['faceId'] + f'/{step["id"]}.cut')
    fy_cut = next(q for q in new if q['recipeFace']['faceId'] == py['recipeFace']['faceId'] + f'/{step["id"]}.cut')
    before, after = _static_side(px, py), _static_side(fx_cut, fy_cut)
    if not before or not after or before == after:
        raise RecipeError('the hinge beyond the vertex is not reversed')
    return new, {'vertex': vertex, 'reversed': (fx_cut['recipeFace']['faceId'], fy_cut['recipeFace']['faceId']),
                 'sides': (len(X), len(Y))}


def replay(recipe):
    validate(recipe)
    ratio = recipe['paper']['aspectRatio']
    state = FoldState(1, 1 / ratio)
    state.panels[0]['recipeFace'] = {'faceId': 'paper', 'layerPath': []}
    frames = [copy.deepcopy(state.panels)]
    for i, step in enumerate(recipe['steps']):
        try:
            if step['op'] == 'reverse':
                state.panels, _ = reverse_step(state.panels, step, len(state.steps), ratio)
                state.steps.append({'name': step['instruction'], 'kind': None, 'op': 'reverse', 'partial': True})
                state._snap()
            elif step['op'] == 'flip':
                state.flip(step['axis'])
            else:
                reference = resolve(state.panels, step['reference'])
                targets = [resolve(state.panels, ref) for ref in step['targets']]
                if len({p['recipeFace']['faceId'] for p in targets}) != len(targets):
                    raise RecipeError('duplicate targets')
                if reference not in targets:
                    raise RecipeError('reference face must be a target')
                def current(pt):
                    return xf_apply(reference['xf'], (pt[0], pt[1] / ratio))
                a, b = map(current, step['line'])
                moving = current(step['movingSidePoint'])
                if math.dist(a, b) < 1e-8:
                    raise RecipeError('zero-length fold line')
                if not point_in_polygon(moving, reference['poly']):
                    raise RecipeError('movingSidePoint is outside reference face')
                side = side_of_line(moving, a, b)
                if abs(side) < 1e-8:
                    raise RecipeError('movingSidePoint lies on fold line')
                if side > 0:
                    a, b = b, a
                if not any(split_polygon(p['poly'], a, b)[1] for p in targets):
                    raise RecipeError('operation moves no face')
                previous = copy.deepcopy(state.panels)
                target_ids = {id(p) for p in targets}
                state.fold(a, b, step['kind'], panel_filter=lambda p: id(p) in target_ids,
                           name=step['instruction'], move=step['op'] == 'fold')
                if len(state.steps) != i + 1:
                    raise RecipeError('operation produced no step')
                assign_faces(state, previous, step, a, b)
            if len(state.panels) > 1024:
                raise RecipeError('face limit exceeded (1024)')
            frames.append(copy.deepcopy(state.panels))
        except RecipeError as exc:
            raise RecipeError(f'steps[{i}] / diagram {step["diagramStep"]}: {exc}') from exc
    return state, frames


def convert(recipe):
    if any(s['op'] == 'reverse' for s in recipe['steps']):
        raise RecipeError('convert does not compile reverse (inside reverse fold) yet; replay() reads it')
    from to_work_js import to_work
    state, frames = replay(recipe)
    meta = recipe['work']
    work = to_work(state, meta['id'], meta['name'], meta['emoji'], meta['difficulty'],
                   color_down=recipe['paper']['colorDown'])
    bone_ids = {tuple(b['key']): i for i, b in enumerate(work.pop('_bones'))}
    faces = [{**p['recipeFace'], 'boneId': bone_ids[tuple(p['hist'])],
              'sourcePolygon': [[x, y * recipe['paper']['aspectRatio']] for x, y in source_polygon(p)]}
             for p in state.panels]
    return {'format': 'origami-compiled', 'version': 1, 'recipe': copy.deepcopy(recipe),
            'work': work, 'faces': faces}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('--output', type=Path, help='new .json output; existing paths are never overwritten')
    parser.add_argument('--check', action='store_true', help='validate and replay without writing')
    args = parser.parse_args(argv)
    try:
        recipe = parse(args.input.read_text(encoding='utf-8-sig'))
        if args.check:
            state, _ = replay(recipe)
            print(f'OK: {len(state.steps)} steps, {len(state.panels)} faces')
            return 0
        if args.output is None:
            raise RecipeError('--output is required (or use --check)')
        output = args.output.resolve()
        if not output.is_relative_to(HERE.parent) or output.suffix != '.json':
            raise RecipeError('output must be a .json file inside origami/')
        if output.is_relative_to(HERE.parent / 'js') or output.exists():
            raise RecipeError('output must be new and outside js/; existing files are never overwritten')
        text = json.dumps(convert(recipe), ensure_ascii=False, allow_nan=False, indent=2)
        with output.open('x', encoding='utf-8') as stream:
            stream.write(text + '\n')
        print(f'Created: {output}')
        return 0
    except (RecipeError, OSError, ValueError) as exc:
        print(f'ERROR: {exc}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
