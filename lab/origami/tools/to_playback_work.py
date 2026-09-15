"""Build an A2-only ORIGAMI_WORKS script from verified origami-playback data."""
import sys
sys.dont_write_bytecode = True
import argparse
import copy
import json
import math
from pathlib import Path
from origami_recipe import HERE, RecipeError, parse
from origami_playback import compile_playback, verify_playback


def line_in_polygon(line, polygon, tol=1e-8):
    a,b=line; dx=b[0]-a[0]; dy=b[1]-a[1]; hits=[]
    for p,q in zip(polygon,polygon[1:]+polygon[:1]):
        ex=q[0]-p[0]; ey=q[1]-p[1]; den=dx*ey-dy*ex
        if abs(den)<tol: continue
        t=((p[0]-a[0])*ey-(p[1]-a[1])*ex)/den
        u=((p[0]-a[0])*dy-(p[1]-a[1])*dx)/den
        if -tol<=u<=1+tol: hits.append((t,[a[0]+t*dx,a[1]+t*dy]))
    unique=[]
    for t,p in sorted(hits):
        if not unique or math.dist(p,unique[-1][1])>tol: unique.append((t,p))
    if len(unique)<2: raise RecipeError('crease line does not cross target face')
    return unique[0][1],unique[-1][1]


def runtime_work(data, work_id):
    verify_playback(data)
    if not work_id.startswith('proto_') or not work_id.replace('_','').isalnum():
        raise RecipeError('prototype id must start with proto_')
    if any(s['op']=='flip' for s in data['steps']):
        raise RecipeError('flip playback belongs to A3')
    ratio=data['recipe']['paper']['aspectRatio']; mesh=copy.deepcopy(data['mesh'])
    mesh.update(boneParent=[b['parent'] for b in data['bones']],
                hinge=[b['hinge'] for b in data['bones']], flatStack=True,
                panel2=[0]*len(mesh['verts']))
    for fi,face in enumerate(data['faces']):
        for vi in face['vertexIds']: mesh['panel2'][vi]=fi
    hw=1; hh=1/ratio
    mesh['uv']=[[(v[0]+hw)/(2*hw),(-v[2]+hh)/(2*hh)] for v in mesh['verts']]
    steps=[]
    for event in data['steps']:
        step={'sourceStepId':event['sourceStepId'],'diagramStep':event['diagramStep'],
              'op':event['op'],'hintLabel':event['originalInstruction']}
        lines=[]
        if event['op']!='flip':
            for target in event['targetLines']:
                for fi in event['targetFaceIndices']:
                    face=data['faces'][fi]
                    before=data['frames'][event['beforeFrame']]['faceStates'][fi]
                    if before['faceId']!=target['faceId']: continue
                    try: a,b=line_in_polygon(target['sourceLine'],face['sourcePolygon'])
                    except RecipeError: continue
                    lines.append({'boneId':face['boneId'],'a':[a[0],0,-a[1]/ratio],
                                  'b':[b[0],0,-b[1]/ratio],
                                  'kind':'valley' if event['kind']=='V' else 'mountain'})
            step['creaseLines']=lines
            if not lines: raise RecipeError('operation has no drawable crease segment')
        if event['op']=='fold':
            main=event['boneIds'][0]; hinge=mesh['hinge'][main]
            candidates=[]
            for face in data['faces']:
                bone=face['boneId']; chain=[]
                while bone>=0: chain.append(bone);bone=mesh['boneParent'][bone]
                if main in chain: candidates.extend(face['vertexIds'])
            o,u=hinge['origin'],hinge['axis']
            def distance(vi):
                v=mesh['verts'][vi];w=[v[k]-o[k] for k in range(3)];dot=sum(w[k]*u[k] for k in range(3))
                return math.sqrt(sum((w[k]-dot*u[k])**2 for k in range(3)))
            vi=max(candidates,key=distance);p=mesh['verts'][vi]
            step.update(handle={'boneId':main,'local':p},
                        targetAngle=event['targetAngles'][0],snapDeg=.35,returnAngle=0)
            if len(event['boneIds'])>1:
                step['handle']['linkedBoneIds']=[{'boneId':b,'target':a} for b,a in zip(event['boneIds'][1:],event['targetAngles'][1:])]
        steps.append(step)
    meta=data['recipe']['work']
    return {'id':work_id,'name':meta['name']+'（試作）','emoji':meta['emoji'],'difficulty':meta['difficulty'],
            'colorDown':data['recipe']['paper']['colorDown'],'note':data['recipe']['source']['note'],
            'mesh':mesh,'steps':steps,'recipePlayback':data}


def js_source(work):
    payload=json.dumps(work,ensure_ascii=False,allow_nan=False,separators=(',',':'))
    return "// Generated A2 prototype. Source recipe and ambiguities are embedded; do not edit by hand.\n'use strict';\nwindow.ORIGAMI_WORKS=window.ORIGAMI_WORKS||{};\nif(ORIGAMI_WORKS[%s])throw new Error('duplicate origami work id');\nORIGAMI_WORKS[%s]=%s;\n"%(json.dumps(work['id']),json.dumps(work['id']),payload)


def main(argv=None):
    p=argparse.ArgumentParser();p.add_argument('input',type=Path);p.add_argument('--id',required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args(argv)
    try:
        data=compile_playback(parse(a.input.read_text(encoding='utf-8-sig')));work=runtime_work(data,a.id)
        output=a.output.resolve(); allowed=(HERE.parent/'js'/'works').resolve()
        if output.parent!=allowed or output.suffix!='.js' or output.stem!=a.id or output.exists(): raise RecipeError('output must be a new matching js/works prototype file')
        with output.open('x',encoding='utf-8') as f:f.write(js_source(work))
        print('Created:',output);return 0
    except (RecipeError,OSError,ValueError) as e:print('ERROR:',e,file=sys.stderr);return 1
if __name__=='__main__':raise SystemExit(main())
