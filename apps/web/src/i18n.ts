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
    dominantFrequency: string;
    empty: string;
    eyebrow: string;
    humCandidate: string;
    noiseFloor: string;
    notDetected: string;
    peak: string;
    rms: string;
    title: string;
  };
  connection: {
    audioStatus: string;
    inputUnavailable: string;
    noLabelledInputs: string;
    startToList: string;
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
      dominantFrequency: 'Dominant frequency',
      empty: 'Start Signal Health to calculate local peak, RMS, frequency, and clipping metrics.',
      eyebrow: 'Phase 4',
      humCandidate: 'Hum candidate',
      noiseFloor: 'Noise floor',
      notDetected: 'Not detected',
      peak: 'Peak',
      rms: 'RMS',
      title: 'Signal metrics',
    },
    connection: {
      audioStatus: 'Audio input status',
      inputUnavailable:
        'The selected input is no longer available. Connect it again or choose another input.',
      noLabelledInputs:
        'No labelled audio inputs were returned. Check the browser device permission.',
      startToList: 'Start Signal Health to request permission and list available inputs.',
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
      dominantFrequency: '주요 주파수',
      empty: 'Signal Health를 시작하면 peak, RMS, 주파수, 클리핑 지표를 로컬에서 계산합니다.',
      eyebrow: 'Phase 4',
      humCandidate: '험 후보',
      noiseFloor: '노이즈 플로어',
      notDetected: '감지되지 않음',
      peak: 'Peak',
      rms: 'RMS',
      title: '신호 지표',
    },
    connection: {
      audioStatus: '오디오 입력 상태',
      inputUnavailable:
        '선택한 입력을 더 이상 사용할 수 없습니다. 다시 연결하거나 다른 입력을 선택하세요.',
      noLabelledInputs:
        '이름이 있는 오디오 입력을 받지 못했습니다. 브라우저 장치 권한을 확인하세요.',
      startToList: 'Start Signal Health를 눌러 권한을 요청하고 사용 가능한 입력을 확인하세요.',
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
