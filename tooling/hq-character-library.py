"""Build the local Character Studio from the saved MakeHuman asset library.

Run with Python 3, NumPy and Pillow. Asset files stay under the ignored
.local/artifacts/dummy-character/library directory.
"""
from functools import lru_cache
from gzip import compress
from io import BytesIO
from pathlib import Path
import base64
import json
import struct
import sys
from zlib import crc32

import numpy as np
from PIL import Image, UnidentifiedImageError

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT / '.local/artifacts/dummy-character'
LIBRARY = OUTPUT / 'library'
CORE = LIBRARY / 'core'
SOURCE = LIBRARY / 'source'

CREDITS = [
    {'name': 'MakeHuman system assets and morph targets', 'author': 'MakeHuman Community', 'license': 'CC0',
     'source': 'https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html',
     'revision': 'a8bc2d54ff0ac92e78ff71431b1023eda42bf482',
     'meshSource': 'https://github.com/makehumancommunity/makehuman/tree/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/makehuman/data',
     'archive': 'https://files2.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip'},
    {'name': 'Hair02', 'author': 'Elvaerwyn', 'license': 'CC BY',
     'source': 'https://static.makehumancommunity.org/assets/assetpacks/hair02.html',
     'archive': 'https://files2.makehumancommunity.org/asset_packs/hair02/hair02_ccby.zip',
     'changes': 'Fitted to the studio bodies, converted to glTF, with resized textures.'},
    {'name': 'Bodyparts05', 'author': 'MakeHuman community contributors', 'license': 'CC0',
     'source': 'https://static.makehumancommunity.org/assets/assetpacks/bodyparts05.html',
     'archive': 'https://files2.makehumancommunity.org/asset_packs/bodyparts05/bodyparts05_cc0.zip'},
]

HAIR = {
    'short01': 'Short sweep', 'short02': 'Textured short', 'short03': 'Short fringe', 'short04': 'Spiked short',
    'bob01': 'Bob', 'bob02': 'Layered bob', 'afro01': 'Afro', 'long01': 'Long hair', 'braid01': 'Braid', 'ponytail01': 'Ponytail',
    'elvs_short_side_do': 'Short side part', 'elvs_braid_bun': 'Braided bun', 'elvs_wavy_bob': 'Wavy bob',
    'elvs_maxwell_hair': 'Maxwell sweep', 'elvs_micky_afro': 'Rounded afro',
}
MORPHS = [
    ('build', 'Body build', 'Lighter', 'Fuller'),
    ('head', 'Head shape', 'Oval', 'Round'),
    ('eyes', 'Eye opening', 'Narrower', 'Wider'),
    ('nose', 'Nose width', 'Narrower', 'Wider'),
    ('mouth', 'Mouth width', 'Narrower', 'Wider'),
    ('ears', 'Ear size', 'Smaller', 'Larger'),
    ('chin', 'Chin height', 'Shorter', 'Longer'),
]
SLOTS = [
    ('skin', 'Skin'), ('hair', 'Hair'), ('eyes', 'Eye color'), ('brows', 'Eyebrows'),
    ('lashes', 'Eyelashes'), ('beard', 'Facial hair'), ('mouthDetail', 'Teeth and tongue'),
    ('outfit', 'Outfit'), ('shoes', 'Shoes'),
]


@lru_cache(maxsize=None)
def read_obj(path, group=None):
    vertices, uv, triangles = [], [], []
    active = group is None
    for line in path.read_text(encoding='utf-8-sig').splitlines():
        fields = line.split()
        if not fields:
            continue
        kind, *data = fields
        if kind == 'v':
            vertices.append([float(v) for v in data[:3]])
        elif kind == 'vt':
            uv.append([float(data[0]), 1 - float(data[1])])
        elif kind == 'g' and group is not None:
            active = group in data
        elif kind == 'f' and active:
            polygon = []
            for corner in data:
                vertex, texture, *_ = (corner + '//').split('/')
                v, t = int(vertex), int(texture) if texture else 0
                polygon.append((v - 1 if v > 0 else len(vertices) + v, t - 1 if t > 0 else len(uv) + t if t < 0 else -1))
            triangles.extend([polygon[0], polygon[i], polygon[i + 1]] for i in range(1, len(polygon) - 1))
    assert vertices and triangles, f'Empty mesh in {path}'
    corners = np.asarray(triangles, dtype=np.int32)
    keys, indices = np.unique(corners.reshape(-1, 2), axis=0, return_inverse=True)
    texcoords = np.zeros((len(keys), 2), dtype='<f4')
    valid_uv = keys[:, 1] >= 0
    texcoords[valid_uv] = np.asarray(uv)[keys[valid_uv, 1]] if np.any(valid_uv) else []
    return np.asarray(vertices, dtype=np.float64), corners[:, :, 0], keys[:, 0], indices.reshape(-1, 3), texcoords


