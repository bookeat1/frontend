"use client";

import { useState } from "react";
import { webLayout, webPalette, webRadius, webTypography } from "@bookeat/design-tokens";

import { Container } from "@web/components/layout/Container";
import { SiteFooter } from "@web/components/layout/SiteFooter";
import { SiteHeader } from "@web/components/layout/SiteHeader";
import { KitGroup, KitSection } from "@web/components/kit/KitSection";
import { Badge } from "@web/components/ui/Badge";
import { Button } from "@web/components/ui/Button";
import { Chip, type ChipState } from "@web/components/ui/Chip";
import { Modal } from "@web/components/ui/Modal";
import { TextField } from "@web/components/ui/TextField";
import { TimeSlot } from "@web/components/ui/TimeSlot";
import { VenueCard } from "@web/components/ui/VenueCard";
import { t } from "@web/lib/i18n";

/**
 * Витрина собранных компонентов — страница для сверки с макетом
 * (Figma 3z0f6dgev4HMwBAHPjTjPo, узел 3273:2), а не экран продукта.
 *
 * Порядок блоков и подписи повторяют кит один в один, чтобы сверять можно
 * было построчно. Всё, что здесь показано, взято из `components/ui` — витрина
 * ничего не рисует «сама», иначе она перестала бы что-либо доказывать.
 */

/** Образцы цвета. Подписи — имена токенов, они не переводятся. */
const SWATCHES: ReadonlyArray<{ role: string; token: string; value: string }> = [
  { role: "background/canvas", token: "neutral/0", value: webPalette.neutral0 },
  { role: "background/subtle", token: "neutral/50", value: webPalette.neutral50 },
  { role: "background/muted", token: "neutral/100", value: webPalette.neutral100 },
  { role: "border/default", token: "neutral/200", value: webPalette.neutral200 },
  { role: "border/strong", token: "neutral/300", value: webPalette.neutral300 },
  { role: "border/control", token: "neutral/400", value: webPalette.neutral400 },
  { role: "text/tertiary", token: "neutral/500", value: webPalette.neutral500 },
  { role: "text/secondary", token: "neutral/600", value: webPalette.neutral600 },
  { role: "text/primary", token: "neutral/900", value: webPalette.neutral900 },
  { role: "background/brand", token: "brand/500", value: webPalette.brand500 },
  { role: "text/brand", token: "brand/600", value: webPalette.brand600 },
  { role: "background/brandSubtle", token: "brand/50", value: webPalette.brand50 },
  { role: "background/success", token: "success/50", value: webPalette.success50 },
  { role: "text/success", token: "success/700", value: webPalette.success700 },
  { role: "background/warning", token: "warning/50", value: webPalette.warning50 },
  { role: "text/warning", token: "warning/700", value: webPalette.warning700 },
  { role: "background/danger", token: "danger/50", value: webPalette.danger50 },
  { role: "text/danger", token: "danger/500", value: webPalette.danger500 },
  { role: "text/dangerStrong", token: "danger/700", value: webPalette.danger700 },
];

const RADII: ReadonlyArray<{ name: string; value: number; use: string; className: string }> = [
  { name: "sm", value: webRadius.sm, use: t.web.kit.radii.smUse, className: "rounded-sm" },
  { name: "md", value: webRadius.md, use: t.web.kit.radii.mdUse, className: "rounded-md" },
  { name: "lg", value: webRadius.lg, use: t.web.kit.radii.lgUse, className: "rounded-lg" },
  { name: "xl", value: webRadius.xl, use: t.web.kit.radii.xlUse, className: "rounded-xl" },
  { name: "2xl", value: webRadius.xxl, use: t.web.kit.radii.xxlUse, className: "rounded-2xl" },
  { name: "full", value: webRadius.full, use: t.web.kit.radii.fullUse, className: "rounded-full" },
];

const CHIP_STATES: ReadonlyArray<{ state: ChipState; label: string }> = [
  { state: "selected", label: t.web.kit.samples.chipAll },
  { state: "active", label: t.web.kit.samples.chipTerrace },
  { state: "default", label: t.web.kit.samples.chipBreakfast },
];

