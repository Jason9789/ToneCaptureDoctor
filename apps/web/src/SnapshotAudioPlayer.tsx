import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface SnapshotAudioPlayerProps {
  audioClip: Blob;
  clipEndLabel: string;
  clipStartLabel: string;
  invalidClipLabel: string;
  pauseLabel: string;
  playLabel: string;
  selectionLabel: string;
}

export function SnapshotAudioPlayer({
  audioClip,
  clipEndLabel,
  clipStartLabel,
  invalidClipLabel,
  pauseLabel,
  playLabel,
  selectionLabel,
}: SnapshotAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sourceUrl = useMemo(() => URL.createObjectURL(audioClip), [audioClip]);
  const [duration, setDuration] = useState(0);
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasInvalidDuration, setHasInvalidDuration] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      audio?.pause();
      URL.revokeObjectURL(sourceUrl);
    };
  }, [sourceUrl]);

  const handleMetadata = useCallback(() => {
    const nextDuration = audioRef.current?.duration;
    if (!nextDuration || !Number.isFinite(nextDuration) || nextDuration <= 0) {
      setHasInvalidDuration(true);
      return;
    }
    setHasInvalidDuration(false);
    setDuration(nextDuration);
    setSelectionStart((current) => Math.min(current, nextDuration));
    setSelectionEnd((current) => (current <= 0 ? nextDuration : Math.min(current, nextDuration)));
  }, []);

  const handlePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    const end = selectionEnd > selectionStart ? selectionEnd : duration;
    audio.currentTime = Math.min(selectionStart, Math.max(0, end - 0.01));
    void audio.play().catch(() => setIsPlaying(false));
  }, [duration, selectionEnd, selectionStart]);

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    const end = selectionEnd > selectionStart ? selectionEnd : duration;
    if (audio && end > 0 && audio.currentTime >= end) {
      audio.pause();
      audio.currentTime = selectionStart;
    }
  }, [duration, selectionEnd, selectionStart]);

  return (
    <div className="snapshot-audio-player">
      <audio
        ref={audioRef}
        controls
        preload="metadata"
        src={sourceUrl}
        onLoadedMetadata={handleMetadata}
        onError={() => setHasInvalidDuration(true)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onTimeUpdate={handleTimeUpdate}
      />
      {hasInvalidDuration && <p role="alert">{invalidClipLabel}</p>}
      <div className="clip-selection-heading">
        <strong>{selectionLabel}</strong>
        <button
          className="text-button"
          type="button"
          onClick={isPlaying ? () => audioRef.current?.pause() : handlePlay}
        >
          {isPlaying ? pauseLabel : playLabel}
        </button>
      </div>
      <label className="clip-range" htmlFor={`clip-start-${sourceUrl}`}>
        <span>{clipStartLabel}</span>
        <input
          id={`clip-start-${sourceUrl}`}
          max={duration}
          min={0}
          step={0.01}
          type="range"
          value={selectionStart}
          onChange={(event) =>
            setSelectionStart(
              Math.min(Number(event.target.value), Math.max(0, selectionEnd - 0.01)),
            )
          }
        />
        <output>{selectionStart.toFixed(2)}s</output>
      </label>
      <label className="clip-range" htmlFor={`clip-end-${sourceUrl}`}>
        <span>{clipEndLabel}</span>
        <input
          id={`clip-end-${sourceUrl}`}
          max={duration}
          min={0}
          step={0.01}
          type="range"
          value={selectionEnd || duration}
          onChange={(event) =>
            setSelectionEnd(Math.max(Number(event.target.value), selectionStart + 0.01))
          }
        />
        <output>{(selectionEnd || duration).toFixed(2)}s</output>
      </label>
    </div>
  );
}
