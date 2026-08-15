export type SupportedLocale = 'en' | 'ko';

export interface LocalizedText {
  en: string;
  ko: string;
}

export interface GlossaryEntry {
  commonCauses: LocalizedText[];
  id: string;
  measuredByThisApp: LocalizedText;
  notMeasuredByThisApp: LocalizedText;
  references: string[];
  safeExperiments: LocalizedText[];
  shortDefinition: LocalizedText;
  term: LocalizedText;
  warnings?: LocalizedText[];
}

const INTERNAL_REFERENCES = ['internal:audio-core', 'internal:phase7-guidance'];

const text = (en: string, ko: string): LocalizedText => ({ en, ko });

export const GLOSSARY_ENTRIES: GlossaryEntry[] = [
  {
    commonCauses: [
      text(
        'Pitch, tuning, sample rate, or the selected signal path.',
        '피치, 튜닝, 샘플레이트 또는 선택한 신호 경로',
      ),
    ],
    id: 'hz',
    measuredByThisApp: text(
      'Dominant frequency and hum candidates are reported in Hz.',
      '주요 주파수와 험 후보를 Hz로 표시합니다.',
    ),
    notMeasuredByThisApp: text(
      'Hz does not identify the instrument, pickup, or cause by itself.',
      'Hz만으로 악기, 픽업 또는 원인을 식별하지 않습니다.',
    ),
    references: INTERNAL_REFERENCES,
    safeExperiments: [
      text(
        'Play one open string or a steady test tone and compare the reported frequency.',
        '개방현 하나 또는 일정한 테스트 톤을 내고 표시 주파수를 비교하세요.',
      ),
    ],
    shortDefinition: text(
      'Hertz is cycles per second, used here for frequency.',
      '헤르츠는 초당 주기 수이며 여기서는 주파수 단위로 사용합니다.',
    ),
    term: text('Hz', 'Hz'),
  },
  {
    commonCauses: [
      text(
        'Gain changes, level matching, or different monitoring volume.',
        '게인 변화, 레벨 매칭, 다른 모니터링 음량',
      ),
    ],
    id: 'db',
    measuredByThisApp: text(
      'Relative changes are shown as dB differences where applicable.',
      '필요한 곳에서 상대 변화를 dB 차이로 표시합니다.',
    ),
    notMeasuredByThisApp: text(
      'This app does not measure room loudness in dB SPL.',
      '이 앱은 방의 음압 레벨인 dB SPL을 측정하지 않습니다.',
    ),
    references: INTERNAL_REFERENCES,
    safeExperiments: [
      text(
        'Match the monitoring volume before making a listening judgment.',
        '청취 판단 전에 모니터링 음량을 맞추세요.',
      ),
    ],
    shortDefinition: text(
      'A logarithmic ratio used to describe level or power change.',
      '레벨 또는 파워 변화를 표현하는 로그 비율입니다.',
    ),
    term: text('dB', 'dB'),
  },
  {
    commonCauses: [
      text(
        'Input gain, interface headroom, or a loud source.',
        '입력 게인, 인터페이스 헤드룸 또는 큰 입력 신호',
      ),
    ],
    id: 'dbfs',
    measuredByThisApp: text(
      'Peak and RMS levels are reported relative to digital full scale.',
      'Peak과 RMS를 디지털 full scale 기준으로 표시합니다.',
    ),
    notMeasuredByThisApp: text(
      'dBFS is not dB SPL and does not tell you how loud the room is.',
      'dBFS는 dB SPL이 아니며 방에서 얼마나 큰 소리인지 알려주지 않습니다.',
    ),
    references: INTERNAL_REFERENCES,
    safeExperiments: [
      text(
        'Lower input gain if peaks approach 0 dBFS, then capture the same passage again.',
        'peak이 0 dBFS에 가까우면 입력 게인을 낮추고 같은 구간을 다시 캡처하세요.',
      ),
    ],
    shortDefinition: text(
      'Digital level where 0 dBFS is the maximum representable level.',
      '디지털에서 0 dBFS가 표현 가능한 최대 레벨인 단위입니다.',
    ),
    term: text('dBFS', 'dBFS'),
    warnings: [
      text(
        'Do not confuse dBFS with acoustic dB SPL.',
        'dBFS와 음압 단위인 dB SPL을 혼동하지 마세요.',
      ),
    ],
  },
  {
    commonCauses: [
      text(
        'Transient playing, clipping, or a sudden change in input gain.',
        '트랜지언트 연주, 클리핑 또는 갑작스러운 입력 게인 변화',
      ),
    ],
    id: 'peak',
    measuredByThisApp: text(
      'Sample peak of the analyzed frame.',
      '분석 프레임의 sample peak를 측정합니다.',
    ),
    notMeasuredByThisApp: text(
      'It is not a true-peak or speaker safety guarantee.',
      'true peak이나 스피커 안전을 보장하는 값은 아닙니다.',
    ),
    references: INTERNAL_REFERENCES,
    safeExperiments: [
      text(
        'Compare peak while repeating the same phrase with lighter and stronger picking.',
        '같은 프레이즈를 약하게·강하게 피킹하며 peak을 비교하세요.',
      ),
    ],
    shortDefinition: text(
      'The largest sample magnitude in a frame.',
      '프레임에서 가장 큰 sample magnitude입니다.',
    ),
    term: text('Peak', 'Peak'),
  },
  {
    commonCauses: [
      text(
        'Playing dynamics, gain staging, noise, or compression.',
        '연주 다이내믹, 게인 구조, 노이즈 또는 컴프레션',
      ),
    ],
    id: 'rms',
    measuredByThisApp: text(
      'Frame RMS and a rolling noise-floor estimate.',
      '프레임 RMS와 rolling noise-floor 추정치를 측정합니다.',
    ),
    notMeasuredByThisApp: text(
      'It is not LUFS and does not represent perceived loudness for every program.',
      'LUFS가 아니며 모든 프로그램의 체감 음량을 나타내지 않습니다.',
    ),
    references: INTERNAL_REFERENCES,
    safeExperiments: [
      text(
        'Repeat the same passage at matched picking strength before comparing RMS.',
        'RMS 비교 전에 같은 피킹 강도로 같은 구간을 반복하세요.',
      ),
    ],
    shortDefinition: text(
      'Root mean square level, a short-window energy measure.',
      '짧은 구간의 에너지를 나타내는 제곱평균제곱근 레벨입니다.',
    ),
    term: text('RMS', 'RMS'),
  },
  {
    commonCauses: [
      text(
        'Program loudness, mastering, and time-window choice.',
        '프로그램 음량, 마스터링, 시간 창 선택',
      ),
    ],
    id: 'lufs',
    measuredByThisApp: text(
      'Not currently measured in Signal Health.',
      '현재 Signal Health에서는 측정하지 않습니다.',
    ),
    notMeasuredByThisApp: text(
      'Integrated, short-term, and momentary LUFS are outside the current engine.',
      'integrated·short-term·momentary LUFS는 현재 엔진 범위 밖입니다.',
    ),
    references: INTERNAL_REFERENCES,
    safeExperiments: [
      text(
        'Use RMS and matched snapshots for this MVP instead of inferring LUFS.',
        '이 MVP에서는 LUFS를 추정하지 말고 RMS와 매칭된 스냅샷을 사용하세요.',
      ),
    ],
    shortDefinition: text(
      'A loudness unit referenced to full scale, commonly used for program loudness.',
      '프로그램 음량에 흔히 사용하는 full scale 기준 loudness 단위입니다.',
    ),
    term: text('LUFS', 'LUFS'),
  },
  {
    commonCauses: [
      text(
        'FFT size, window function, sample rate, and signal length.',
        'FFT 크기, window 함수, 샘플레이트, 신호 길이',
      ),
    ],
    id: 'fft',
    measuredByThisApp: text(
      'A Hann-windowed FFT is used for dominant frequency and spectrum features.',
      'Hann window FFT를 주요 주파수와 스펙트럼에 사용합니다.',
    ),
    notMeasuredByThisApp: text(
      'FFT bins are not a complete perceptual or musical judgment.',
      'FFT bin만으로 지각적·음악적 판단을 완성할 수 없습니다.',
    ),
    references: INTERNAL_REFERENCES,
    safeExperiments: [
      text(
        'Keep sample rate and input path fixed when comparing two spectra.',
        '두 스펙트럼 비교 시 샘플레이트와 입력 경로를 고정하세요.',
      ),
    ],
    shortDefinition: text(
      'Fast Fourier Transform, a way to inspect frequency content.',
      '주파수 성분을 살펴보는 방법인 고속 푸리에 변환입니다.',
    ),
    term: text('FFT', 'FFT'),
  },
  {
    commonCauses: [
      text(
        'Edge leakage and transient content in a finite analysis frame.',
        '유한 분석 프레임의 경계 누설과 트랜지언트 성분',
      ),
    ],
    id: 'window',
    measuredByThisApp: text(
      'The analysis engine uses a Hann window before FFT.',
      '분석 엔진은 FFT 전에 Hann window를 사용합니다.',
    ),
    notMeasuredByThisApp: text(
      'The window does not remove room or instrument differences.',
      'window가 방이나 악기 차이를 제거하지는 않습니다.',
    ),
    references: INTERNAL_REFERENCES,
    safeExperiments: [
      text(
        'Compare snapshots with the same FFT and window metadata.',
        '같은 FFT와 window metadata를 가진 스냅샷을 비교하세요.',
      ),
    ],
    shortDefinition: text(
      'A weighting shape applied to a finite frame before frequency analysis.',
      '주파수 분석 전에 유한 프레임에 적용하는 가중 형태입니다.',
    ),
    term: text('Window', 'Window'),
  },
  {
    commonCauses: [
      text(
        'Pickup, tone controls, effects, room response, and input filtering.',
        '픽업, 톤 컨트롤, 이펙트, 방 응답, 입력 필터',
      ),
    ],
    id: 'spectrum',
    measuredByThisApp: text(
      'Relative frequency content is visualized and compared across bands.',
      '상대 주파수 성분을 시각화하고 대역별로 비교합니다.',
    ),
    notMeasuredByThisApp: text(
      'A spectrum does not prove which hardware control caused a change.',
      '스펙트럼만으로 어떤 하드웨어 조작이 원인인지 증명하지 않습니다.',
    ),
    references: INTERNAL_REFERENCES,
    safeExperiments: [
      text(
        'Change one part of the signal path at a time and save both snapshots.',
        '신호 경로의 한 부분만 바꾸고 두 스냅샷을 저장하세요.',
      ),
    ],
    shortDefinition: text(
      'A view of signal magnitude distributed across frequency.',
      '주파수에 따라 분포된 신호 크기를 보는 방법입니다.',
    ),
    term: text('Spectrum', 'Spectrum'),
  },
  {
    commonCauses: [
      text(
        'Time-varying playing, modulation, and changing noise.',
        '시간에 따라 변하는 연주, 모듈레이션, 변화하는 노이즈',
      ),
    ],
    id: 'spectrogram',
    measuredByThisApp: text(
      'The UI draws a scrolling time-by-frequency view from the local analyser.',
      'UI는 로컬 analyser에서 시간-주파수 화면을 그립니다.',
    ),
    notMeasuredByThisApp: text(
      'It does not identify musical intent or automatically name an effect.',
      '음악적 의도나 이펙트를 자동으로 식별하지 않습니다.',
    ),
    references: INTERNAL_REFERENCES,
    safeExperiments: [
      text(
        'Hold a steady note, then repeat with the effect bypassed and compare the time pattern.',
        '일정한 음을 유지한 뒤 이펙트를 bypass하고 시간 패턴을 비교하세요.',
      ),
    ],
    shortDefinition: text(
      'A sequence of spectra showing how frequency content changes over time.',
      '시간에 따른 주파수 성분 변화를 보여주는 연속 스펙트럼입니다.',
    ),
    term: text('Spectrogram', 'Spectrogram'),
  },
  {
    commonCauses: [
      text(
        'Instrument strings, pickups, resonance, and nonlinear processing.',
        '악기 현, 픽업, 공진, 비선형 처리',
      ),
    ],
    id: 'harmonic',
    measuredByThisApp: text(
      'Harmonic-like peaks may appear in the spectrum, but are not classified as musical identity.',
      '하모닉과 같은 peak가 스펙트럼에 나타날 수 있지만 음악적 정체성으로 분류하지 않습니다.',
    ),
    notMeasuredByThisApp: text(
      'It does not infer pickup type or exact instrument construction.',
      '픽업 종류나 정확한 악기 구조를 추론하지 않습니다.',
    ),
    references: INTERNAL_REFERENCES,
    safeExperiments: [
      text(
        'Use the same note and picking position when observing harmonic changes.',
        '하모닉 변화를 볼 때 같은 음과 피킹 위치를 사용하세요.',
      ),
    ],
    shortDefinition: text(
      'A frequency component related to a fundamental frequency.',
      '기본 주파수와 관련된 주파수 성분입니다.',
    ),
    term: text('Harmonic', 'Harmonic'),
  },
  {
    commonCauses: [
      text(
        'Interface self-noise, grounding, gain, room noise, or an unconnected input.',
        '인터페이스 자체 노이즈, 접지, 게인, 주변 소음, 연결되지 않은 입력',
      ),
    ],
    id: 'noise-floor',
    measuredByThisApp: text(
      'A rolling minimum RMS estimate over recent analysis frames.',
      '최근 분석 프레임의 rolling minimum RMS 추정치입니다.',
    ),
    notMeasuredByThisApp: text(
      'It does not locate the physical source of noise.',
      '노이즈의 물리적 원인을 찾아주지는 않습니다.',
    ),
    references: INTERNAL_REFERENCES,
    safeExperiments: [
      text(
        'Stop playing briefly, keep the routing unchanged, and compare the idle noise floor.',
        '잠시 연주를 멈추고 라우팅을 유지한 채 무음 노이즈 플로어를 비교하세요.',
      ),
    ],
    shortDefinition: text(
      'The baseline signal energy present when the desired signal is quiet.',
      '원하는 신호가 조용할 때 존재하는 기본 신호 에너지입니다.',
    ),
    term: text('Noise floor', 'Noise floor'),
  },
  {
    commonCauses: [
      text(
        'Input gain too high, a clipped source, or a hard digital limit.',
        '입력 게인이 너무 높음, 클리핑된 소스, 디지털 제한',
      ),
    ],
    id: 'clipping',
    measuredByThisApp: text(
      'Flat-top sample patterns near full scale are marked as a clipping candidate.',
      'full scale 근처의 flat-top sample 패턴을 클리핑 후보로 표시합니다.',
    ),
    notMeasuredByThisApp: text(
      'A candidate is not proof of the analog component or exact location that clipped.',
      '후보 표시는 클리핑한 아날로그 부품이나 정확한 위치의 증명이 아닙니다.',
    ),
    references: INTERNAL_REFERENCES,
    safeExperiments: [
      text(
        'Lower interface input gain and repeat the same passage.',
        '인터페이스 입력 게인을 낮추고 같은 구간을 반복하세요.',
      ),
    ],
    shortDefinition: text(
      'A waveform is cut off because a stage cannot represent a larger level.',
      '한 단계가 더 큰 레벨을 표현하지 못해 파형이 잘리는 현상입니다.',
    ),
    term: text('Clipping', 'Clipping'),
    warnings: [
      text(
        'Never use a speaker output as an interface input.',
        '스피커 출력을 인터페이스 입력으로 사용하지 마세요.',
      ),
    ],
  },
  {
    commonCauses: [
      text(
        'Transient-heavy playing, compression, or distortion.',
        '트랜지언트가 많은 연주, 컴프레션 또는 디스토션',
      ),
    ],
    id: 'crest-factor',
    measuredByThisApp: text(
      'Peak-to-RMS ratio is reported for each analyzed frame.',
      '각 분석 프레임의 peak-to-RMS 비율을 표시합니다.',
    ),
    notMeasuredByThisApp: text(
      'It does not identify the specific compressor or effect setting.',
      '특정 컴프레서나 이펙트 설정을 식별하지 않습니다.',
    ),
    references: INTERNAL_REFERENCES,
    safeExperiments: [
      text(
        'Repeat with matched level and compare crest factor before changing hardware.',
        '하드웨어를 바꾸기 전에 레벨을 맞추고 crest factor를 비교하세요.',
      ),
    ],
    shortDefinition: text(
      'The ratio between a frame peak and its RMS level.',
      '프레임 peak와 RMS 레벨의 비율입니다.',
    ),
    term: text('Crest factor', 'Crest factor'),
  },
  {
    commonCauses: [
      text(
        'Playing dynamics, compression, limiting, distortion, or sustained noise.',
        '연주 다이내믹, 컴프레션, 리미팅, 디스토션 또는 지속 노이즈',
      ),
    ],
    id: 'dynamic-range',
    measuredByThisApp: text(
      'Peak, RMS, crest factor, and noise floor provide related evidence.',
      'Peak, RMS, crest factor, noise floor가 관련 근거를 제공합니다.',
    ),
    notMeasuredByThisApp: text(
      'No single displayed number is a complete perceptual dynamic-range judgment.',
      '화면의 단일 숫자 하나가 체감 다이내믹 레인지 전체를 판단하지는 않습니다.',
    ),
    references: INTERNAL_REFERENCES,
    safeExperiments: [
      text(
        'Compare a quiet passage and a strong passage with the same routing.',
        '같은 라우팅으로 조용한 구간과 강한 구간을 비교하세요.',
      ),
    ],
    shortDefinition: text(
      'The span between quieter and louder parts of a signal.',
      '신호의 조용한 부분과 큰 부분 사이의 범위입니다.',
    ),
    term: text('Dynamic range', 'Dynamic range'),
  },
  {
    commonCauses: [
      text(
        'Buffer size, browser scheduling, device drivers, and processing path.',
        '버퍼 크기, 브라우저 스케줄링, 장치 드라이버, 처리 경로',
      ),
    ],
    id: 'latency',
    measuredByThisApp: text(
      'The current browser MVP does not measure round-trip latency.',
      '현재 브라우저 MVP는 round-trip latency를 측정하지 않습니다.',
    ),
    notMeasuredByThisApp: text(
      'Displayed frame timing is not a hardware latency measurement.',
      '표시된 프레임 timing은 하드웨어 latency 측정값이 아닙니다.',
    ),
    references: INTERNAL_REFERENCES,
    safeExperiments: [
      text(
        'Use the same browser and interface settings for both comparison snapshots.',
        '두 비교 스냅샷에서 같은 브라우저와 인터페이스 설정을 사용하세요.',
      ),
    ],
    shortDefinition: text(
      'Time between an input event and its observed output or response.',
      '입력 이벤트와 관찰된 출력 또는 반응 사이의 시간입니다.',
    ),
    term: text('Latency', 'Latency'),
  },
  {
    commonCauses: [
      text(
        'Instrument-level input impedance and the selected interface input mode.',
        '악기 레벨 입력 임피던스와 선택한 인터페이스 입력 모드',
      ),
    ],
    id: 'hi-z',
    measuredByThisApp: text(
      'The app can show the selected browser input and reported track settings.',
      '앱은 선택한 브라우저 입력과 보고된 track 설정을 표시할 수 있습니다.',
    ),
    notMeasuredByThisApp: text(
      'It does not verify the physical impedance circuit or guarantee a Hi-Z mode.',
      '물리적 임피던스 회로나 Hi-Z 모드를 검증·보장하지 않습니다.',
    ),
    references: INTERNAL_REFERENCES,
    safeExperiments: [
      text(
        'Use the interface manufacturer-approved instrument/Hi-Z input and check its manual.',
        '인터페이스 제조사가 승인한 instrument/Hi-Z 입력과 설명서를 사용하세요.',
      ),
    ],
    shortDefinition: text(
      'A high-impedance input intended for instrument-level sources.',
      '악기 레벨 소스를 위한 고임피던스 입력입니다.',
    ),
    term: text('Hi-Z', 'Hi-Z'),
    warnings: [
      text(
        'Do not connect a tube amp speaker output directly to an interface input.',
        '진공관 앰프 speaker output을 인터페이스 입력에 직접 연결하지 마세요.',
      ),
    ],
  },
  {
    commonCauses: [
      text(
        'Cable, pickup, input design, or a mismatch between source and input.',
        '케이블, 픽업, 입력 설계 또는 소스와 입력의 불일치',
      ),
    ],
    id: 'impedance',
    measuredByThisApp: text(
      'Impedance is explained but not directly measured by the browser app.',
      '임피던스는 설명하지만 브라우저 앱에서 직접 측정하지 않습니다.',
    ),
    notMeasuredByThisApp: text(
      'It does not identify the impedance of every connected device.',
      '연결된 모든 장치의 임피던스를 식별하지 않습니다.',
    ),
    references: INTERNAL_REFERENCES,
    safeExperiments: [
      text(
        'Compare the manufacturer-approved input mode without changing the unsafe routing.',
        '위험한 라우팅을 바꾸지 않고 제조사 승인 입력 모드를 비교하세요.',
      ),
    ],
    shortDefinition: text(
      'The relationship between voltage and current in an AC signal path.',
      '교류 신호 경로에서 전압과 전류의 관계입니다.',
    ),
    term: text('Impedance', 'Impedance'),
  },
];

export function getGlossaryEntry(id: string): GlossaryEntry | undefined {
  return GLOSSARY_ENTRIES.find((entry) => entry.id === id);
}

export function filterGlossaryEntries(query: string, locale: SupportedLocale): GlossaryEntry[] {
  const normalizedQuery = query.trim().toLocaleLowerCase(locale === 'ko' ? 'ko-KR' : 'en-US');
  if (!normalizedQuery) {
    return GLOSSARY_ENTRIES;
  }
  return GLOSSARY_ENTRIES.filter((entry) => {
    const values = [
      entry.id,
      entry.term.en,
      entry.term.ko,
      entry.shortDefinition.en,
      entry.shortDefinition.ko,
      entry.measuredByThisApp.en,
      entry.measuredByThisApp.ko,
      entry.notMeasuredByThisApp.en,
      entry.notMeasuredByThisApp.ko,
      ...entry.commonCauses.flatMap((cause) => [cause.en, cause.ko]),
      ...entry.safeExperiments.flatMap((experiment) => [experiment.en, experiment.ko]),
    ];
    return values.some((value) =>
      value.toLocaleLowerCase(locale === 'ko' ? 'ko-KR' : 'en-US').includes(normalizedQuery),
    );
  });
}
