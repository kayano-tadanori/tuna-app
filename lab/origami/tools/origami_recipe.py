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

from fold2d import (FoldState, xf_apply, xf_inv_apply, point_in_polygon,
                    side_of_line, split_polygon)

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
            if isinstance(step, dict) and step.get('op') not in ('fold', 'crease', 'flip'):
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
            {'axis'} if step['op'] == 'flip' else {'kind', 'reference', 'line', 'movingSidePoint', 'targets'})
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


def replay(recipe):
    validate(recipe)
    ratio = recipe['paper']['aspectRatio']
    state = FoldState(1, 1 / ratio)
    state.panels[0]['recipeFace'] = {'faceId': 'paper', 'layerPath': []}
    frames = [copy.deepcopy(state.panels)]
    for i, step in enumerate(recipe['steps']):
        try:
            if step['op'] == 'flip':
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
