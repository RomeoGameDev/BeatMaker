import type { Sample } from "@/types";

type Props = { samples: Sample[]; onPreview: (sample: Sample) => void; onAssign: (sample: Sample) => void };

export default function SampleLibrary({ samples, onPreview, onAssign }: Props) {
  return (
    <section className="panel sample-library">
      <h2>Sample Library</h2>
      <div className="sample-list">
        {samples.map((sample) => (
          <article className="sample-row" key={sample.id}>
            <div><strong>{sample.name}</strong><small>{sample.category} · {sample.path}</small></div>
            <button onClick={() => onPreview(sample)}>Preview</button>
            <button onClick={() => onAssign(sample)}>Assign</button>
          </article>
        ))}
      </div>
    </section>
  );
}
