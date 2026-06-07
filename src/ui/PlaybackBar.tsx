export function PlaybackBar({
  cycle,
  subIndex,
  playing,
  speed,
  totalCycles,
  onPlay,
  onPause,
  onStepBack,
  onStepForward,
  onSeekCycle,
  onSpeed,
  positionLabel,
}: {
  cycle: number;
  subIndex: number;
  playing: boolean;
  speed: number;
  totalCycles: number;
  onPlay: () => void;
  onPause: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
  onSeekCycle: (c: number) => void;
  onSpeed: (s: number) => void;
  positionLabel: string;
}) {
  return (
    <div className="playback-bar">
      <button aria-label="前へ" onClick={onStepBack}>
        ⏮
      </button>
      {playing ? (
        <button aria-label="一時停止" onClick={onPause}>
          ⏸
        </button>
      ) : (
        <button aria-label="再生" onClick={onPlay}>
          ▶
        </button>
      )}
      <button aria-label="次へ" onClick={onStepForward}>
        ⏭
      </button>
      <input
        aria-label="タイムライン"
        type="range"
        min={1}
        max={Math.max(1, totalCycles)}
        value={cycle}
        onChange={(e) => onSeekCycle(Number(e.target.value))}
      />
      <label>
        速度
        <input
          aria-label="速度"
          type="range"
          min={1}
          max={20}
          value={speed}
          onChange={(e) => onSpeed(Number(e.target.value))}
        />
      </label>
      <span className="position">{positionLabel}</span>
      <span className="hidden-sub">{subIndex}</span>
    </div>
  );
}
