import { useState } from "react";
import { MUSIC_KEYS, type MusicKeyId } from "@/lib/music/keys";
import { STAFF_BUILDER_TIME_SIGNATURES, type StaffBuilderTimeSignature } from "../staff-builder-time";

export function StaffBuilderPieceSetup({ onCreate }: Readonly<{
  onCreate: (input: Readonly<{ title: string; keyId: MusicKeyId; timeSignature: StaffBuilderTimeSignature; tempoBpm: number }>) => void;
}>) {
  const [title, setTitle] = useState("");
  const [keyId, setKeyId] = useState<MusicKeyId>("c-major");
  const [timeSignature, setTimeSignature] = useState<StaffBuilderTimeSignature>("4/4");
  const [tempo, setTempo] = useState("100");
  const [error, setError] = useState("");
  return (
    <form className="staff-builder-panel staff-builder-setup" onSubmit={(event) => {
      event.preventDefault();
      const tempoBpm = Number(tempo);
      if (!title.trim()) { setError("Enter a title before creating the piece."); return; }
      if (!Number.isInteger(tempoBpm) || tempoBpm < 40 || tempoBpm > 240) { setError("Tempo must be a whole number from 40 through 240 BPM."); return; }
      setError("");
      onCreate({ title, keyId, timeSignature, tempoBpm });
    }}>
      <h2 className="text-lg font-semibold">Create a piece</h2>
      <label>Title<input aria-describedby={error ? "staff-builder-setup-error" : undefined} className="staff-builder-input" onChange={(event) => setTitle(event.target.value)} value={title} /></label>
      <label>Initial key<select className="staff-builder-input" onChange={(event) => setKeyId(event.target.value as MusicKeyId)} value={keyId}>{MUSIC_KEYS.map((key) => <option key={key.id} value={key.id}>{key.name}</option>)}</select></label>
      <label>Time signature<select className="staff-builder-input" onChange={(event) => setTimeSignature(event.target.value as StaffBuilderTimeSignature)} value={timeSignature}>{STAFF_BUILDER_TIME_SIGNATURES.map((signature) => <option key={signature}>{signature}</option>)}</select></label>
      <label>Tempo (BPM)<input className="staff-builder-input" inputMode="numeric" max="240" min="40" onChange={(event) => setTempo(event.target.value)} step="1" type="number" value={tempo} /></label>
      {error && <p className="text-red-300" id="staff-builder-setup-error" role="alert">{error}</p>}
      <button className="rounded bg-sky-500 px-4 py-2 font-semibold text-white" type="submit">Create Piece</button>
    </form>
  );
}
