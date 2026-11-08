"""Build the HQ minifigure GLBs with Python 3, NumPy, and Pillow.

Save the LDraw Official Parts Library complete.zip as ldraw.zip under
.local/artifacts/dummy-character/library/styles/ before running this script.
The optional argument selects a Character Studio output directory containing library/.
"""
from collections import defaultdict
from io import BytesIO
from pathlib import Path
from runpy import run_path

import numpy as np
from PIL import Image

directory = Path(__file__).resolve().parent
runtime = run_path(str(directory / 'hq-character-runtime.py'))
minifigures = run_path(str(directory / 'hq-minifigures.py'))
studio = runtime['studio']
joint_indices = {'hips': 0, 'torso': 1, 'head': 2, 'left arm': 3, 'left hand': 5,
                 'right arm': 6, 'right hand': 8, 'left leg': 9, 'right leg': 12}


def figure_groups(bricks, female, variant):
    groups = defaultdict(list)
    centers = {}
    for joint, part, color, offset, basis in bricks.components(female, variant):
        centers[joint] = offset
        for shade, triangles in bricks.part(part, color).items():
            groups[shade].append((joint_indices[joint], (triangles @ basis.T + offset) * [1, -1, -1]))
    return groups, centers


def pack_minifigures(bricks, female):
    pack = runtime['AvatarPack']()
    pack.json['asset']['generator'] = 'Building Suit HQ Minifigure Pack'
    looks = minifigures['MINIFIGURE_LOOKS'][female]
    first, centers = figure_groups(bricks, female, 0)
    floor = min(triangles[:, :, 1].min() for pieces in first.values() for _, triangles in pieces)
    unit = 0.02
    left_shoulder, right_shoulder = centers['left arm'], centers['right arm']
    pivots = np.array([
        [0, 44, 0], [0, 32, 0], [0, 0, 0],
        left_shoulder, left_shoulder + [0, 10, 0], centers['left hand'],
        right_shoulder, right_shoulder + [0, 10, 0], centers['right hand'],
        [10, 44, 0], [10, 54, 0], [10, 67, 0],
        [-10, 44, 0], [-10, 54, 0], [-10, 67, 0],
    ], dtype=float) * [1, -1, -1]
    pivots[:, 1] -= floor
    root = pack.add_skin(pivots * unit)
    materials = {}

    def material(shade):
        if shade in materials:
            return materials[shade]
        data = BytesIO()
        Image.new('RGB', (1, 1), tuple(round(component * 255) for component in bricks.palette[shade])).save(data, format='PNG')
        image = pack.append('images', {'bufferView': pack.view(data.getvalue()), 'mimeType': 'image/png'})
        texture = pack.append('textures', {'source': image})
        materials[shade] = pack.append('materials', {
            'name': f'LDraw color {shade}', 'doubleSided': True, 'pbrMetallicRoughness': {
                'baseColorTexture': {'index': texture}, 'metallicFactor': 0, 'roughnessFactor': .35,
            },
        })
        return materials[shade]

    variants = []
    pack.json['scenes'] = []
    for index, look in enumerate(looks):
        groups = first if index == 0 else figure_groups(bricks, female, index)[0]
        meshes = []
        top = floor
        for shade, pieces in groups.items():
            triangles = np.concatenate([faces for _, faces in pieces])
            points = triangles.reshape(-1, 3)
            top = max(top, points[:, 1].max())
            joint_per_face = np.concatenate([np.full(len(faces), joint) for joint, faces in pieces])
            normals = np.cross(triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0])
            normals /= np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-15)
            # Weld repeated corners while retaining the molded edges and joint boundaries.
            keys = np.column_stack((points, np.repeat(joint_per_face, 3), np.repeat(normals, 3, axis=0)))
            vertices, indices = np.unique(keys.round(5), axis=0, return_inverse=True)
            indices = indices.reshape(-1, 3)
            weights = np.eye(len(pivots))[vertices[:, 3].astype(int)]
            obj = (vertices, indices, np.arange(len(vertices)), indices, np.zeros((len(vertices), 2)))
            # AvatarPack.mesh accepts decimetres and converts to metres.
            meshes.append(pack.mesh(look.label, obj, vertices[:, :3] * unit * 10, weights, material(shade), floor * unit * 10))
        variants.append({'meshes': meshes, 'height': float((top - floor) * unit)})
        nodes = [pack.append('nodes', {'mesh': mesh, 'skin': 0}) for mesh in meshes]
        pack.append('scenes', {'name': look.label, 'nodes': [root, *nodes]})

    pack.json['extras'] = {'hqAvatar': {
        'height': variants[0]['height'], 'pivots': (pivots * unit).tolist(), 'minifigure': variants,
    }}
    pack.json['asset']['extras']['credits'] = [{
        'name': 'LDraw Official Parts Library', 'author': ', '.join(sorted(bricks.authors)),
        'license': 'CC BY 4.0', 'source': 'https://library.ldraw.org/',
        'changes': 'Assembled, recolored, and rigged the minifigure parts for the HQ scene.',
    }]
    return pack.encode()


if __name__ == '__main__':
    bricks = minifigures['MinifigureLibrary'](studio['LIBRARY'] / 'styles' / 'ldraw.zip')
    destination = studio['ROOT'] / 'apps/company-hq/public/avatars'
    for body in ('female', 'male'):
        path = destination / f'hq-lego-{body}.glb'
        binary = pack_minifigures(bricks, body == 'female')
        temp = path.with_suffix('.tmp')
        temp.write_bytes(binary)
        temp.replace(path)
        print(f'Saved {path.name} ({path.stat().st_size:,} bytes)')
