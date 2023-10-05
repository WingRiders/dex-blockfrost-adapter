import { BigNumber } from 'bignumber.js';
import { mapValues } from 'lodash'
import { Decimal } from 'decimal.js'


type StableswapParams = { x: BigNumber; y: BigNumber; d: BigNumber; a: BigNumber }
type StableswapParamsWithoutY = Omit<StableswapParams, 'y'>
type StableswapParamsWithoutD = Omit<StableswapParams, 'd'>


const assertParamA = (a: BigNumber) => {
  if (!a.gt(0.25)) {
    throw new Error('For paramA <= 1/4 stableswap math may not work.')
  }
}

const assertPositive = (x: BigNumber, valueName: string) => {
  if (!x.gt(0)) {
    throw new Error(`For ${valueName} <= 0 stableswap math does not work.`)
  }
}

// 4xy (4A(x + y) + D)
const leftEquation = ([a, d, xy, xpy]: BigNumber[]) => xy.times(4).times(a.times(4).times(xpy).plus(d))

// 16ADxy + D^3
const rightEquation = ([a, d, xy]: BigNumber[]) => a.times(16).times(d).times(xy).plus(d.pow(3))

// f(y) = 4xy(4A(x+y) + d) - 4Ad4xy - d^3 = 0
//    0 = (4Ax)y^2 + [x(4Ax + d - 4AD)]y - (d^3 / 4)
const findRealY = ({ a, x, d }: StableswapParamsWithoutY): BigNumber => {
  const ax4 = a.times(4).times(x)
  const ax8 = ax4.times(2)
  const ad4 = a.times(4).times(d)
  const b = ax4.plus(d).minus(ad4).times(x)
  const minus4ac = d.pow(3).times(ax4)
  const determinant = b.pow(2).plus(minus4ac)
  return determinant.sqrt().minus(b).dividedBy(ax8)
}

export const findY = (params: StableswapParamsWithoutY): BigNumber => {
  //    a = 4Ax
  //    b = (4Ax + d - 4AD)x
  //    c = - (d^3 / 4)
  //    D = b^2 - 4ac
  //    root = (sqrt(D) - b) / (2a)
  const realY = findRealY(params)
  const y = realY.integerValue(BigNumber.ROUND_CEIL)
  if (checkYInvariant({ ...params, y })) {
    return y
  }
  if (checkYInvariant({ ...params, y: y.plus(1) })) {
    return y.plus(1)
  }
  if (checkYInvariant({ ...params, y: y.minus(1) })) {
    return y.minus(1)
  }
  throw new Error(
    `Invariant not fulfilled for calculated Y value: ${JSON.stringify(
      mapValues({ ...params, y, realY }, (x) => x.toString())
    )} `
  )
}

export const checkYInvariant = ({ x, y, d, a }: StableswapParams) => {
  assertParamA(a)
  assertPositive(x, 'poolX')
  assertPositive(d, 'invariantD')

  const xy = x.times(y)
  const xy1 = x.times(y.minus(1))
  const xpy = x.plus(y)
  const l0 = leftEquation([a, d, xy, xpy])
  const l1 = leftEquation([a, d, xy1, xpy.minus(1)])
  const r0 = rightEquation([a, d, xy])
  const r1 = rightEquation([a, d, xy1])
  const fy1 = l1.minus(r1)
  const fy = l0.minus(r0)
  return fy1.lt(0) && fy.gte(0)
}

// https://www.wolframalpha.com/input?i2d=true&i=Power%5Bx%2C3%5D%2B4*ab%5C%2840%294A-1%5C%2841%29x+-+16*A*ab%5C%2840%29a%2Bb%5C%2841%29+%3D+0
// where: {a, x, y} = {A, a, b}
export const findRealD = ({ a, x, y }: StableswapParamsWithoutD): BigNumber => {
  const p = a.times(432).times(x).times(y).times(x.plus(y))
  const q = x.times(12).times(y).times(a.times(4).minus(1))
  const sqrt = p.pow(2).plus(q.pow(3).times(4)).sqrt()
  const cbrt = cubeRoot(sqrt.plus(p))
  const two = cubeRoot(2)
  return cbrt.div(two.times(3)).minus(two.times(q).div(cbrt.times(3)))
}

export const findD = (params: StableswapParamsWithoutD): BigNumber => {
  const realD = findRealD(params)
  const d = realD.integerValue(BigNumber.ROUND_FLOOR)
  if (checkDInvariant({ ...params, d })) {
    return d
  }
  // Because of the low precision, the found value doesn't have to be
  // on the correct side of the root whole approximations, so we check +-1.
  if (checkDInvariant({ ...params, d: d.plus(1) })) {
    return d.plus(1)
  }
  if (checkDInvariant({ ...params, d: d.minus(1) })) {
    return d.minus(1)
  }
  throw new Error(
    `Invariant not fulfilled for calculated D value: ${JSON.stringify(
      mapValues({ ...params, d, realD }, (x) => x.toString())
    )} `
  )
}

export const checkDInvariant = ({ x, y, d, a }: StableswapParams) => {
  assertParamA(a)
  assertPositive(x, 'poolX')
  assertPositive(y, 'poolY')

  const xy = x.times(y)
  const xpy = x.plus(y)
  const d1 = d.plus(1)
  const l0 = leftEquation([a, d, xy, xpy])
  const l1 = leftEquation([a, d1, xy, xpy])
  const r0 = rightEquation([a, d, xy])
  const r1 = rightEquation([a, d1, xy])
  const fd = r0.minus(l0)
  const fd1 = r1.minus(l1)
  return fd.lte(0) && fd1.gt(0)
}

export const cubeRoot = (x: BigNumber.Value) => {
  Decimal.set({ precision: 30 })
  return new BigNumber(new Decimal(x.toString()).pow(new Decimal(1).div(3)).toString())
}