@lru_cache(maxsize=None)
def delta(path, count):
    result = np.zeros((count, 3))
    for line in path.read_text(encoding='utf-8-sig').splitlines():
        parts = line.split()
        if parts and parts[0].isdigit():
            result[int(parts[0])] = [float(value) for value in parts[1:4]]
    return result


def body_shapes(base, variant):
    count = len(base)
    targets = SOURCE / 'targets'
    macro = targets / 'macrodetails'
    # Use equal weights for the three MakeHuman young-adult macro targets.
    body = base + sum(delta(macro / f'{tag}-{variant}-young.target', count)
                      for tag in ('african', 'asian', 'caucasian')) / 3
    average = delta(macro / f'universal-{variant}-young-averagemuscle-averageweight.target', count)
    body += average
    shapes = {}
    for side, weight in (('min', 'minweight'), ('max', 'maxweight')):
        shapes[f'build-{side}'] = delta(macro / f'universal-{variant}-young-averagemuscle-{weight}.target', count) - average
    for side, head, suffix in (('min', 'oval', 'decr'), ('max', 'round', 'incr')):
        names = {
            'head': [f'head/head-{head}'],
            'eyes': [f'eyes/{eye}-eye-height2-{suffix}' for eye in ('l', 'r')],
            'nose': [f'nose/nose-scale-horiz-{suffix}'],
            'mouth': [f'mouth/mouth-scale-horiz-{suffix}'],
            'ears': [f'ears/{ear}-ear-scale-{suffix}' for ear in ('l', 'r')],
            'chin': [f'chin/chin-height-{suffix}'],
        }
        for name, paths in names.items():
            shapes[f'{name}-{side}'] = sum(delta(targets / f'{path}.target', count) for path in paths)
    return body, shapes


class Proxy:
    def __init__(self, mapping):
        self.scales, self.shears, self.left, self.right = {}, {}, {}, {}
        self.hidden = set()
        verts, weights, offsets = [], [], []
        mode = None
        folder = mapping.parent
        for line in mapping.read_text(encoding='utf-8-sig', errors='replace').splitlines():
            fields = line.partition('#')[0].split()
            if not fields:
                continue
            key, *rest = fields
            if key == 'obj_file':
                self.obj = folder / rest[0]
            elif key == 'material':
                self.material = folder / rest[0]
            elif key.endswith(('_scale', '_shear_x', '_shear_y', '_shear_z')) or key.startswith('shear_'):
                if key.endswith('_scale'):
                    table, axis = self.scales, key[0]
                else:
                    table, axis = {'l_shear': self.left, 'r_shear': self.right, 'shear': self.shears}[key[:-2]], key[-1]
                table['xyz'.index(axis)] = (int(rest[0]), int(rest[1]), *map(float, rest[2:]))
            elif key in ('verts', 'delete_verts', 'weights'):
                mode = key
            elif mode == 'verts' and key.isdigit():
                if len(fields) == 1:
                    verts.append([int(key)] * 3); weights.append([1, 0, 0]); offsets.append([0, 0, 0])
                else:
                    verts.append(list(map(int, fields[:3])))
                    weights.append(list(map(float, fields[3:6])))
                    offsets.append(list(map(float, fields[6:9])))
            elif mode == 'delete_verts' and key.isdigit():
                start = None
                for value in fields:
                    if value == '-':
                        start = last
                    else:
                        last = int(value)
                        self.hidden.update(range(start if start is not None else last, last + 1))
                        start = None
        self.verts, self.weights, self.offsets = np.asarray(verts), np.asarray(weights), np.asarray(offsets)
        assert len(self.verts) == len(read_obj(self.obj)[0]), f'Invalid vertex map in {mapping}'

    def fit(self, body):
        scale = np.ones(3)
        if self.scales:
            for axis, (first, second, divisor) in self.scales.items():
                scale[axis] = abs(body[first, axis] - body[second, axis]) / divisor
        else:
            for axis, (first, second, low, high) in (self.shears or self.left or self.right).items():
                scale[axis] = (body[second, axis] - body[first, axis]) / (high - low)
        return (body[self.verts] * self.weights[:, :, None]).sum(axis=1) + self.offsets * scale


