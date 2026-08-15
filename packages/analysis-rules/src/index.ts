import type { LocalizedText } from '@tone-capture-doctor/glossary';

export type RuleConfidence = 'high' | 'low' | 'medium';
export type RuleMetric =
  | 'crestFactorDb'
  | 'dominantFrequencyHz'
  | 'humFrequencyHz'
  | 'noiseFloorDbfs'
  | 'peakDbfs'
  | 'rmsDbfs';

export interface DiagnosticMetrics {
  clippingCandidate: boolean;
  crestFactorDb: number | null;
  dominantFrequencyHz: number | null;
  humFrequencyHz: 50 | 60 | null;
  noiseFloorDbfs: number | null;
  peakDbfs: number;
  rmsDbfs: number;
}

export interface DiagnosticContext {
  warnings?: readonly string[];
}

export type Condition =
  | {
      kind: 'all';
      conditions: Condition[];
    }
  | {
      kind: 'any';
      conditions: Condition[];
    }
  | {
      expected: boolean;
      kind: 'flag';
      metric: 'clippingCandidate';
    }
  | {
      expected: boolean;
      kind: 'presence';
      metric: RuleMetric;
    }
  | {
      kind: 'threshold';
      metric: RuleMetric;
      operator: 'gte' | 'gt' | 'lte' | 'lt';
      value: number;
    }
  | {
      kind: 'warning';
      warning: string;
    };

export interface DiagnosticRule {
  condition: Condition;
  confidence: RuleConfidence;
  experiments: LocalizedText[];
  id: string;
  neverClaim: LocalizedText[];
  observation: LocalizedText;
  possibleCauses: LocalizedText[];
  priority: number;
  references: string[];
}

export interface MatchedDiagnosticRule extends DiagnosticRule {
  matched: true;
}

const text = (en: string, ko: string): LocalizedText => ({ en, ko });

const INTERNAL_REFERENCES = ['internal:audio-core', 'internal:phase7-guidance'];

