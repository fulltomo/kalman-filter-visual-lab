import type { Config, SubStepFrame, DivergenceReason } from '../types';
import { quantityFromMat, quantityFromVec } from '../types';
import type { Experiment } from '../experiment';
import {
  type Mat,
  identity,
  mul,
  transpose,
  add,
  sub,
  matVec,
  symmetrize,
  choleskySolve,
} from '../linalg';
import { rk4StepTLM } from '../model/lorenz96';
import { checkVector, checkCovariance } from '../divergence';
import type { Filter, Emit, CycleOutput } from './types';

/** Compose the TLM over `steps` RK4 steps: returns x^f and M = M_S·…·M_1. */
function forecastTLM(
  x0: Float64Array,
  F: number,
  dt: number,
  steps: number,
): { x: Float64Array; M: Mat } {
  let x: Float64Array = x0.slice();
  let M = identity(x0.length);
  for (let s = 0; s < steps; s++) {
    const r = rk4StepTLM(x, F, dt);
    x = r.x;
    M = mul(r.M, M);
  }
  return { x, M };
}

function addQ(p: Mat, q: number): Mat {
  if (q <= 0) return p;
  const out: Mat = { rows: p.rows, cols: p.cols, data: p.data.slice() };
  for (let i = 0; i < p.rows; i++) out.data[i * p.cols + i] += q;
  return out;
}

function rmse(a: Float64Array, b: Float64Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const e = a[i] - b[i];
    s += e * e;
  }
  return Math.sqrt(s / a.length);
}

function meanDiag(p: Mat): number {
  let s = 0;
  for (let i = 0; i < p.rows; i++) s += p.data[i * p.cols + i];
  return s / p.rows;
}

const NAN_DIAG = { rmseAnalysis: NaN, rmseForecast: NaN, spread: NaN };

