type AnswerResult = "correct" | "incorrect";

type LastAnswer = Readonly<{
  midiNumbers: ReadonlySet<number>;
  result: AnswerResult;
}>;

type PianoKeyboardProps = Readonly<{
  activeMidiNumbers: ReadonlySet<number>;
  failedMidiNumbers: ReadonlySet<number>;
  lastAnswer: LastAnswer | null;
  targetMidiNumbers: ReadonlySet<number>;
  onNoteToggle: (midiNumber: number) => void;
  minMidi?: number;
  maxMidi?: number;
}>;

type PianoKey = Readonly<{
  isBlack: boolean;
  midiNumber: number;
  name: string;
  whiteKeyIndex: number;
}>;

const NOTE_NAMES = [
  "C",
  "C♯",
  "D",
  "D♯",
  "E",
  "F",
  "F♯",
  "G",
  "G♯",
  "A",
  "A♯",
  "B",
] as const;

function createKeys(minMidi: number, maxMidi: number): PianoKey[] {
  let whiteKeyCount = 0;

  return Array.from(
    {
      length: maxMidi - minMidi + 1,
    },
    (_, index): PianoKey => {
      const midiNumber = minMidi + index;

      const name = NOTE_NAMES[midiNumber % 12] ?? "";

      const isBlack = name.includes("♯");

      const whiteKeyIndex = whiteKeyCount;

      if (!isBlack) {
        whiteKeyCount += 1;
      }

      return {
        isBlack,
        midiNumber,
        name,
        whiteKeyIndex,
      };
    },
  );
}

function getKeyBackgroundColor({
  isActive,
  isBlack,
  isFailed,
  isTargetNote,
  result,
}: Readonly<{
  isActive: boolean;
  isBlack: boolean;
  isFailed: boolean;
  isTargetNote: boolean;
  result: AnswerResult | undefined;
}>): string {
  if (result === "correct") {
    return isBlack ? "#16a34a" : "#4ade80";
  }

  if (result === "incorrect") {
    return isBlack ? "#dc2626" : "#f87171";
  }

  if (isActive && isTargetNote) {
    return isBlack ? "#0284c7" : "#7dd3fc";
  }

  if (isActive && !isTargetNote) {
    return isBlack ? "#991b1b" : "#dc2626";
  }

  if (isFailed && isTargetNote) {
    return isBlack ? "rgb(2 132 199 / 50%)" : "rgb(125 211 252 / 50%)";
  }

  if (isFailed && !isTargetNote) {
    return isBlack ? "rgb(153 27 27 / 50%)" : "rgb(220 38 38 / 50%)";
  }

  return isBlack ? "#09090b" : "#ffffff";
}

export default function PianoKeyboard({
  activeMidiNumbers,
  failedMidiNumbers,
  lastAnswer,
  targetMidiNumbers,
  onNoteToggle,
  minMidi = 36,
  maxMidi = 83,
}: PianoKeyboardProps) {
  const keys = createKeys(minMidi, maxMidi);

  const whiteKeyCount = keys.filter((key) => !key.isBlack).length;

  const whiteKeyWidthPercent = 100 / whiteKeyCount;

  return (
    <div className="h-full max-h-80 min-h-40 rounded-2xl border border-zinc-300 bg-zinc-200 p-2 sm:min-h-52 sm:p-3">
      <div className="relative mx-auto h-full min-h-36 w-full overflow-hidden rounded-lg border border-zinc-500 bg-white">
        {keys.map((key) => {
          const isActive = activeMidiNumbers.has(key.midiNumber);

          const isFailed = failedMidiNumbers.has(key.midiNumber);

          const isTargetNote = targetMidiNumbers.has(key.midiNumber);

          const result = lastAnswer?.midiNumbers.has(key.midiNumber)
            ? lastAnswer.result
            : undefined;

          const backgroundColor = getKeyBackgroundColor({
            isActive,
            isBlack: key.isBlack,
            isFailed,
            isTargetNote,
            result,
          });

          if (!key.isBlack) {
            return (
              <button
                key={key.midiNumber}
                aria-label={`${key.name}, MIDI ${key.midiNumber}`}
                aria-pressed={isActive}
                className="touch-manipulation absolute bottom-0 top-0 select-none border-r border-zinc-400 transition-colors"
                onClick={() => {
                  onNoteToggle(key.midiNumber);
                }}
                style={{
                  backgroundColor,
                  left: `${key.whiteKeyIndex * whiteKeyWidthPercent}%`,
                  width: `${whiteKeyWidthPercent}%`,
                }}
                title={`${key.name} · MIDI ${key.midiNumber}`}
                type="button"
              />
            );
          }

          const blackKeyLeft =
            key.whiteKeyIndex * whiteKeyWidthPercent -
            whiteKeyWidthPercent * 0.32;

          return (
            <button
              key={key.midiNumber}
              aria-label={`${key.name}, MIDI ${key.midiNumber}`}
              aria-pressed={isActive}
              className="touch-manipulation absolute top-0 z-10 h-[62%] select-none rounded-b-sm transition-colors"
              onClick={() => {
                onNoteToggle(key.midiNumber);
              }}
              style={{
                backgroundColor,
                left: `${blackKeyLeft}%`,
                width: `${whiteKeyWidthPercent * 0.64}%`,
              }}
              title={`${key.name} · MIDI ${key.midiNumber}`}
              type="button"
            />
          );
        })}
      </div>
    </div>
  );
}
