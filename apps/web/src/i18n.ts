import type { AudioInputWarningCode } from './audioInput';

export type Locale = 'en' | 'ko';
export type ConnectionStatus =
  | 'idle'
  | 'requesting'
  | 'connected'
  | 'stopped'
  | 'permission-denied'
  | 'device-unavailable'
  | 'unsupported'
  | 'error';

export const LOCALE_STORAGE_KEY = 'tone-capture-doctor.locale';

export interface Messages {
  analysis: {
    active: string;
    errorDetail: string;
    fallback: string;
    fallbackReason: string;
    unavailable: string;
    starting: string;
  };
  app: {
    language: string;
    languageEnglish: string;
    languageKorean: string;
    localFirst: string;
    name: string;
  };
  metrics: {
    checkInputLevel: string;
    clippingCandidate: string;
    clippingNotice: string;
    confidence: string;
    confidenceHigh: string;
    confidenceLow: string;
    confidenceMedium: string;
    dominantFrequency: string;
    empty: string;
    eyebrow: string;
    humCandidate: string;
    noiseFloor: string;
    notDetected: string;
    notReady: string;
    peak: string;
    rms: string;
    title: string;
  };
  snapshots: {
    audioClipInvalid: string;
    audioClipNotReady: string;
    audioClipSaved: string;
    audioClipUnavailable: string;
    delete: string;
    deleteAll: string;
    deleteAllConfirm: string;
    deletedAll: string;
    deleteConfirm: string;
    empty: string;
    error: string;
    exportLog: string;
    exportSnapshots: string;
    exportTonecheck: string;
    importSnapshots: string;
    importTonecheck: string;
    imported: string;
    invalidImport: string;
    quota: string;
    label: string;
    notes: string;
    analysisNotReady: string;
    pauseClip: string;
    playClip: string;
    clipEnd: string;
    clipSelection: string;
    clipStart: string;
    save: string;
    saved: string;
    title: string;
    tonecheckExported: string;
    tonecheckImported: string;
    tonecheckInvalid: string;
    eyebrow: string;
  };
  visualizer: {
    binWidth: string;
    channels: string;
    dominantFrequency: string;
    fftSize: string;
    frequencyScale: string;
    noSignal: string;
    nyquist: string;
    peak: string;
    rms: string;
    sampleRate: string;
    spectrum: string;
    spectrogram: string;
    timeScale: string;
    timeWindow: string;
    title: string;
    waveformScale: string;
    window: string;
    waveform: string;
  };
  connection: {
    audioStatus: string;
    inputUnavailable: string;
    noLabelledInputs: string;
    startToList: string;
    switchError: string;
  };
  compare: {
    alignment: string;
    candidate: string;
    confidence: string;
    confidenceHigh: string;
    confidenceLow: string;
    confidenceMedium: string;
    delta: string;
    empty: string;
    frequencyChanged: string;
    frequencyInterpretation: string;
    lowConfidenceNotice: string;
    loudnessNormalized: string;
    normalization: string;
    noMaterialDifference: string;
    noiseChanged: string;
    noiseInterpretation: string;
    reference: string;
    run: string;
    selectBoth: string;
    spectrumDelta: string;
    title: string;
    waveformDelta: string;
    clippingCandidate: string;
    clippingInterpretation: string;
    band: string;
    incompatible: string;
  };
  glossary: {
    causes: string;
    experiments: string;
    eyebrow: string;
    measured: string;
    noResults: string;
    notMeasured: string;
    references: string;
    search: string;
    searchPlaceholder: string;
    term: string;
    title: string;
    warnings: string;
  };
  guidance: {
    causes: string;
    confidence: string;
    confidenceHigh: string;
    confidenceLow: string;
    confidenceMedium: string;
    empty: string;
    experiments: string;
    eyebrow: string;
    neverClaim: string;
    observation: string;
    title: string;
  };
  dryWet: {
    active: string;
    band: string;
    channel: string;
    correlation: string;
    crest: string;
    delta: string;
    description: string;
    dry: string;
    dryInput: string;
    dynamics: string;
    droppedQuanta: string;
    eyebrow: string;
    gainDifference: string;
    input: string;
    latency: string;
    latencyEstimated: string;
    latencyMeasured: string;
    mode: string;
    modeIndeterminate: string;
    modeMonoLike: string;
    modeNoSignal: string;
    modeStereoDistinct: string;
    levelMatchedDelta: string;
    needsTwoChannels: string;
    peakDifference: string;
    rms: string;
    repeatability: string;
    repeatabilityHigh: string;
    repeatabilityLow: string;
    repeatabilityMedium: string;
    safetyDescription: string;
    safetyTitle: string;
    spectrum: string;
    startRequired: string;
    starting: string;
    title: string;
    unavailable: string;
    unavailableMetric: string;
    waitingForSpectrum: string;
    warningBothNoSignal: string;
    warningChannelSwap: string;
    warningDryNoSignal: string;
    warningLatencyLowConfidence: string;
    warningMonoLike: string;
    warningWetNoSignal: string;
    wet: string;
    wetInput: string;
  };
  hero: {
    copy: string;
    eyebrow: string;
    title: string;
  };
  input: {
    chooseDevice: string;
    description: string;
    eyebrow: string;
    ready: string;
    requesting: string;
    start: string;
    stop: string;
  };
  routing: {
    description: string;
    eyebrow: string;
    title: string;
  };
  settings: {
    autoGain: string;
    channels: string;
    echoCancellation: string;
    eyebrow: string;
    noiseSuppression: string;
    notReported: string;
    off: string;
    on: string;
    sampleRate: string;
    title: string;
  };
  status: Record<ConnectionStatus, { label: string; message: string }>;
  warnings: Record<AudioInputWarningCode, string>;
}