export default function KitPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>("19:30");
  const [favorite, setFavorite] = useState(false);
  const [phone, setPhone] = useState("");

  return (
    <>
      <SiteHeader activeKey="home" city={t.web.kit.samples.city} />

      <main className="bg-canvas py-12">
        <Container className="flex flex-col gap-14">
          <header className="flex flex-col gap-3">
            <h1 className="text-[36px] font-bold leading-[44px] tracking-[-0.6px] text-ink">
              {t.web.kit.title}
            </h1>
            <p className="max-w-[900px] text-bodyM text-ink-secondary">{t.web.kit.subtitle}</p>
          </header>

          <KitSection title={t.web.kit.sections.colors}>
            <ul className="grid grid-cols-2 gap-gutter md:grid-cols-3 lg:grid-cols-5">
              {SWATCHES.map((swatch) => (
                <li key={swatch.role} className="flex flex-col gap-2.5">
                  <span
                    className="h-[72px] w-full rounded-[14px] border border-line-strong"
                    style={{ backgroundColor: swatch.value }}
                  />
                  <span className="flex flex-col gap-0.5">
                    <span className="break-words text-[13px] font-semibold leading-[18px] text-ink">
                      {swatch.role}
                    </span>
                    <span className="text-[12px] leading-4 text-ink-tertiary">
                      {swatch.token} · {swatch.value}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </KitSection>

          <KitSection title={t.web.kit.sections.typography}>
            <ul className="flex flex-col">
              {(
                [
                  ["display", t.web.kit.typography.display],
                  ["h1", t.web.kit.typography.h1],
                  ["h2", t.web.kit.typography.h2],
                  ["h3", t.web.kit.typography.h3],
                  ["titleL", t.web.kit.typography.titleL],
                  ["bodyL", t.web.kit.typography.bodyL],
                  ["bodyM", t.web.kit.typography.bodyM],
                  ["bodyS", t.web.kit.typography.bodyS],
                ] as ReadonlyArray<[keyof typeof webTypography, string]>
              ).map(([name, sample]) => {
                const style = webTypography[name];
                return (
                  <li
                    key={name}
                    className="flex flex-wrap items-center gap-6 border-b border-line py-2 last:border-b-0"
                  >
                    <span className="w-[140px] shrink-0 text-[13px] font-semibold leading-[18px] text-ink-tertiary">
                      {name}
                    </span>
                    <span
                      className="min-w-0 flex-1 break-words text-ink"
                      style={{
                        fontSize: style.fontSize,
                        lineHeight: `${style.lineHeight}px`,
                        fontWeight: style.fontWeight,
                      }}
                    >
                      {sample}
                    </span>
                    <span className="w-[150px] shrink-0 text-right text-[13px] leading-[18px] text-ink-tertiary">
                      {t.web.kit.typography.spec(
                        style.fontSize,
                        style.lineHeight,
                        style.fontWeight === 700 ? t.web.kit.typography.bold : t.web.kit.typography.regular,
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </KitSection>

          <KitSection title={t.web.kit.sections.grid}>
            <div className="flex flex-col gap-3">
              <div className="flex gap-gutter">
                {Array.from({ length: webLayout.columns }, (_, index) => (
                  <span key={index} className="h-[120px] flex-1 rounded-md bg-brand-subtle" />
                ))}
              </div>
              <dl className="flex flex-wrap gap-8">
                {[
                  [t.web.kit.grid.container, t.web.kit.grid.pixels(webLayout.containerWidth)],
                  [t.web.kit.grid.pageGutter, t.web.kit.grid.pixels(webLayout.pageGutter)],
                  [
                    t.web.kit.grid.columns,
                    t.web.kit.grid.columnsValue(webLayout.columns, webLayout.columnWidth),
                  ],
                  [t.web.kit.grid.gutter, t.web.kit.grid.pixels(webLayout.gutter)],
                  [t.web.kit.grid.breakpoints, t.web.kit.grid.breakpointsValue([...webLayout.breakpoints])],
                ].map(([label, value]) => (
                  <div key={label} className="flex flex-col gap-0.5">
                    <dt className="text-[12px] font-medium leading-4 tracking-[0.2px] text-ink-tertiary">
                      {label}
                    </dt>
                    <dd className="text-[16px] font-semibold leading-6 text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </KitSection>

          <KitSection title={t.web.kit.sections.elements}>
            <div className="flex flex-col gap-6">
              <KitGroup title={t.web.kit.sections.buttons}>
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="l">{t.web.kit.samples.bookAction}</Button>
                  <Button size="l" variant="secondary">
                    {t.web.kit.samples.menuAction}
                  </Button>
                  <Button size="m">{t.web.kit.samples.searchAction}</Button>
                  <Button size="m" variant="secondary">
                    {t.web.kit.samples.filtersAction}
                  </Button>
                  <Button size="m" variant="danger">
                    {t.web.kit.samples.cancelAction}
                  </Button>
                  <Button size="m" disabled>
                    {t.web.kit.samples.confirmAction}
                  </Button>
                  <Button size="m" loading>
                    {t.web.kit.samples.confirmAction}
                  </Button>
                </div>
              </KitGroup>

              <KitGroup title={t.web.kit.sections.chipsSlots}>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    {CHIP_STATES.map((chip) => (
                      <Chip key={chip.label} state={chip.state}>
                        {chip.label}
                      </Chip>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    {["18:00", "19:30"].map((time) => (
                      <TimeSlot
                        key={time}
                        time={time}
                        selected={selectedSlot === time}
                        onSelect={setSelectedSlot}
                      />
                    ))}
                    <TimeSlot time="17:30" disabled />
                  </div>
                </div>
              </KitGroup>

              <KitGroup title={t.web.kit.sections.fieldsStatuses}>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-start gap-4">
                    <TextField
                      label={t.web.kit.samples.addressLabel}
                      defaultValue={t.web.kit.samples.addressValue}
                      className="max-w-[240px]"
                    />
                    <TextField
                      label={t.web.kit.samples.nameLabel}
                      defaultValue={t.web.kit.samples.nameValue}
                      className="max-w-[240px]"
                    />
                    <TextField
                      label={t.web.kit.samples.phoneLabel}
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      error={phone.trim() === "" ? t.web.kit.samples.phoneError : undefined}
                      className="max-w-[240px]"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Badge tone="success">{t.web.kit.samples.badgeConfirmed}</Badge>
                    <Badge tone="warning">{t.web.kit.samples.badgePending}</Badge>
                    <Badge tone="danger">{t.web.kit.samples.badgeCancelled}</Badge>
                    <Badge tone="neutral">{t.web.kit.samples.badgeCompleted}</Badge>
                    <Badge tone="brand">{t.web.kit.samples.badgeDiscount}</Badge>
                  </div>
                </div>
              </KitGroup>

              <KitGroup title={t.web.kit.sections.radii}>
                <ul className="flex flex-wrap gap-4">
                  {RADII.map((radius) => (
                    <li key={radius.name} className="flex w-[200px] flex-col gap-2">
                      <span
                        className={`h-[72px] w-[180px] border border-line-control bg-subtle ${radius.className}`}
                      />
                      <span className="text-[13px] font-semibold leading-[18px] text-ink">
                        {radius.name} · {radius.value}
                      </span>
                      <span className="text-[12px] leading-4 text-ink-tertiary">{radius.use}</span>
                    </li>
                  ))}
                </ul>
              </KitGroup>
            </div>
          </KitSection>

          <KitSection title={t.web.kit.sections.cards}>
            <div className="grid grid-cols-1 gap-gutter md:grid-cols-2 lg:grid-cols-4">
              <VenueCard
                name={t.web.kit.samples.venueName}
                meta={t.web.kit.samples.venueMeta}
                tag={t.web.kit.samples.venueTag}
                slots={["18:00", "18:30", "19:00"]}
                favorite={favorite}
                onToggleFavorite={() => setFavorite((value) => !value)}
              />
              {/* Вторая карточка — без свободного времени: пустое состояние
                  тоже часть набора, а не забытый случай. */}
              <VenueCard name={t.web.kit.samples.venueName} meta={t.web.kit.samples.venueMeta} />
            </div>
          </KitSection>

          <KitSection title={t.web.kit.sections.modal}>
            <div>
              <Button size="m" variant="secondary" onClick={() => setModalOpen(true)}>
                {t.web.kit.samples.openModal}
              </Button>
            </div>
          </KitSection>
        </Container>
      </main>

      <SiteFooter />

      {modalOpen ? (
        <Modal
          title={t.web.kit.samples.modalTitle}
          description={t.web.kit.samples.modalText}
          onClose={() => setModalOpen(false)}
        >
          <TextField label={t.web.kit.samples.phoneLabel} inputMode="tel" autoComplete="tel" />
          <Button block onClick={() => setModalOpen(false)}>
            {t.web.kit.samples.modalSubmit}
          </Button>
        </Modal>
      ) : null}
    </>
  );
}
