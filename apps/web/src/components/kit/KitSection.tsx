import type { ReactNode } from "react";

/**
 * Обёртки витрины /kit. Живут отдельно от `components/ui`, потому что это не
 * элементы продукта, а леса вокруг них: на экранах приложения им делать
 * нечего.
 */
export function KitSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-5">
      <h2 className="text-[22px] font-bold leading-[30px] tracking-[-0.2px] text-ink">{title}</h2>
      {children}
    </section>
  );
}

export function KitGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-[12px] font-medium uppercase leading-4 tracking-[0.3px] text-ink-tertiary">
        {title}
      </h3>
      {children}
    </div>
  );
}