def normals(points, triangles):
    result = np.zeros_like(points)
    a, b, c = points[triangles].transpose(1, 0, 2)
    face = np.cross(b - a, c - a)
    for column in range(3):
        np.add.at(result, triangles[:, column], face)
    lengths = np.linalg.norm(result, axis=1, keepdims=True)
    return result / np.maximum(lengths, 1e-15)


def open_texture(path):
    try:
        return Image.open(path)
    except UnidentifiedImageError:
        data = path.read_bytes()
        signature = b'\x89PNG\r\n\x1a\n'
        if not data.startswith(signature):
            raise
        # One upstream texture has a broken optional color-profile chunk.
        # Keep the downloaded original and discard only the corrupt profile.
        cleaned, offset = bytearray(signature), len(signature)
        while offset + 12 <= len(data):
            size, kind = struct.unpack_from('>I4s', data, offset)
            end = offset + size + 12
            if end > len(data):
                raise
            checksum = struct.unpack_from('>I', data, end - 4)[0]
            if kind != b'iCCP' or crc32(data[offset + 4:end - 4]) == checksum:
                cleaned.extend(data[offset:end])
            offset = end
        return Image.open(BytesIO(cleaned))


class Glb:
    def __init__(self):
        self.bin = bytearray()
        self.json = {
            'asset': {'version': '2.0', 'generator': 'Building Suit Character Studio', 'extras': {'credits': CREDITS}},
            'scene': 0, 'scenes': [], 'nodes': [], 'meshes': [], 'materials': [], 'textures': [], 'images': [],
            'buffers': [], 'bufferViews': [], 'accessors': [],
        }
        self.materials = {}

    def append(self, group, value):
        collection = self.json[group]
        collection.append(value)
        return len(collection) - 1

    def view(self, data, target=None):
        index = self.append('bufferViews', {'buffer': 0, 'byteOffset': len(self.bin), 'byteLength': len(data),
                                            **({'target': target} if target else {})})
        self.bin.extend(data)
        self.bin.extend(b'\0' * ((-len(self.bin)) % 4))
        return index

    def accessor(self, values, kind, component=5126, bounds=False, target=None):
        dtype = {5126: '<f4', 5125: '<u4', 5123: '<u2'}[component]
        value = np.asarray(values, dtype=dtype)
        extra = {'min': value.min(axis=0).tolist(), 'max': value.max(axis=0).tolist()} if bounds else {}
        return self.append('accessors', {'bufferView': self.view(value.tobytes(), target), 'componentType': component,
                                          'count': len(value), 'type': kind, **extra})

    def sparse(self, values, used, position=False):
        values = np.asarray(values, dtype='<f4')
        component = 5123 if len(values) < 65536 else 5125
        rows = np.asarray(used, dtype='<u2' if component == 5123 else '<u4')
        data = values[used]
        # glTF requires POSITION bounds even for sparse blend shapes.
        bounds = {'min': np.minimum(0, data.min(axis=0)).tolist(),
                  'max': np.maximum(0, data.max(axis=0)).tolist()} if position else {}
        return self.append('accessors', {'componentType': 5126, 'type': 'VEC3', 'count': len(values), **bounds,
            'sparse': {'count': len(used), 'indices': {'bufferView': self.view(rows.tobytes()), 'componentType': component},
                       'values': {'bufferView': self.view(data.tobytes())}}})

    def material(self, name, image=None, cutout=False, color=(0.60, 0.50, 0.43, 1)):
        key = (image, cutout, color)
        if key in self.materials:
            return self.materials[key]
        pbr = {'baseColorFactor': color, 'metallicFactor': 0, 'roughnessFactor': 0.8}
        if image is not None:
            with open_texture(image) as source:
                source.thumbnail((1536, 1536), Image.Resampling.LANCZOS)
                data = BytesIO()
                rgba = source.convert('RGBA') if cutout else None
                if rgba is not None and rgba.getchannel('A').getextrema()[0] < 255:
                    rgba.quantize(colors=256, method=Image.Quantize.FASTOCTREE).save(data, format='PNG', optimize=True)
                    mime = 'image/png'
                else:
                    source.convert('RGB').save(data, format='JPEG', quality=87)
                    mime = 'image/jpeg'
            image_id = self.append('images', {'bufferView': self.view(data.getvalue()), 'mimeType': mime})
            texture = self.append('textures', {'source': image_id})
            pbr.update(baseColorFactor=[1, 1, 1, 1], baseColorTexture={'index': texture})
        material = {'name': name, 'pbrMetallicRoughness': pbr, 'doubleSided': cutout}
        if cutout:
            material.update(alphaMode='MASK', alphaCutoff=0.40)
        index = self.append('materials', material)
        self.materials[key] = index
        return index

    def mesh(self, name, obj, fitted, variations, material, floor):
        _, triangles, raw_vertices, indices, uv = obj
        positions = fitted.copy()
        positions[:, 1] -= floor
        positions *= 0.1  # MakeHuman uses decimetres.
        normal = normals(positions, triangles)
        attributes = {
            'POSITION': self.accessor(positions[raw_vertices], 'VEC3', bounds=True, target=34962),
            'NORMAL': self.accessor(normal[raw_vertices], 'VEC3', target=34962),
            'TEXCOORD_0': self.accessor(uv, 'VEC2', target=34962),
        }
        targets, names = [], []
        for morph, variant in variations.items():
            movement = (variant - fitted) * 0.1
            if not np.any(np.abs(movement[raw_vertices]) > 0.000025):
                continue
            new_normal = normals(positions + movement, triangles) - normal
            p, n = movement[raw_vertices], new_normal[raw_vertices]
            used = np.flatnonzero(np.any(np.abs(p) > 0.000025, axis=1) | np.any(np.abs(n) > 0.001, axis=1))
            targets.append({'POSITION': self.sparse(p, used, True), 'NORMAL': self.sparse(n, used)})
            names.append(morph)
        primitive = {'attributes': attributes, 'indices': self.accessor(indices.ravel(), 'SCALAR', 5125, target=34963),
                     'material': material}
        entry = {'name': name, 'primitives': [primitive]}
        if targets:
            primitive['targets'] = targets
            entry['weights'] = [0] * len(targets)
            entry['extras'] = {'targetNames': names}
        return self.append('meshes', entry)

    def node(self, mesh, x, z=0):
        return self.append('nodes', {'mesh': mesh, 'name': self.json['meshes'][mesh]['name'], 'translation': [x, 0, z]})

    def encode(self):
        self.json['buffers'] = [{'byteLength': len(self.bin)}]
        text = json.dumps(self.json, separators=(',', ':')).encode()
        text += b' ' * ((-len(text)) % 4)
        size = 28 + len(text) + len(self.bin)
        return struct.pack('<IIIII', 0x46546C67, 2, size, len(text), 0x4E4F534A) + text + struct.pack('<II', len(self.bin), 0x004E4942) + self.bin


