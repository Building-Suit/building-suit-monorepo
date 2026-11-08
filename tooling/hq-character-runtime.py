"""Pack the saved Character Studio assets into the HQ scene's shared avatar GLBs.

Run with Python 3, NumPy and Pillow after saving the Character Studio library.
The optional argument is the studio output directory containing library/.
"""
from io import BytesIO
from pathlib import Path
from runpy import run_path
import json

import numpy as np
from PIL import Image

studio = run_path(str(Path(__file__).with_name('hq-character-library.py')))
CORE, SOURCE = studio['CORE'], studio['SOURCE']
HAIR = {
    'female': ('bob01', 'braid01', 'bob02', 'afro01', 'ponytail01', 'long01', 'short03', 'short02', 'short01'),
    'male': ('short01', 'short04', 'short02', 'short03', 'afro01', 'braid01', 'elvs_maxwell_hair',
             'elvs_micky_afro', 'ponytail01'),
}
BONES = (
    'root', 'spine02', 'head',
    'upperarm01.L', 'lowerarm01.L', 'wrist.L', 'upperarm01.R', 'lowerarm01.R', 'wrist.R',
    'upperleg01.L', 'lowerleg01.L', 'foot.L', 'upperleg01.R', 'lowerleg01.R', 'foot.R',
)
PARENTS = (None, 0, 1, 1, 3, 4, 1, 6, 7, 0, 9, 10, 0, 12, 13)


def rig(body, floor):
    skeleton = json.loads((SOURCE / 'rigs/default.mhskel').read_text())
    weights = json.loads((SOURCE / 'rigs/default_weights.mhw').read_text())['weights']
    bones = skeleton['bones']
    pivots = np.array([body[skeleton['joints'][bones[name]['head']]].mean(axis=0) for name in BONES])
    pivots[:, 1] -= floor
    pivots *= .1
    skin = np.zeros((len(body), len(BONES)))
    for name, pairs in weights.items():
        joint = name
        while joint and joint not in BONES and not joint.startswith(('neck', 'jaw', 'eye')):
            joint = bones.get(joint, {}).get('parent')
        index = BONES.index(joint) if joint in BONES else 2 if joint else 0
        for vertex, weight in pairs:
            skin[vertex, index] += weight
    skin[skin.sum(axis=1) == 0, 0] = 1
    return pivots, skin / skin.sum(axis=1, keepdims=True)


class AvatarPack(studio['Glb']):
    def material(self, name, path, cutout=False):
        if path in self.materials:
            return self.materials[path]
        with studio['open_texture'](path) as image:
            image.thumbnail((512, 512), Image.Resampling.LANCZOS)
            data = BytesIO()
            if cutout:
                image.convert('RGBA').quantize(colors=256, method=Image.Quantize.FASTOCTREE).save(data, format='PNG', optimize=True)
            else:
                image.convert('RGB').save(data, format='JPEG', quality=88)
        image_id = self.append('images', {'bufferView': self.view(data.getvalue()), 'mimeType': 'image/png' if cutout else 'image/jpeg'})
        texture = self.append('textures', {'source': image_id})
        material = {'name': name, 'pbrMetallicRoughness': {
            'baseColorTexture': {'index': texture}, 'metallicFactor': 0, 'roughnessFactor': .85,
        }}
        if cutout:
            material.update(alphaMode='MASK', alphaCutoff=.38, doubleSided=True)
        self.materials[path] = self.append('materials', material)
        return self.materials[path]

    def byte_attribute(self, data, normalized=False):
        return self.append('accessors', {'bufferView': self.view(data.astype('u1').tobytes(), 34962),
                                        'componentType': 5121, 'type': 'VEC4', 'count': len(data),
                                        **({'normalized': True} if normalized else {})})

    def indices(self, indices):
        assert indices.max() < 65536
        return self.accessor(indices.ravel(), 'SCALAR', 5123, target=34963)

    def mesh(self, name, obj, fitted, skin, material, floor):
        _, faces, raw_vertices, indices, uv = obj
        positions = fitted.copy()
        positions[:, 1] -= floor
        positions *= .1
        normal = studio['normals'](positions, faces)
        weights = np.maximum(skin[raw_vertices], 0)
        joints = np.argsort(-weights, axis=1)[:, :4]
        weights = np.take_along_axis(weights, joints, axis=1)
        weights[weights.sum(axis=1) == 0, 0] = 1
        quantized = np.round(weights / weights.sum(axis=1, keepdims=True) * 255).astype(np.int16)
        quantized[:, 0] += 255 - quantized.sum(axis=1)
        attributes = {
            'POSITION': self.accessor(positions[raw_vertices], 'VEC3', bounds=True, target=34962),
            'NORMAL': self.accessor(normal[raw_vertices], 'VEC3', target=34962),
            'TEXCOORD_0': self.accessor(uv, 'VEC2', target=34962),
            'JOINTS_0': self.byte_attribute(joints),
            'WEIGHTS_0': self.byte_attribute(quantized, normalized=True),
        }
        return self.append('meshes', {'name': name, 'primitives': [
            {'attributes': attributes, 'indices': self.indices(indices), 'material': material},
        ]})

    def add_skin(self, pivots):
        joints = []
        bind = np.tile(np.eye(4, dtype=np.float32).ravel(), (len(pivots), 1))
        bind[:, 12:15] = -pivots
        for index, parent in enumerate(PARENTS):
            position = pivots[index] if parent is None else pivots[index] - pivots[parent]
            joint = self.append('nodes', {'name': BONES[index], 'translation': position.tolist()})
            joints.append(joint)
            if parent is not None:
                self.json['nodes'][joints[parent]].setdefault('children', []).append(joint)
        self.json['skins'] = [{
            'joints': joints, 'skeleton': joints[0],
            'inverseBindMatrices': self.accessor(bind, 'MAT4'),
        }]
        return joints[0]


