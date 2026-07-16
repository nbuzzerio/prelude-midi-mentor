type AnswerResult = "correct" | "incorrect";

type LastAnswer = Readonly<{
  midiNumber: number;
  result: AnswerResult;
}>;

type PianoKeyboardProps = Readonly<{
  lastAnswer: LastAnswer | null;
  onNotePlayed: (midiNumber: number) => void;
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

  return Array.from({ length: maxMidi - minMidi + 1 }, (_, index): PianoKey => {
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
  });
}

function getWhiteKeyClass(result: AnswerResult | undefined): string {
  if (result === "correct") {
    return "bg-green-400";
  }

  if (result === "incorrect") {
    return "bg-red-400";
  }

  return "bg-white";
}

function getBlackKeyClass(result: AnswerResult | undefined): string {
  if (result === "correct") {
    return "bg-green-600";
  }

  if (result === "incorrect") {
    return "bg-red-600";
  }

  return "bg-zinc-950";
}

export default function PianoKeyboard({
  lastAnswer,
  onNotePlayed,
  minMidi = 36,
  maxMidi = 83,
}: PianoKeyboardProps) {
  const keys = createKeys(minMidi, maxMidi);
  const whiteKeyCount = keys.filter((key) => !key.isBlack).length;
  const whiteKeyWidthPercent = 100 / whiteKeyCount;

  return (
    <div className="h-full min-h-40 rounded-2xl border border-zinc-300 bg-zinc-200 p-2 sm:min-h-52 sm:p-3">
      <div className="relative mx-auto h-full min-h-36 w-full overflow-hidden rounded-lg border border-zinc-500 bg-white">
        {keys.map((key) => {
          const result =
            lastAnswer?.midiNumber === key.midiNumber
              ? lastAnswer.result
              : undefined;

          if (!key.isBlack) {
            return (
              <button
                type="button"
                onClick={() => onNotePlayed(key.midiNumber)}
                key={key.midiNumber}
                className={`absolute bottom-0 top-0 border-r border-zinc-400 transition-colors touch-manipulation select-none hover:bg-zinc-200 ${getWhiteKeyClass(
                  result,
                )}`}
                style={{
                  left: `${key.whiteKeyIndex * whiteKeyWidthPercent}%`,
                  width: `${whiteKeyWidthPercent}%`,
                }}
                title={`${key.name} · MIDI ${key.midiNumber}`}
              />
            );
          }

          const blackKeyLeft =
            key.whiteKeyIndex * whiteKeyWidthPercent -
            whiteKeyWidthPercent * 0.32;

          return (
            <button
              type="button"
              onClick={() => onNotePlayed(key.midiNumber)}
              key={key.midiNumber}
              className={`absolute top-0 z-10 h-[62%] rounded-b-sm transition-colors touch-manipulation select-none hover:bg-zinc-800 ${getBlackKeyClass(
                result,
              )}`}
              style={{
                left: `${blackKeyLeft}%`,
                width: `${whiteKeyWidthPercent * 0.64}%`,
              }}
              title={`${key.name} · MIDI ${key.midiNumber}`}
            />
          );
        })}
      </div>
    </div>
  );
}