export function makeEkf(exp: Experiment, config: Config): Filter {
  const N = exp.N;
  let xa: Float64Array;
  let Pa: Mat;

  const init = (): void => {
    const b = exp.background0();
    xa = b.mean;
    Pa = b.cov;
  };
  init();

  function step(cycle: number, emit: Emit): CycleOutput {
    const frames: SubStepFrame[] = [];
    const want = emit === 'frames';
    let index = 0;
    const push = (
      phase: 'forecast' | 'analysis',
      stepId: string,
      title: string,
      equationLatex: string,
      highlightTerms: string[],
      description: string,
      snapshot: SubStepFrame['snapshot'],
    ): void => {
      if (want) {
        frames.push({
          cycle,
          phase,
          stepId,
          index: index++,
          title,
          equationLatex,
          highlightTerms,
          description,
          snapshot,
        });
      }
    };
    const diverged = (
      stepId: string,
      reason: DivergenceReason,
      detail: string,
    ): CycleOutput => ({
      frames,
      diag: NAN_DIAG,
      status: 'diverged',
      divergence: { stepId, reason, detail },
    });

    // ---- Forecast ----
    const { x: xf, M } = forecastTLM(xa, config.F, config.dt, exp.stepsPerCycle);
    let r = checkVector(xf);
    if (r) return diverged('ekf.forecast.state', r, `予報状態が発散しました（${r}）。dt を小さくしてください。`);
    push(
      'forecast',
      'ekf.forecast.state',
      '予報（非線形積分）',
      'x^f = M(x^a)',
      ['x^f', 'M'],
      '解析値を同化間隔ぶん非線形モデルで時間積分し、予報値を得ます。',
      [quantityFromVec('x_a', '前解析 x^a', xa), quantityFromVec('x_f', '予報 x^f', xf)],
    );
    push(
      'forecast',
      'ekf.forecast.tlm',
      '接線形モデル（TLM）',
      'M = \\frac{\\partial M}{\\partial x}',
      ['M'],
      '予報軌道に沿って線形化した遷移行列。共分散の伝播に使います。',
      [quantityFromMat('M', '遷移行列 M', M)],
    );
    const Pf = symmetrize(addQ(mul(mul(M, Pa), transpose(M)), config.Q));
    r = checkCovariance(Pf);
    if (r) return diverged('ekf.forecast.cov', r, `予報共分散が発散しました（${r}）。`);
    push(
      'forecast',
      'ekf.forecast.cov',
      '予報誤差共分散',
      'P^f = M P^a M^\\top + Q',
      ['P^f', 'M', 'P^a', 'Q'],
      '不確実性を遷移行列で伝播し、モデル誤差 Q を加えます。',
      [quantityFromMat('P_f', '予報共分散 P^f', Pf)],
    );

    // ---- Analysis ----
    const m = exp.m;
    const H = exp.H;
    const R = exp.R;
    const y = exp.observation(cycle);
    const Hxf = exp.applyH(xf);
    const d = new Float64Array(m);
    for (let i = 0; i < m; i++) d[i] = y[i] - Hxf[i];
    push(
      'analysis',
      'ekf.analysis.innov',
      'イノベーション',
      'd = y - H x^f',
      ['d', 'y', 'H', 'x^f'],
      '観測と予報のズレ。フィルタが補正に使う情報源です。',
      [
        quantityFromVec('innovation', 'イノベーション d', d),
        quantityFromVec('y', '観測 y', y),
        quantityFromVec('Hxf', 'H x^f', Hxf),
      ],
    );

    const HPf = mul(H, Pf); // m×N
    const S = symmetrize(add(mul(HPf, transpose(H)), R)); // m×m
    push(
      'analysis',
      'ekf.analysis.innovCov',
      'イノベーション共分散',
      'S = H P^f H^\\top + R',
      ['S', 'H', 'P^f', 'R'],
      '予報の不確実性を観測空間へ写し、観測誤差 R を足したもの。',
      [quantityFromMat('S', 'イノベーション共分散 S', S)],
    );

    // K = P^f Hᵀ S^{-1}; since S, P^f symmetric, Kᵀ = S^{-1}(H P^f).
    const solved = choleskySolve(S, HPf); // S·Kᵀ = H P^f → Kᵀ (m×N)
    const K = transpose(solved.x); // N×m
    push(
      'analysis',
      'ekf.analysis.gain',
      'カルマンゲイン',
      'K = P^f H^\\top S^{-1}',
      ['K', 'P^f', 'H', 'S'],
      solved.jitterApplied
        ? '各観測が各状態をどれだけ引くか。S が悪条件のため微小ジッタを加えて解きました。'
        : '各観測が各状態をどれだけ引くか（重み）。',
      [quantityFromMat('K', 'ゲイン K', K)],
    );

    const Kd = matVec(K, d);
    const xaNew = new Float64Array(N);
    for (let i = 0; i < N; i++) xaNew[i] = xf[i] + Kd[i];
    r = checkVector(xaNew);
    if (r) return diverged('ekf.analysis.mean', r, `解析状態が発散しました（${r}）。`);
    push(
      'analysis',
      'ekf.analysis.mean',
      '解析（状態更新）',
      'x^a = x^f + K d',
      ['x^a', 'x^f', 'K', 'd'],
      '予報値をイノベーションに比例して補正します。',
      [quantityFromVec('x_a', '解析 x^a', xaNew), quantityFromVec('Kd', '増分 K d', Kd)],
    );

    // Joseph form: P^a = (I-KH)P^f(I-KH)ᵀ + K R Kᵀ.
    const KH = mul(K, H);
    const ImKH = sub(identity(N), KH);
    const PaNew = symmetrize(
      add(mul(mul(ImKH, Pf), transpose(ImKH)), mul(mul(K, R), transpose(K))),
    );
    r = checkCovariance(PaNew);
    if (r) return diverged('ekf.analysis.cov', r, `解析共分散が発散しました（${r}）。`);
    push(
      'analysis',
      'ekf.analysis.cov',
      '解析誤差共分散（Joseph 形）',
      'P^a = (I-KH)P^f(I-KH)^\\top + K R K^\\top',
      ['P^a', 'K', 'H', 'P^f', 'R'],
      '更新後の不確実性。数値的に安定な Joseph 形で計算し対称化します。',
      [quantityFromMat('P_a', '解析共分散 P^a', PaNew)],
    );

    // Commit state.
    xa = xaNew;
    Pa = PaNew;

    const truth = exp.truth(cycle);
    const diag = {
      rmseAnalysis: rmse(xaNew, truth),
      rmseForecast: rmse(xf, truth),
      spread: Math.sqrt(meanDiag(PaNew)),
    };
    return { frames, diag, status: 'ok' };
  }

  return { step, reset: init };
}
