"""Read and assemble the HQ minifigures from the LDraw parts archive."""
from collections import defaultdict
from functools import lru_cache
from typing import NamedTuple
from zipfile import ZipFile

import numpy as np


class MinifigureLook(NamedTuple):
    label: str
    torso: str
    shirt: int
    face: str
    hair: str
    hair_color: int
    trousers: int


MINIFIGURE_LOOKS = {
    False: (
        MinifigureLook('Blue suit', '973p03', 1, '3626bp01', '3901', 308, 71),
        MinifigureLook('Utility jacket', '973p1u', 2, '3626bp0b', '11256', 70, 272),
        MinifigureLook('Plaid overshirt', '973p0l', 4, '3626bp03', '15500', 308, 72),
        MinifigureLook('Navy cardigan', '973p1y', 272, '3626bp0i', '2003', 19, 71),
        MinifigureLook('Racing jacket', '973p1h', 4, '3626bp0g', '20597', 70, 0),
        MinifigureLook('Leather jacket', '973p0n', 0, '3626bp39', '21268', 72, 19),
        MinifigureLook('Flight jacket', '973p1o', 25, '3626bp44', '21787', 0, 72),
        MinifigureLook('Bow tie', '973p0t', 15, '3626bp0e', '26139', 71, 272),
        MinifigureLook('Explorer vest', '973p34', 70, '3626bp04', '2644', 308, 19),
    ),
    True: (
        MinifigureLook('Lavender jacket', '973p0k', 5, '3626bpb8', '4530', 70, 272),
        MinifigureLook('Blue hoodie', '973p1v', 1, '3626bp08', '20877', 308, 71),
        MinifigureLook('Crew jacket', '973p0p', 272, '3626bp09', '2632', 19, 72),
        MinifigureLook('Press jacket', '973p0m', 320, '3626bp20', '15427', 0, 71),
        MinifigureLook('Scarlet blazer', '973p1w', 4, '3626bp0g', '29633', 70, 0),
        MinifigureLook('Workshop overalls', '973p2s', 320, '3626bp0i', '25613', 308, 19),
        MinifigureLook('Star sweatshirt', '973p0j', 5, '3626bp01', '12890', 0, 72),
        MinifigureLook('Teal field jacket', '973p2o', 322, '3626bp0b', '11255', 19, 272),
        MinifigureLook('Studio cardigan', '973p1y', 2, '3626bp04', '2640', 70, 0),
    ),
}


class MinifigureLibrary:
    def __init__(self, path):
        self.archive = ZipFile(path)
        self.files = set(self.archive.namelist())
        self.authors = set()
        config = self.archive.read('ldraw/LDConfig.ldr').decode()
        self.palette = {}
        for line in config.splitlines():
            fields = line.split()
            if '!COLOUR' not in fields:
                continue
            code = int(fields[fields.index('CODE') + 1])
            hex_color = fields[fields.index('VALUE') + 1][1:]
            self.palette[code] = [int(hex_color[i:i + 2], 16) / 255 for i in (0, 2, 4)]

    @lru_cache(maxsize=None)
    def lines(self, name):
        filename = name.lower().replace('\\', '/')
        for directory in ('parts', 'p'):
            path = f'ldraw/{directory}/{filename}'
            if path in self.files:
                lines = self.archive.read(path).decode('utf-8-sig', errors='replace').splitlines()
                for line in lines:
                    if line.startswith('0 Author: '):
                        self.authors.add(line.removeprefix('0 Author: ').strip())
                return lines
        raise FileNotFoundError(name)

    @lru_cache(maxsize=None)
    def part(self, name, color):
        groups = defaultdict(list)
        for line in self.lines(name):
            kind, *values = line.split() or ('0',)
            if kind not in ('1', '3', '4'):
                continue
            shade = color if values[0] == '16' else int(values[0])
            if kind == '1':
                coordinates = np.array(values[1:13], dtype=float)
                offset, rotation = coordinates[:3], coordinates[3:].reshape(3, 3)
                for material, faces in self.part(' '.join(values[13:]), shade).items():
                    groups[material].extend(faces @ rotation.T + offset)
            else:
                corners = np.array(values[1:], dtype=float).reshape(-1, 3)
                for index in range(1, len(corners) - 1):
                    groups[shade].append(corners[[0, index, index + 1]])
        return {key: np.array(triangles) for key, triangles in groups.items()}

    def components(self, female, variant=0):
        look = MINIFIGURE_LOOKS[female][variant]
        identity = np.eye(3)
        for line in self.lines('76382.dat'):
            if not line.startswith('1 '):
                continue
            _, _, *values, part = line.split()
            offset = np.array(values[:3], dtype=float)
            basis = np.array(values[3:], dtype=float).reshape(3, 3)
            if part == '973.dat':
                yield 'torso', f'{look.torso}.dat', look.shirt, offset, basis
            else:
                side = 'left' if offset[0] > 0 else 'right'
                joint = 'hand' if part == '3820.dat' else 'arm'
                yield f'{side} {joint}', part, 14 if joint == 'hand' else look.shirt, offset, basis
        yield 'head', f'{look.face}.dat', 14, np.array([0, -24, 0]), identity
        yield 'head', f'{look.hair}.dat', look.hair_color, np.array([0, -24, 0]), identity
        legs = look.trousers
        yield 'hips', '3815.dat', legs, np.array([0, 32, 0]), identity
        yield 'right leg', '3816.dat', legs, np.array([0, 44, 0]), identity
        yield 'left leg', '3817.dat', legs, np.array([0, 44, 0]), identity