def diffuse(material):
    for line in material.read_text(encoding='utf-8-sig', errors='replace').splitlines():
        if line.startswith('diffuseTexture '):
            path = material.parent / line.split(maxsplit=1)[1].strip()
            if not path.is_file():
                raise FileNotFoundError(path)
            return path
    return None


def asset(glb, folder, label, body, variations, floor, body_faces, cutout=False, image=None):
    proxy = Proxy(next(folder.glob('*.mhclo')))
    obj = read_obj(proxy.obj)
    points = proxy.fit(body)
    targets = {name: proxy.fit(shape) for name, shape in variations.items()}
    image = image if image is not None else diffuse(proxy.material)
    material = glb.material(label, image, cutout)
    index = glb.mesh(label, obj, points, targets, material, floor)
    faces = np.flatnonzero(np.isin(body_faces, list(proxy.hidden)).all(axis=1)).tolist() if proxy.hidden else []
    return {'label': label, 'mesh': index, **({'hide': faces} if faces else {})}


def build_avatar(glb, base, variant, x):
    body, shapes = body_shapes(base[0], variant)
    variations = {name: body + delta for name, delta in shapes.items()}
    floor = body[base[1], 1].min()
    skin = []
    for color, label in (('caucasian', 'Fair'), ('asian', 'Warm'), ('african', 'Deep')):
        directory = CORE / 'skins' / f'young_{color}_{variant}'
        skin.append({'label': label, 'material': glb.material(f'{variant} · {label}', diffuse(next(directory.glob('*.mhmat'))))})
    body_id = glb.mesh(f'{variant.title()} base', base, body, variations, skin[1]['material'], floor)
    slots = {'skin': skin}

    def fit_controls(*names):
        return {name: shape for name, shape in variations.items() if name.rsplit('-', 1)[0] in ('build', *names)}

    def add(slot, items, cutout=False, controls=()):
        slots[slot] = [asset(glb, directory, label, body, fit_controls(*controls), floor, base[1], cutout)
                       for directory, label in items]
    add('hair', [((LIBRARY / 'elvaerwyn' if key.startswith('elvs_') else CORE) / 'hair' / key, label)
                 for key, label in HAIR.items()], True, ('head', 'ears'))
    eye_folder = CORE / 'eyes' / 'high-poly'
    eye = asset(glb, eye_folder, 'Eye mesh', body, fit_controls('head', 'eyes'), floor, base[1],
                image=CORE / 'eyes/materials/brown_eye.png')
    slots['eyes'] = [{'label': color.title(), 'mesh': eye['mesh'],
                      'material': glb.material(f'{color.title()} eyes', CORE / 'eyes' / 'materials' / f'{color}_eye.png')}
                     for color in ('brown', 'blue', 'green', 'grey')]
    add('brows', [(CORE / 'eyebrows' / f'eyebrow{number}', label)
                  for number, label in (('001', 'Natural'), ('002', 'Defined'), ('004', 'Arched'), ('006', 'Fine'))], True, ('head', 'eyes'))
    add('lashes', [(CORE / 'eyelashes' / f'eyelashes0{i}', f'Lashes {i}') for i in (1, 2)], True, ('head', 'eyes'))
    beard_labels = {
        'culturalibre_faun_beard': 'Faun beard',
        'rehmanpolanski_beard_viking': 'Viking beard', 'rehmanpolanski_moustache_viking': 'Viking moustache',
    }
    add('beard', [(path.parent, beard_labels[path.parent.name]) for path in sorted((LIBRARY / 'beards').rglob('*.mhclo'))
                  if path.parent.name in beard_labels], True, ('head', 'mouth', 'chin', 'nose'))
    mouth = [asset(glb, CORE / directory, label, body, fit_controls('head', 'mouth', 'chin'), floor, base[1])['mesh']
             for directory, label in (('teeth/teeth_base', 'Teeth'), ('tongue/tongue01', 'Tongue'))]
    slots['mouthDetail'] = [{'label': 'Teeth and tongue', 'meshes': mouth}]
    add('outfit', [(CORE / 'clothes' / f'{variant}_{key}', label)
                   for key, label in (('casualsuit01', 'Casual'), ('elegantsuit01', 'Formal'), ('casualsuit02', 'Weekend'))])
    add('shoes', [(CORE / 'clothes' / f'shoes0{i}', label) for i, label in ((1, 'Classic'), (2, 'Everyday'), (4, 'Lace-up'))])
    return {'label': f'{variant.title()} body', 'body': body_id, 'top': float((body[base[1], 1].max() - floor) * 0.1),
            'x': x, 'slots': slots}