export const DIAGNOSTIC_RULES: DiagnosticRule[] = [
  {
    condition: { expected: true, kind: 'flag', metric: 'clippingCandidate' },
    confidence: 'medium',
    experiments: [
      text(
        'Lower the interface input gain and repeat the same passage.',
        '인터페이스 입력 게인을 낮추고 같은 구간을 반복하세요.',
      ),
    ],
    id: 'clipping-candidate',
    neverClaim: [
      text(
        'Do not claim which analog component clipped.',
        '어떤 아날로그 부품이 클리핑했는지 단정하지 않습니다.',
      ),
    ],
    observation: text(
      'A flat-top pattern near digital full scale is a clipping candidate.',
      '디지털 full scale 근처의 flat-top 패턴이 클리핑 후보로 감지되었습니다.',
    ),
    possibleCauses: [
      text(
        'Input gain may be too high, or the source may already be clipped.',
        '입력 게인이 너무 높거나 소스가 이미 클리핑되었을 수 있습니다.',
      ),
    ],
    priority: 100,
    references: INTERNAL_REFERENCES,
  },
  {
    condition: {
      conditions: [{ kind: 'threshold', metric: 'peakDbfs', operator: 'lte', value: -60 }],
      kind: 'all',
    },
    confidence: 'medium',
    experiments: [
      text(
        'Check the instrument cable and selected input, then play one steady note.',
        '악기 케이블과 선택한 입력을 확인한 뒤 일정한 음 하나를 연주하세요.',
      ),
    ],
    id: 'no-signal',
    neverClaim: [
      text(
        'Do not claim that the instrument or interface is broken from this result alone.',
        '이 결과 하나만으로 악기나 인터페이스가 고장 났다고 단정하지 않습니다.',
      ),
    ],
    observation: text(
      'The measured peak is very low; a useful input signal was not confirmed.',
      '측정 peak가 매우 낮아 유효한 입력 신호를 확인하지 못했습니다.',
    ),
    possibleCauses: [
      text(
        'The input may be muted, disconnected, or receiving a quiet passage.',
        '입력이 mute되었거나 연결되지 않았거나 조용한 구간일 수 있습니다.',
      ),
    ],
    priority: 90,
    references: INTERNAL_REFERENCES,
  },
  {
    condition: { expected: true, kind: 'presence', metric: 'humFrequencyHz' },
    confidence: 'low',
    experiments: [
      text(
        'Stop playing and compare the idle signal after changing only the cable or power arrangement safely.',
        '연주를 멈추고 안전한 범위에서 케이블 또는 전원 배치 하나만 바꾼 뒤 무음 신호를 비교하세요.',
      ),
    ],
    id: 'power-hum-candidate',
    neverClaim: [
      text(
        'Do not identify the exact grounding fault or recommend unsafe mains changes.',
        '정확한 접지 고장을 단정하거나 위험한 전원 변경을 권하지 않습니다.',
      ),
    ],
    observation: text(
      'A 50/60 Hz hum candidate is present in the measured spectrum.',
      '측정 스펙트럼에서 50/60 Hz 험 후보가 감지되었습니다.',
    ),
    possibleCauses: [
      text(
        'Power environment, cable shielding, gain, or nearby electrical equipment may contribute.',
        '전원 환경, 케이블 차폐, 게인 또는 주변 전기 장비가 영향을 줄 수 있습니다.',
      ),
    ],
    priority: 80,
    references: INTERNAL_REFERENCES,
  },
  {
    condition: { kind: 'threshold', metric: 'noiseFloorDbfs', operator: 'gte', value: -45 },
    confidence: 'medium',
    experiments: [
      text(
        'Keep the routing unchanged, stop playing briefly, and compare the idle noise floor.',
        '라우팅을 유지하고 잠시 연주를 멈춘 뒤 무음 노이즈 플로어를 비교하세요.',
      ),
    ],
    id: 'high-noise-floor',
    neverClaim: [
      text(
        'Do not claim the physical source of noise from a level measurement alone.',
        '레벨 측정 하나만으로 노이즈의 물리적 원인을 단정하지 않습니다.',
      ),
    ],
    observation: text(
      'The rolling noise-floor estimate is relatively close to digital full scale.',
      'rolling noise-floor 추정치가 디지털 full scale에 비교적 가깝습니다.',
    ),
    possibleCauses: [
      text(
        'Input gain, interface self-noise, room noise, or an open input may contribute.',
        '입력 게인, 인터페이스 자체 노이즈, 주변 소음 또는 열린 입력이 영향을 줄 수 있습니다.',
      ),
    ],
    priority: 70,
    references: INTERNAL_REFERENCES,
  },
  {
    condition: {
      conditions: [
        { kind: 'warning', warning: 'gain-control-enabled' },
        { kind: 'warning', warning: 'echo-cancellation-enabled' },
        { kind: 'warning', warning: 'noise-suppression-enabled' },
      ],
      kind: 'any',
    },
    confidence: 'high',
    experiments: [
      text(
        'Disable browser voice-processing options for the instrument input and check the reported track settings again.',
        '악기 입력에서 브라우저 음성 처리 옵션을 끄고 보고된 track 설정을 다시 확인하세요.',
      ),
    ],
    id: 'browser-processing',
    neverClaim: [
      text(
        'Do not claim that the browser applied a setting unless track settings report it.',
        'track settings가 보고하지 않은 브라우저 설정을 적용됐다고 단정하지 않습니다.',
      ),
    ],
    observation: text(
      'A browser voice-processing option is reported as enabled for the input.',
      '입력에 브라우저 음성 처리 옵션이 켜진 것으로 보고되었습니다.',
    ),
    possibleCauses: [
      text(
        'The browser or operating system may have applied voice-oriented processing.',
        '브라우저 또는 운영체제가 음성용 처리를 적용했을 수 있습니다.',
      ),
    ],
    priority: 60,
    references: INTERNAL_REFERENCES,
  },
];

function readMetric(metrics: DiagnosticMetrics, metric: RuleMetric): number | null {
  return metrics[metric];
}

function evaluateCondition(
  condition: Condition,
  metrics: DiagnosticMetrics,
  context: DiagnosticContext,
): boolean {
  switch (condition.kind) {
    case 'all':
      return condition.conditions.every((child) => evaluateCondition(child, metrics, context));
    case 'any':
      return condition.conditions.some((child) => evaluateCondition(child, metrics, context));
    case 'flag':
      return metrics[condition.metric] === condition.expected;
    case 'presence':
      return (readMetric(metrics, condition.metric) !== null) === condition.expected;
    case 'threshold': {
      const value = readMetric(metrics, condition.metric);
      if (value === null) {
        return false;
      }
      switch (condition.operator) {
        case 'gte':
          return value >= condition.value;
        case 'gt':
          return value > condition.value;
        case 'lte':
          return value <= condition.value;
        case 'lt':
          return value < condition.value;
      }
      return false;
    }
    case 'warning':
      return context.warnings?.includes(condition.warning) ?? false;
  }
}

export function evaluateDiagnosticRules(
  metrics: DiagnosticMetrics,
  context: DiagnosticContext = {},
): MatchedDiagnosticRule[] {
  return DIAGNOSTIC_RULES.filter((rule) => evaluateCondition(rule.condition, metrics, context))
    .sort((left, right) => right.priority - left.priority)
    .map((rule) => ({ ...rule, matched: true as const }));
}