export const MESSAGES: Record<Locale, Messages> = {
  en: {
    analysis: {
      active: 'Live metrics are calculated locally from the input stream.',
      errorDetail: 'Diagnostic detail',
      fallback:
        'Compatibility mode is active: live metrics are calculated with an AnalyserNode fallback.',
      fallbackReason: 'Fallback reason',
      unavailable: 'Live metrics are unavailable in this browser, but the input remains connected.',
      starting: 'Starting local measurement…',
    },
    app: {
      language: 'Language',
      languageEnglish: 'English',
      languageKorean: '한국어',
      localFirst: 'Local-first audio diagnostics',
      name: 'ToneCaptureDoctor',
    },
    metrics: {
      checkInputLevel: 'Check input level',
      clippingCandidate: 'Clipping candidate',
      clippingNotice: 'Clipping candidate detected. Lower the interface input gain and test again.',
      confidence: 'Confidence',
      confidenceHigh: 'High',
      confidenceLow: 'Low · repeat the test',
      confidenceMedium: 'Medium · directional evidence',
      dominantFrequency: 'Dominant frequency',
      empty: 'Start Signal Health to calculate local peak, RMS, frequency, and clipping metrics.',
      eyebrow: 'Live measurement',
      humCandidate: 'Hum candidate',
      noiseFloor: 'Noise floor',
      notDetected: 'Not detected',
      notReady: 'Waiting for enough samples',
      peak: 'Peak',
      rms: 'RMS',
      title: 'Signal metrics',
    },
    snapshots: {
      audioClipInvalid: 'This audio clip has no readable duration. Record a new snapshot.',
      audioClipNotReady: 'No audio clip is ready yet. Keep the input running and save again.',
      audioClipSaved: 'A short local audio clip is attached to this snapshot.',
      audioClipUnavailable: 'Audio clip capture is unavailable in this browser.',
      delete: 'Delete',
      deleteAll: 'Delete all local data',
      deleteAllConfirm: 'Delete all local snapshots and test logs from this browser?',
      deletedAll: 'All local snapshots and test logs were deleted.',
      deleteConfirm: 'Delete this local snapshot?',
      empty: 'Save a snapshot during a live test to compare metrics later.',
      error: 'The snapshot could not be saved. Check local browser storage and try again.',
      exportLog: 'Export test log',
      exportSnapshots: 'Export snapshots',
      exportTonecheck: 'Export .tonecheck',
      importSnapshots: 'Import snapshots',
      importTonecheck: 'Import .tonecheck',
      imported: 'Snapshots imported locally.',
      invalidImport: 'The snapshot file could not be imported.',
      quota: 'Local storage is full. Export your snapshots and remove older data before retrying.',
      label: 'Snapshot label',
      notes: 'Notes about this test',
      analysisNotReady: 'Wait for calibrated waveform and spectrum analysis before saving.',
      pauseClip: 'Pause clip',
      playClip: 'Play selected clip',
      clipEnd: 'Selection end',
      clipSelection: 'Select a clip range',
      clipStart: 'Selection start',
      save: 'Save snapshot',
      saved: 'Snapshot saved locally.',
      title: 'Test snapshots',
      tonecheckExported: '.tonecheck session archive exported locally.',
      tonecheckImported: '.tonecheck session archive imported locally.',
      tonecheckInvalid: 'The .tonecheck archive could not be imported.',
      eyebrow: 'Local evidence',
    },
    visualizer: {
      binWidth: 'Bin width',
      channels: 'Channels',
      dominantFrequency: 'Dominant frequency',
      fftSize: 'FFT size',
      frequencyScale: 'Frequency · Hz',
      noSignal: 'Start Signal Health to see the local signal.',
      nyquist: 'Nyquist',
      peak: 'Peak',
      rms: 'RMS',
      sampleRate: 'Sample rate',
      spectrum: 'Spectrum · logarithmic frequency axis',
      spectrogram: 'Spectrogram',
      timeScale: 'Time · ms',
      timeWindow: 'Waveform zoom',
      title: 'Signal view',
      waveformScale: 'Amplitude · dBFS',
      window: 'Window',
      waveform: 'Waveform',
    },
    connection: {
      audioStatus: 'Audio input status',
      inputUnavailable:
        'The selected input is no longer available. Connect it again or choose another input.',
      noLabelledInputs:
        'No labelled audio inputs were returned. Check the browser device permission.',
      startToList: 'Start Signal Health to request permission and list available inputs.',
      switchError: 'The previous input is still connected. The new input could not be opened.',
    },
    compare: {
      alignment: 'Alignment',
      candidate: 'Candidate snapshot',
      confidence: 'Difference confidence',
      confidenceHigh: 'High · stable repeated signal',
      confidenceLow: 'Low · clipping, noise, or weak alignment',
      confidenceMedium: 'Medium · useful directional evidence',
      delta: 'Delta',
      empty: 'Choose two saved snapshots to compare after a test.',
      frequencyChanged: 'Frequency balance changed by at least 1.5 dB in one or more bands.',
      frequencyInterpretation:
        'Possible interpretation: the input chain changed frequency balance; check the same playing passage and routing.',
      lowConfidenceNotice:
        'Treat this as measured evidence, not a tone verdict. Repeat with matched playing and level.',
      loudnessNormalized: 'Candidate level was normalized before waveform comparison.',
      normalization: 'Loudness normalization',
      noMaterialDifference:
        'No large measured difference crossed the current comparison thresholds.',
      noiseChanged: 'Noise floor changed by at least 3 dB.',
      noiseInterpretation:
        'Possible interpretation: the noise environment or input gain changed; repeat with the same idle interval.',
      reference: 'Reference snapshot',
      run: 'Compare snapshots',
      selectBoth: 'Select two different snapshots first.',
      spectrumDelta: 'Spectrum mean delta',
      title: 'Tone Compare · measured differences',
      waveformDelta: 'Waveform RMS delta',
      clippingCandidate: 'Clipping candidate present in one snapshot.',
      clippingInterpretation:
        'Possible interpretation: clipping can dominate the difference; lower input gain and capture again.',
      band: 'Band',
      incompatible: 'These snapshots use incompatible analysis data and cannot be compared safely.',
    },
    glossary: {
      causes: 'Possible causes',
      experiments: 'Safe next experiments',
      eyebrow: 'Glossary',
      measured: 'Measured by this app',
      noResults: 'No glossary term matches this search.',
      notMeasured: 'Not measured by this app',
      references: 'Evidence',
      search: 'Search terms',
      searchPlaceholder: 'Try dBFS, noise, or latency',
      term: 'Choose a term',
      title: 'Audio glossary',
      warnings: 'Safety notes',
    },
    guidance: {
      causes: 'Possible causes',
      confidence: 'Rule confidence',
      confidenceHigh: 'High · directly reported setting or pattern',
      confidenceLow: 'Low · candidate signal that needs a repeat',
      confidenceMedium: 'Medium · useful measurement, not a diagnosis',
      empty: 'No diagnostic rule matched. Repeat with a steady signal if you need more evidence.',
      experiments: 'Safe next experiment',
      eyebrow: 'Measured guidance',
      neverClaim: 'This rule does not claim',
      observation: 'Measured observation',
      title: 'What to check next',
    },
    dryWet: {
      active: 'Two-channel frames are measured locally.',
      band: 'Band',
      channel: 'Channel',
      correlation: 'Correlation',
      crest: 'Crest',
      delta: 'Wet − dry',
      description:
        'Compare two channels from the same interface frame. Latency is labelled as measured or estimated; no tone verdict is produced.',
      dry: 'Dry',
      dryInput: 'Dry input',
      dynamics: 'Dynamics',
      droppedQuanta: 'Dropped input quanta',
      eyebrow: 'Two-channel evidence',
      gainDifference: 'RMS gain difference',
      input: 'Input',
      latency: 'Latency candidate',
      latencyEstimated: 'estimated',
      latencyMeasured: 'measured',
      levelMatchedDelta: 'Level-matched residual',
      mode: 'Channel state',
      modeIndeterminate: 'Not enough signal',
      modeMonoLike: 'Mono-like',
      modeNoSignal: 'No signal',
      modeStereoDistinct: 'Stereo-distinct',
      needsTwoChannels:
        'The browser reported fewer than two input channels. Use a two-channel interface or continue with Signal Health.',
      peakDifference: 'Peak difference',
      rms: 'RMS',
      repeatability: 'Repeated latency',
      repeatabilityHigh: 'stable',
      repeatabilityLow: 'unstable',
      repeatabilityMedium: 'usable but variable',
      safetyDescription:
        'Use line/instrument inputs or a manufacturer-approved load box. Never connect an amplifier speaker output directly to an interface input.',
      safetyTitle: 'Safe routing:',
      spectrum: 'Spectrum difference',
      startRequired: 'Start Signal Health to open a local two-channel measurement.',
      starting: 'Starting two-channel measurement…',
      title: 'Dry/Wet Doctor',
      unavailable:
        'Two-channel measurement is unavailable in this browser; Signal Health remains available.',
      unavailableMetric: 'unavailable',
      waitingForSpectrum: 'Waiting for a calibrated spectrum frame.',
      warningBothNoSignal: 'Neither selected channel has enough signal for a latency candidate.',
      warningChannelSwap:
        'Possible channel swap: wet appears to lead dry. Verify the input routing before repeating.',
      warningDryNoSignal: 'Dry input is below the no-signal threshold.',
      warningLatencyLowConfidence:
        'Latency correlation is weak; repeat with the same playing passage.',
      warningMonoLike:
        'The selected channels are effectively mono-like. Check whether both inputs carry the same source.',
      warningWetNoSignal: 'Wet input is below the no-signal threshold.',
      wet: 'Wet',
      wetInput: 'Wet input',
    },
    hero: {
      copy: 'Check whether an instrument signal is reaching your interface before comparing tones. The first release keeps analysis local and explains the next useful experiment.',
      eyebrow: 'First mode',
      title: 'Signal Health',
    },
    input: {
      chooseDevice: 'Choose an audio input',
      description:
        'Connect a guitar or bass to an instrument/Hi-Z input. Permission is requested only after you choose to start, and the stream stays in this browser session.',
      eyebrow: 'Input overview',
      ready: 'Ready when you are',
      requesting: 'Requesting permission…',
      start: 'Start Signal Health',
      stop: 'Stop Signal Health',
    },
    routing: {
      description:
        'Never connect a tube amplifier speaker output directly to an interface input. Use a microphone, load box, DI, or another manufacturer-approved path.',
      eyebrow: 'Safe routing',
      title: 'Instrument input only',
    },
    settings: {
      autoGain: 'Auto gain',
      channels: 'Channels',
      echoCancellation: 'Echo cancellation',
      eyebrow: 'Track settings',
      noiseSuppression: 'Noise suppression',
      notReported: 'Not reported',
      off: 'Off',
      on: 'On',
      sampleRate: 'Sample rate',
      title: 'What the browser applied',
    },
    status: {
      connected: {
        label: 'Connected',
        message: 'Audio input is open locally. No audio is uploaded.',
      },
      'device-unavailable': {
        label: 'Input unavailable',
        message: 'Check the interface connection and selected input, then try again.',
      },
      error: {
        label: 'Input error',
        message: 'The audio input could not be opened. Check browser and device settings.',
      },
      idle: {
        label: 'Ready to connect',
        message: 'Choose Start to request local audio permission.',
      },
      'permission-denied': {
        label: 'Permission denied',
        message: 'Allow microphone permission in the browser site settings, then try again.',
      },
      requesting: {
        label: 'Requesting permission',
        message: 'Allow microphone access in the browser prompt to continue.',
      },
      stopped: {
        label: 'Stopped',
        message: 'The audio input is closed. Start again when you are ready.',
      },
      unsupported: {
        label: 'Browser unsupported',
        message: 'Use a recent Chrome, Edge, or Safari on HTTPS or localhost.',
      },
    },
    warnings: {
      'channel-count-exceeded': 'The browser reported more than two input channels.',
      'echo-cancellation-enabled': 'Echo cancellation is enabled by the browser.',
      'echo-cancellation-unknown':
        'The browser did not report whether echo cancellation is disabled.',
      'gain-control-enabled': 'Automatic gain control is enabled by the browser.',
      'gain-control-unknown':
        'The browser did not report whether automatic gain control is disabled.',
      'noise-suppression-enabled': 'Noise suppression is enabled by the browser.',
      'noise-suppression-unknown':
        'The browser did not report whether noise suppression is disabled.',
    },
  },
  ko: {
    analysis: {
      active: '입력 스트림에서 실시간 지표를 브라우저 안에서 계산하고 있습니다.',
      errorDetail: '진단 상세',
      fallback: '호환 모드가 활성화되어 AnalyserNode fallback으로 실시간 지표를 계산하고 있습니다.',
      fallbackReason: 'Fallback 전환 이유',
      unavailable: '이 브라우저에서는 실시간 지표를 사용할 수 없지만 입력 연결은 유지됩니다.',
      starting: '로컬 측정을 시작하는 중…',
    },
    app: {
      language: '언어',
      languageEnglish: 'English',
      languageKorean: '한국어',
      localFirst: '로컬 우선 오디오 진단',
      name: 'ToneCaptureDoctor',
    },
    metrics: {
      checkInputLevel: '입력 레벨 확인',
      clippingCandidate: '클리핑 후보',
      clippingNotice:
        '클리핑 후보가 감지되었습니다. 인터페이스 입력 게인을 낮추고 다시 확인하세요.',
      confidence: '신뢰도',
      confidenceHigh: '높음',
      confidenceLow: '낮음 · 다시 측정하세요',
      confidenceMedium: '중간 · 방향성 근거',
      dominantFrequency: '주요 주파수',
      empty: 'Signal Health를 시작하면 peak, RMS, 주파수, 클리핑 지표를 로컬에서 계산합니다.',
      eyebrow: '실시간 측정',
      humCandidate: '험 후보',
      noiseFloor: '노이즈 플로어',
      notDetected: '감지되지 않음',
      notReady: '충분한 샘플을 기다리는 중',
      peak: 'Peak',
      rms: 'RMS',
      title: '신호 지표',
    },
    snapshots: {
      audioClipInvalid: '이 오디오 클립의 재생 시간을 읽을 수 없습니다. 새 스냅샷을 저장하세요.',
      audioClipNotReady: '아직 저장할 오디오 구간이 없습니다. 입력을 유지한 뒤 다시 저장하세요.',
      audioClipSaved: '짧은 로컬 오디오 클립이 이 스냅샷에 첨부되었습니다.',
      audioClipUnavailable: '이 브라우저에서는 오디오 클립 캡처를 사용할 수 없습니다.',
      delete: '삭제',
      deleteAll: '로컬 데이터 전체 삭제',
      deleteAllConfirm: '이 브라우저의 모든 로컬 스냅샷과 테스트 로그를 삭제할까요?',
      deletedAll: '모든 로컬 스냅샷과 테스트 로그를 삭제했습니다.',
      deleteConfirm: '이 로컬 스냅샷을 삭제할까요?',
      empty: '실시간 테스트 중 스냅샷을 저장하면 나중에 지표를 비교할 수 있습니다.',
      error: '스냅샷을 저장하지 못했습니다. 브라우저 로컬 저장소를 확인하고 다시 시도하세요.',
      exportLog: '테스트 로그 내보내기',
      exportSnapshots: '스냅샷 내보내기',
      exportTonecheck: '.tonecheck 내보내기',
      importSnapshots: '스냅샷 가져오기',
      importTonecheck: '.tonecheck 가져오기',
      imported: '스냅샷을 로컬로 가져왔습니다.',
      invalidImport: '스냅샷 파일을 가져오지 못했습니다.',
      quota:
        '로컬 저장 공간이 가득 찼습니다. 스냅샷을 내보내고 오래된 데이터를 삭제한 뒤 다시 시도하세요.',
      label: '스냅샷 이름',
      notes: '테스트 메모',
      analysisNotReady: '보정된 파형과 스펙트럼 분석이 준비될 때까지 기다려 주세요.',
      pauseClip: '클립 일시정지',
      playClip: '선택 구간 재생',
      clipEnd: '선택 끝',
      clipSelection: '클립 구간 선택',
      clipStart: '선택 시작',
      save: '스냅샷 저장',
      saved: '스냅샷을 로컬에 저장했습니다.',
      title: '테스트 스냅샷',
      tonecheckExported: '.tonecheck 세션 archive를 로컬로 내보냈습니다.',
      tonecheckImported: '.tonecheck 세션 archive를 로컬로 가져왔습니다.',
      tonecheckInvalid: '.tonecheck archive를 가져오지 못했습니다.',
      eyebrow: '로컬 증거',
    },
    visualizer: {
      binWidth: 'Bin 폭',
      channels: '채널',
      dominantFrequency: '주요 주파수',
      fftSize: 'FFT 크기',
      frequencyScale: '주파수 · Hz',
      noSignal: 'Signal Health를 시작하면 로컬 신호를 볼 수 있습니다.',
      nyquist: '나이퀴스트',
      peak: 'Peak',
      rms: 'RMS',
      sampleRate: '샘플레이트',
      spectrum: '스펙트럼 · 로그 주파수 축',
      spectrogram: '스펙트로그램',
      timeScale: '시간 · ms',
      timeWindow: '파형 확대',
      title: '신호 보기',
      waveformScale: '진폭 · dBFS',
      window: '윈도우',
      waveform: '파형',
    },
    connection: {
      audioStatus: '오디오 입력 상태',
      inputUnavailable:
        '선택한 입력을 더 이상 사용할 수 없습니다. 다시 연결하거나 다른 입력을 선택하세요.',
      noLabelledInputs:
        '이름이 있는 오디오 입력을 받지 못했습니다. 브라우저 장치 권한을 확인하세요.',
      startToList: 'Start Signal Health를 눌러 권한을 요청하고 사용 가능한 입력을 확인하세요.',
      switchError: '이전 입력 연결은 유지되고 있습니다. 새 입력을 열지 못했습니다.',
    },
    compare: {
      alignment: '정렬',
      candidate: '비교 스냅샷',
      confidence: '차이 신뢰도',
      confidenceHigh: '높음 · 반복 신호가 안정적임',
      confidenceLow: '낮음 · 클리핑·노이즈 또는 약한 정렬',
      confidenceMedium: '중간 · 방향성을 보여주는 근거',
      delta: '차이',
      empty: '테스트 후 저장한 스냅샷 2개를 선택하면 비교할 수 있습니다.',
      frequencyChanged: '하나 이상의 대역에서 주파수 밸런스가 1.5 dB 이상 변했습니다.',
      frequencyInterpretation:
        '가능한 해석: 입력 체인의 주파수 밸런스가 달라졌습니다. 같은 연주 구간과 라우팅으로 다시 확인하세요.',
      lowConfidenceNotice: '이는 측정 근거이지 톤 판정이 아닙니다. 같은 연주와 레벨로 반복하세요.',
      loudnessNormalized: '파형 비교 전에 비교 스냅샷의 레벨을 보정했습니다.',
      normalization: '음량 보정',
      noMaterialDifference: '현재 비교 기준을 넘는 큰 측정 차이는 없습니다.',
      noiseChanged: '노이즈 플로어가 3 dB 이상 변했습니다.',
      noiseInterpretation:
        '가능한 해석: 노이즈 환경 또는 입력 게인이 달라졌습니다. 같은 무음 구간으로 다시 확인하세요.',
      reference: '기준 스냅샷',
      run: '스냅샷 비교',
      selectBoth: '서로 다른 스냅샷 2개를 먼저 선택하세요.',
      spectrumDelta: '스펙트럼 평균 차이',
      title: 'Tone Compare · 측정 차이',
      waveformDelta: '파형 RMS 차이',
      clippingCandidate: '한 스냅샷에서 클리핑 후보가 발견되었습니다.',
      clippingInterpretation:
        '가능한 해석: 클리핑이 차이를 지배할 수 있습니다. 입력 게인을 낮추고 다시 캡처하세요.',
      band: '대역',
      incompatible: '두 스냅샷의 분석 데이터 형식이 달라 안전하게 비교할 수 없습니다.',
    },
    glossary: {
      causes: '가능한 원인',
      experiments: '안전한 다음 실험',
      eyebrow: '용어 사전',
      measured: '이 앱이 측정하는 것',
      noResults: '검색과 일치하는 용어가 없습니다.',
      notMeasured: '이 앱이 측정하지 않는 것',
      references: '근거',
      search: '용어 검색',
      searchPlaceholder: 'dBFS, 노이즈, latency 검색',
      term: '용어 선택',
      title: '오디오 용어 사전',
      warnings: '안전 메모',
    },
    guidance: {
      causes: '가능한 원인',
      confidence: '규칙 신뢰도',
      confidenceHigh: '높음 · 장치 설정 또는 패턴이 직접 보고됨',
      confidenceLow: '낮음 · 반복 확인이 필요한 후보 신호',
      confidenceMedium: '중간 · 유용한 측정 근거이지 진단은 아님',
      empty: '일치하는 진단 규칙이 없습니다. 더 확인하려면 일정한 신호로 반복하세요.',
      experiments: '안전한 다음 실험',
      eyebrow: '측정 기반 안내',
      neverClaim: '이 규칙으로 단정하지 않는 것',
      observation: '측정 관찰',
      title: '다음에 확인할 것',
    },
    dryWet: {
      active: '두 채널 프레임을 브라우저 안에서 측정하고 있습니다.',
      band: '대역',
      channel: '채널',
      correlation: '상관도',
      crest: '크레스트',
      delta: 'Wet − dry',
      description:
        '같은 인터페이스 프레임의 두 채널을 비교합니다. 지연은 측정값과 추정값을 구분하며 톤 판정은 하지 않습니다.',
      dry: 'Dry',
      dryInput: 'Dry 입력',
      dynamics: '다이내믹',
      droppedQuanta: '누락된 입력 퀀타',
      eyebrow: '두 채널 근거',
      gainDifference: 'RMS 게인 차이',
      input: '입력',
      latency: '지연 후보',
      latencyEstimated: '추정값',
      latencyMeasured: '측정값',
      levelMatchedDelta: '레벨 보정 잔차',
      mode: '채널 상태',
      modeIndeterminate: '신호 부족',
      modeMonoLike: '모노 유사',
      modeNoSignal: '무신호',
      modeStereoDistinct: '스테레오 구분',
      needsTwoChannels:
        '브라우저가 두 개 미만의 입력 채널을 보고했습니다. 2채널 인터페이스를 사용하거나 Signal Health를 계속 사용하세요.',
      peakDifference: 'Peak 차이',
      rms: 'RMS',
      repeatability: '반복 지연',
      repeatabilityHigh: '안정적',
      repeatabilityLow: '불안정',
      repeatabilityMedium: '사용 가능하지만 변동 있음',
      safetyDescription:
        'line/instrument 입력 또는 제조사가 승인한 load box를 사용하세요. 앰프 speaker output을 인터페이스 입력에 직접 연결하지 마세요.',
      safetyTitle: '안전한 라우팅:',
      spectrum: '스펙트럼 차이',
      startRequired: 'Start Signal Health를 눌러 로컬 2채널 측정을 시작하세요.',
      starting: '2채널 측정을 시작하는 중…',
      title: 'Dry/Wet Doctor',
      unavailable:
        '이 브라우저에서는 2채널 측정을 사용할 수 없지만 Signal Health는 계속 사용할 수 있습니다.',
      unavailableMetric: '사용 불가',
      waitingForSpectrum: '보정된 스펙트럼 프레임을 기다리는 중입니다.',
      warningBothNoSignal: '선택한 두 채널 모두 지연 후보를 계산할 만큼 신호가 없습니다.',
      warningChannelSwap:
        '채널 스왑 후보: wet이 dry보다 먼저 나타납니다. 반복 전에 입력 라우팅을 확인하세요.',
      warningDryNoSignal: 'Dry 입력이 무신호 기준보다 낮습니다.',
      warningLatencyLowConfidence: '지연 상관도가 약합니다. 같은 연주 구간으로 반복하세요.',
      warningMonoLike:
        '선택한 채널이 사실상 모노와 같습니다. 두 입력이 같은 소스를 받는지 확인하세요.',
      warningWetNoSignal: 'Wet 입력이 무신호 기준보다 낮습니다.',
      wet: 'Wet',
      wetInput: 'Wet 입력',
    },
    hero: {
      copy: '톤을 비교하기 전에 악기 신호가 인터페이스에 제대로 들어오는지 확인합니다. 첫 버전은 분석을 로컬에서 수행하고 다음에 해볼 실험을 설명합니다.',
      eyebrow: '첫 번째 모드',
      title: 'Signal Health',
    },
    input: {
      chooseDevice: '오디오 입력 선택',
      description:
        '기타 또는 베이스를 instrument/Hi-Z 입력에 연결하세요. Start를 누른 뒤에만 권한을 요청하며 스트림은 이 브라우저 세션에만 유지됩니다.',
      eyebrow: '입력 개요',
      ready: '준비되면 시작하세요',
      requesting: '권한 요청 중…',
      start: 'Signal Health 시작',
      stop: 'Signal Health 중지',
    },
    routing: {
      description:
        '진공관 앰프의 speaker output을 인터페이스 입력에 직접 연결하지 마세요. 마이크, load box, DI 또는 제조사가 승인한 경로를 사용하세요.',
      eyebrow: '안전한 라우팅',
      title: '악기 입력만 사용',
    },
    settings: {
      autoGain: '자동 게인',
      channels: '채널 수',
      echoCancellation: '에코 제거',
      eyebrow: '트랙 설정',
      noiseSuppression: '노이즈 억제',
      notReported: '보고되지 않음',
      off: '꺼짐',
      on: '켜짐',
      sampleRate: '샘플레이트',
      title: '브라우저가 적용한 설정',
    },
    status: {
      connected: {
        label: '연결됨',
        message: '오디오 입력이 로컬에서 열려 있습니다. 오디오는 업로드되지 않습니다.',
      },
      'device-unavailable': {
        label: '입력 없음',
        message: '인터페이스 연결과 선택한 입력을 확인한 뒤 다시 시도하세요.',
      },
      error: {
        label: '입력 오류',
        message: '오디오 입력을 열 수 없습니다. 브라우저와 장치 설정을 확인하세요.',
      },
      idle: {
        label: '연결 준비됨',
        message: 'Start를 눌러 로컬 오디오 권한을 요청하세요.',
      },
      'permission-denied': {
        label: '권한 거부됨',
        message: '브라우저 사이트 설정에서 마이크 권한을 허용한 뒤 다시 시도하세요.',
      },
      requesting: {
        label: '권한 요청 중',
        message: '계속하려면 브라우저 권한 창에서 마이크를 허용하세요.',
      },
      stopped: {
        label: '중지됨',
        message: '오디오 입력을 닫았습니다. 준비되면 다시 시작하세요.',
      },
      unsupported: {
        label: '브라우저 미지원',
        message: 'HTTPS 또는 localhost에서 최신 Chrome, Edge, Safari를 사용하세요.',
      },
    },
    warnings: {
      'channel-count-exceeded': '브라우저가 2개를 초과하는 입력 채널을 보고했습니다.',
      'echo-cancellation-enabled': '브라우저에서 에코 제거가 켜져 있습니다.',
      'echo-cancellation-unknown': '에코 제거가 꺼졌는지 브라우저가 보고하지 않았습니다.',
      'gain-control-enabled': '브라우저에서 자동 게인이 켜져 있습니다.',
      'gain-control-unknown': '자동 게인이 꺼졌는지 브라우저가 보고하지 않았습니다.',
      'noise-suppression-enabled': '브라우저에서 노이즈 억제가 켜져 있습니다.',
      'noise-suppression-unknown': '노이즈 억제가 꺼졌는지 브라우저가 보고하지 않았습니다.',
    },
  },
};

export function getInitialLocale(): Locale {
  if (typeof window !== 'undefined') {
    try {
      const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
      if (storedLocale === 'en' || storedLocale === 'ko') {
        return storedLocale;
      }
    } catch {
      // Ignore storage restrictions and use the browser preference.
    }
  }

  return typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('ko')
    ? 'ko'
    : 'en';
}

export function persistLocale(locale: Locale): void {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // A private browsing context may reject localStorage writes.
  }
}
