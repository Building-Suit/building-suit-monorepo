type Matrix = Float32Array

export function identity(): Matrix { return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]) }
export function model(x = 0, y = 0, z = 0, tilt = 0, turn = 0, spin = 0, scale = 1, result = identity()): Matrix {
  const cx = Math.cos(tilt), sx = Math.sin(tilt), cy = Math.cos(spin), sy = Math.sin(spin), cz = Math.cos(turn), sz = Math.sin(turn)
  result[0] = (cy * cz + sy * sx * sz) * scale; result[1] = cx * sz * scale; result[2] = (-sy * cz + cy * sx * sz) * scale; result[3] = 0
  result[4] = (-cy * sz + sy * sx * cz) * scale; result[5] = cx * cz * scale; result[6] = (sy * sz + cy * sx * cz) * scale; result[7] = 0
  result[8] = sy * cx * scale; result[9] = -sx * scale; result[10] = cy * cx * scale; result[11] = 0
  result[12] = x; result[13] = y; result[14] = z; result[15] = 1
  return result
}
export function matrixProduct(first: Matrix, second: Matrix, result: Matrix = new Float32Array(16)): Matrix {
  for (let column = 0; column < 4; column++) for (let row = 0; row < 4; row++) {
    let value = 0
    for (let index = 0; index < 4; index++) value += first[index * 4 + row]! * second[column * 4 + index]!
    result[column * 4 + row] = value
  }
  return result
}