def build(variant, base):
    body, _ = studio['body_shapes'](base[0], variant)
    floor = body[base[1], 1].min()
    height = float((body[base[1], 1].max() - floor) * .1)
    pivots, skin = rig(body, floor)
    pack = AvatarPack()
    pack.json['asset']['generator'] = 'Building Suit HQ Avatar Pack'
    credits = studio['CREDITS'][:2] if variant == 'male' else studio['CREDITS'][:1]
    pack.json['asset']['extras']['credits'] = credits
    root = pack.add_skin(pivots)

    def material(directory, name, cutout=False):
        return pack.material(name, studio['diffuse'](next(directory.glob('*.mhmat'))), cutout)

    def proxy(folder, name, cutout=False, image=None):
        mapping = studio['Proxy'](next(folder.glob('*.mhclo')))
        mesh = studio['read_obj'](mapping.obj)
        fitted = mapping.fit(body)
        weights = (skin[mapping.verts] * mapping.weights[:, :, None]).sum(axis=1)
        material_id = pack.material(name, image or studio['diffuse'](mapping.material), cutout)
        return pack.mesh(name, mesh, fitted, weights, material_id, floor), mapping.hidden

    skin_materials = [material(CORE / 'skins' / f'young_{tone}_{variant}', f'{variant} · {tone}')
                      for tone in ('caucasian', 'asian', 'african')]
    eye_materials = [pack.material(f'{color} eyes', CORE / 'eyes/materials' / f'{color}_eye.png')
                     for color in ('brown', 'blue', 'green', 'grey')]
    eye_mesh, _ = proxy(CORE / 'eyes/high-poly', 'Eyes', image=CORE / 'eyes/materials/brown_eye.png')
    brows = [proxy(CORE / 'eyebrows' / f'eyebrow{style}', f'Brows {style}', True)[0]
             for style in ('001', '002', '004', '006')]
    hair = []
    for style in HAIR[variant]:
        library = studio['LIBRARY'] / 'elvaerwyn' if style.startswith('elvs_') else CORE
        hair.append(proxy(library / 'hair' / style, studio['HAIR'][style], True)[0])
    clothes = [proxy(CORE / 'clothes' / f'{variant}_{style}', style)
               for style in ('casualsuit01', 'elegantsuit01', 'casualsuit02')]
    shoes = [proxy(CORE / 'clothes' / f'shoes0{style}', f'Shoes {style}') for style in (1, 2, 4)]
    body_mesh = pack.mesh(f'{variant} base', base, body, skin, skin_materials[1], floor)
    body_masks = []
    for _, covered in clothes:
        for _, feet in shoes:
            hidden = np.isin(base[1], list(covered | feet)).all(axis=1)
            body_masks.append(pack.indices(base[3][~hidden]))
    pack.json['meshes'][body_mesh]['primitives'][0]['indices'] = body_masks[0]
    pack.json['extras'] = {'hqAvatar': {
        'height': height, 'pivots': pivots.tolist(), 'body': body_mesh, 'bodyMasks': body_masks,
        'skin': skin_materials, 'eyes': eye_mesh, 'eyeMaterials': eye_materials, 'brows': brows,
        'hair': hair, 'clothes': [mesh for mesh, _ in clothes], 'shoes': [mesh for mesh, _ in shoes],
    }}
    selected = [body_mesh, eye_mesh, brows[0], hair[0], clothes[0][0], shoes[0][0]]
    pack.json['scenes'] = [{'nodes': [root, *(pack.append('nodes', {'mesh': mesh, 'skin': 0}) for mesh in selected)]}]
    return pack.encode()


if __name__ == '__main__':
    base = studio['read_obj'](SOURCE / '3dobjs/base.obj', 'body')
    destination = studio['ROOT'] / 'apps/company-hq/public/avatars'
    destination.mkdir(parents=True, exist_ok=True)
    for variant in HAIR:
        path = destination / f'hq-{variant}.glb'
        path.write_bytes(build(variant, base))
        print(f'Saved {path.name} ({path.stat().st_size / 1024**2:.1f} MiB)')
