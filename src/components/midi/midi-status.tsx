type MidiConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "unsupported"
  | "error";

type MidiStatusProps = Readonly<{
  deviceName: string | null;
  error: string | null;
  onConnect: () => void;
  status: MidiConnectionStatus;
}>;

export default function MidiStatus({
  deviceName,
  error,
  onConnect,
  status,
}: MidiStatusProps) {
  const connected = status === "connected";
  const connecting = status === "connecting";

  const label = (() => {
    if (connecting) {
      return "Connecting MIDI…";
    }

    if (connected) {
      return deviceName ?? "MIDI connected";
    }

    if (status === "unsupported") {
      return "MIDI unsupported";
    }

    if (status === "error") {
      return "MIDI connection failed";
    }

    return "Connect MIDI";
  })();

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium transition disabled:cursor-wait disabled:opacity-70 ${
          connected
            ? "bg-green-100 text-green-800"
            : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
        }`}
        disabled={connecting}
        onClick={onConnect}
        type="button"
      >
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            connected ? "bg-green-500" : "bg-zinc-400"
          }`}
        />

        {label}
      </button>

      {error ? (
        <p className="max-w-72 text-right text-xs text-red-300">{error}</p>
      ) : null}
    </div>
  );
}
