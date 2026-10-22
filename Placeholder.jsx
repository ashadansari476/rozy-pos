import { Construction } from "lucide-react";

export default function Placeholder({ title, note }) {
  return (
    <div className="h-full p-4 lg:p-6 flex items-center justify-center">
      <div className="card p-10 text-center max-w-md">
        <Construction size={48} className="mx-auto text-warning mb-4" />
        <h2 className="font-serif text-2xl text-primary font-semibold mb-2">
          {title}
        </h2>
        <p className="text-ink-muted text-sm">{note}</p>
      </div>
    </div>
  );
}