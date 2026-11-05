import { Search } from "lucide-react";

export function VerifyForm({ invalid = false, defaultValue = "" }: { invalid?: boolean; defaultValue?: string }) {
  return (
    <form action="/certificado" method="get" className="grid gap-3">
      <label htmlFor="codigo" className="text-[13px] font-medium text-ink">
        Código de validação
      </label>
      <input
        id="codigo"
        name="codigo"
        required
        defaultValue={defaultValue}
        autoComplete="off"
        spellCheck={false}
        placeholder="XXXX-XXXX-XXXX"
        className="w-full rounded-xl border border-line bg-white/90 px-3.5 py-2.5 font-mono text-[15px] uppercase tracking-[0.12em] text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-white/60"
      />
      {invalid && <p className="text-[12.5px] text-muted">O código tem 12 letras e números (0-9, A-F). Confira e tente de novo.</p>}
      <button type="submit" className="flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[14px] font-semibold text-slate-900 shadow-sm hover:brightness-95">
        <Search size={16} aria-hidden /> Validar
      </button>
    </form>
  );
}
