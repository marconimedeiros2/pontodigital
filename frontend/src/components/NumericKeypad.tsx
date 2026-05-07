interface NumericKeypadProps {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  onConfirm: () => void;
  disabled: boolean;
  pinLength: number;
  minLength?: number;
  confirmLabel?: string;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'];

export function NumericKeypad({
  onDigit, onBackspace, onConfirm, disabled, pinLength,
  minLength = 4, confirmLabel = 'Registrar Ponto',
}: NumericKeypadProps) {
  const handleKey = (key: string) => {
    if (disabled) return;
    if (key === 'back') onBackspace();
    else if (key === 'clear') { for (let i = 0; i < 6; i++) onBackspace(); }
    else onDigit(key);
  };

  const canConfirm = pinLength >= minLength;

  return (
    <div className="keypad">
      <div className="keypad-grid">
        {KEYS.map((key) => {
          const isClear = key === 'clear';
          const isBack = key === 'back';
          const isSpecial = isClear || isBack;

          return (
            <button
              key={key}
              className={`keypad-btn ${isSpecial ? 'keypad-btn--special' : ''} ${isClear ? 'keypad-btn--clear' : ''}`}
              onClick={() => handleKey(key)}
              disabled={disabled}
              aria-label={isClear ? 'Limpar' : isBack ? 'Apagar' : key}
            >
              {isBack ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12H7m0 0l5-5m-5 5l5 5" />
                  <path d="M3 12h1" />
                </svg>
              ) : isClear ? (
                <span style={{ fontSize: '0.72em', fontWeight: 700, color: '#000' }}>Limpar</span>
              ) : (
                key
              )}
            </button>
          );
        })}
      </div>

      <button
        className="confirm-btn"
        onClick={onConfirm}
        disabled={disabled || !canConfirm}
      >
        {disabled ? (
          <span className="spinner" />
        ) : (
          <>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {confirmLabel}
          </>
        )}
      </button>
    </div>
  );
}
