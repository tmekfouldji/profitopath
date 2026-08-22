const sessions = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const;

export function WeekTape({ activeSession = 0 }: { activeSession?: number }) {
  return (
    <div aria-label="Five-session competition week" className="week-tape">
      <div aria-hidden="true" className="tape-rail" />
      {sessions.map((session, index) => (
        <div
          className={`tape-session ${index === activeSession ? 'is-active' : ''}`}
          key={session}
        >
          <span className="tape-index">S{index + 1}</span>
          <strong>{session}</strong>
          <span>
            {index === 4
              ? 'Freeze'
              : index === activeSession
                ? 'Current'
                : 'Session'}
          </span>
        </div>
      ))}
    </div>
  );
}
