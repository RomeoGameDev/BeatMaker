import type { Skin } from "@/types";

type Props = { skins: Skin[]; selectedSkinId: string; onChange: (skinId: string) => void };

export default function SkinSelector({ skins, selectedSkinId, onChange }: Props) {
  return (
    <label className="field-label">
      Skin
      <select value={selectedSkinId} onChange={(event) => onChange(event.target.value)}>
        {skins.map((skin) => (
          <option key={skin.id} value={skin.id}>{skin.name}</option>
        ))}
      </select>
    </label>
  );
}