def dressed_scene(glb, avatars, selections, name):
    nodes = []
    for avatar in avatars:
        original = glb.json['meshes'][avatar['body']]
        primitive = dict(original['primitives'][0])
        primitive['material'] = avatar['slots']['skin'][selections['skin']]['material']
        hidden = set()
        for slot, _ in SLOTS[1:]:
            selected = selections.get(slot, -1)
            if selected < 0:
                continue
            option = avatar['slots'][slot][selected]
            hidden.update(option.get('hide', []))
            for mesh in option['meshes'] if 'meshes' in option else [option['mesh']]:
                nodes.append(glb.node(mesh, avatar['x']))
        if hidden:
            accessor = glb.json['accessors'][primitive['indices']]
            view = glb.json['bufferViews'][accessor['bufferView']]
            faces = np.frombuffer(bytes(glb.bin), '<u4', accessor['count'], view['byteOffset']).reshape(-1, 3)
            keep = [i for i in range(len(faces)) if i not in hidden]
            primitive['indices'] = glb.accessor(faces[keep].ravel(), 'SCALAR', 5125, target=34963)
        mesh = glb.append('meshes', {**original, 'primitives': [primitive]})
        nodes.append(glb.node(mesh, avatar['x']))
    glb.append('scenes', {'name': name, 'nodes': nodes})


