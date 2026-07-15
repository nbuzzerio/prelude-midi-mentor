type MidiStatusProps = Readonly<{
  connected: boolean;
}>;

export default function MidiStatus({ connected }: MidiStatusProps) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${
        connected ? "bg-green-100 text-green-800" : "bg-zinc-100 text-zinc-700"
      }`}
    >
      <span
        className={`h-2.5 w-2.5 rounded-full ${
          connected ? "bg-green-500" : "bg-zinc-400"
        }`}
      />
      {connected ? "MIDI connected" : "MIDI disconnected"}
    </div>
  );
}
