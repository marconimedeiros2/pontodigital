const MAX_DOTS = 6;

interface PinDisplayProps {
  filled: number;
  shake: boolean;
}

export function PinDisplay({ filled, shake }: PinDisplayProps) {
  return (
    <div className={`pin-display ${shake ? 'shake' : ''}`}>
      <div className="pin-dots">
        {Array.from({ length: MAX_DOTS }).map((_, i) => (
          <div key={i} className={`pin-dot ${i < filled ? 'filled' : ''}`} />
        ))}
      </div>
      {filled === 0 && (
        <span className="pin-placeholder">Digite seu PIN (4-6 dígitos)</span>
      )}
    </div>
  );
}