def library_scene(glb, avatars):
    nodes = []
    for avatar in avatars:
        for slot, _ in SLOTS[1:]:
            for option in avatar['slots'][slot]:
                for index in option.get('meshes', [option.get('mesh')]):
                    mesh = glb.json['meshes'][index]
                    name = f"{avatar['label']} · {option['label']} · {mesh['name']}"
                    if 'material' in option:
                        index = glb.append('meshes', {**mesh, 'name': name,
                            'primitives': [{**mesh['primitives'][0], 'material': option['material']}]})
                    row, column = divmod(len(nodes), 8)
                    node = glb.node(index, column * 1.3, -row * 1.3)
                    glb.json['nodes'][node]['name'] = name
                    nodes.append(node)
    glb.append('scenes', {'name': 'Accessory library', 'nodes': nodes})


def main():
    base = read_obj(SOURCE / '3dobjs/base.obj', 'body')
    glb = Glb()
    avatars = [build_avatar(glb, base, 'male', -0.62), build_avatar(glb, base, 'female', 0.62)]
    defaults = {'skin': 1, 'hair': 10, 'eyes': 0, 'brows': 0, 'lashes': 0, 'beard': -1,
                'mouthDetail': 0, 'outfit': 1, 'shoes': 1}
    dressed_scene(glb, avatars, defaults, 'Studio · Formal')
    dressed_scene(glb, avatars, {**defaults, 'outfit': 0, 'hair': 0}, 'Studio · Casual')
    dressed_scene(glb, avatars, {'skin': 1}, 'Base bodies')
    library_scene(glb, avatars)
    glb.json['extras'] = {'studio': {'avatars': avatars, 'slots': SLOTS, 'morphs': MORPHS, 'defaults': defaults}}
    binary = glb.encode()
    template = (ROOT / 'tooling/hq-character-studio.html').read_text(encoding='utf-8')
    preview = template.replace('/*STUDIO_GLB*/null', json.dumps(base64.b64encode(compress(binary, compresslevel=4)).decode('ascii')))
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for name, data in (('dummy-character.glb', binary), ('dummy-character-review.html', preview.encode())):
        destination = OUTPUT / name
        temporary = destination.with_suffix(destination.suffix + '.tmp')
        temporary.write_bytes(data)
        temporary.replace(destination)
    (LIBRARY / 'sources.json').write_text(json.dumps(CREDITS, indent=2) + '\n', encoding='utf-8')
    print(f"Updated Character Studio with {len(avatars)} bodies, {len(HAIR)} hairstyles and {len(glb.json['meshes'])} meshes in {OUTPUT}")


if __name__ == '__main__':
    main()
