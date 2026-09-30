"use client";
import { useEffect, useState } from "react";
import { BellRing, Send } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { SettingsShell } from "@/components/domain/settings/settings-shell";
import { GroupedSection, ListRow } from "@/components/ui/grouped-list";
import { IconTile } from "@/components/ui/icon-tile";
import { Toggle } from "@/components/ui/toggle";
import { Button } from "@/components/ui/button";
import { Chip, ChipScroller } from "@/components/ui/chip";
import { Field, Input } from "@/components/ui/input";
import { useAction } from "@/hooks/use-action";
import { saveNotificationPreferences } from "@/server/actions/preferences";
import {
  currentSubscription,
  pushSupport,
  subscribePush,
  unsubscribePush,
  type PushSupport,
} from "@/lib/push/client";
import { IosInstallGuide } from "@/components/pwa/install";

type Ev = { type: string; push: boolean; inApp: boolean };

export function NotificationSettings(props: {
  events: Ev[];
  quietStart: string;
  quietEnd: string;
  digestTime: string;
  muted: string[];
  properties: { id: string; name: string }[];
  hasDigest: boolean;
}) {
  const t = useTranslations("pwa");
  const tItems = useTranslations("settings.items");
  const tTypes = useTranslations("notifications.types") as unknown as (k: string) => string;
  const tc = useTranslations("common.actions");
  const locale = useLocale();
  const { exec, pending } = useAction();
  const [events, setEvents] = useState(props.events);
  const [quietStart, setQuietStart] = useState(props.quietStart);
  const [quietEnd, setQuietEnd] = useState(props.quietEnd);
  const [digestTime, setDigestTime] = useState(props.digestTime);
  const [muted, setMuted] = useState<string[]>(props.muted);
  const [support, setSupport] = useState<PushSupport>("unsupported");
  const [subscribed, setSubscribed] = useState(false);
  const [deviceBusy, setDeviceBusy] = useState(false);
  const [guide, setGuide] = useState(false);

  useEffect(() => {
    setSupport(pushSupport());
    void currentSubscription().then((s) => setSubscribed(!!s));
  }, []);

  const setEv = (type: string, patch: Partial<Ev>) =>
    setEvents((es) => es.map((e) => (e.type === type ? { ...e, ...patch } : e)));
  const save = () =>
    exec(
      () =>
        saveNotificationPreferences({
          events,
          quietStart,
          quietEnd,
          digestTime,
          mutedPropertyIds: muted,
        }),
      { success: t("prefs.saved") },
    );

  const deviceNote =
    support === "ios-needs-install"
      ? t("push.iosInstallFirst")
      : support === "denied"
        ? t("push.denied")
        : support === "not-configured"
          ? t("push.notConfigured")
          : support === "unsupported"
            ? t("push.unsupported")
            : null;

  return (
    <SettingsShell title={tItems("notifications")}>
      <GroupedSection header={t("prefs.device")} footer={deviceNote ?? undefined}>
        <ListRow
          leading={
            <IconTile tone={subscribed ? "green" : "gray"}>
              <BellRing />
            </IconTile>
          }
          title={subscribed ? t("push.enabled") : t("push.enable")}
          trailing={
            support === "ios-needs-install" ? (
              <Button size="sm" variant="secondary" onClick={() => setGuide(true)}>
                {t("install.iosShowMe")}
              </Button>
            ) : (
              <Toggle
                checked={subscribed}
                disabled={support !== "supported" || deviceBusy}
                ariaLabel={subscribed ? t("push.disable") : t("push.enable")}
                onCheckedChange={async (on) => {
                  setDeviceBusy(true);
                  if (on) {
                    const r = await subscribePush(locale);
                    if (r === "ok") setSubscribed(true);
                    else toast.error(r === "denied" ? t("push.denied") : t("push.unsupported"));
                    setSupport(pushSupport());
                  } else {
                    await unsubscribePush();
                    setSubscribed(false);
                  }
                  setDeviceBusy(false);
                }}
              />
            )
          }
        />
        <ListRow
          leading={
            <IconTile tone="gulf">
              <Send />
            </IconTile>
          }
          title={t("push.test")}
          onClick={async () => {
            const res = await fetch("/api/push/test", { method: "POST" }).catch(() => null);
            if (res?.ok) toast.success(t("push.testSent"));
            else toast.error(t("pill.offlineAction"));
          }}
          chevron
        />
      </GroupedSection>

      <GroupedSection header={t("prefs.events")} footer={t("prefs.eventsFooter")}>
        <div className="text-label-2 flex justify-end gap-6 px-4 pt-3 text-[12px] font-medium">
          <span className="w-[51px] text-center">{t("prefs.channelPush")}</span>
          <span className="w-[51px] text-center">{t("prefs.channelInApp")}</span>
        </div>
        {events.map((e) => (
          <ListRow
            key={e.type}
            title={tTypes(e.type)}
            trailing={
              <span className="flex gap-6">
                <Toggle
                  checked={e.push}
                  ariaLabel={`${tTypes(e.type)} — ${t("prefs.channelPush")}`}
                  onCheckedChange={(v) => setEv(e.type, { push: v })}
                />
                <Toggle
                  checked={e.inApp}
                  ariaLabel={`${tTypes(e.type)} — ${t("prefs.channelInApp")}`}
                  onCheckedChange={(v) => setEv(e.type, { inApp: v })}
                />
              </span>
            }
          />
        ))}
      </GroupedSection>

      <GroupedSection header={t("prefs.quiet")} footer={t("prefs.quietFooter")}>
        <div className="grid grid-cols-2 gap-3 p-4">
          <Field label={t("prefs.quietFrom")} htmlFor="quiet-from">
            <Input
              id="quiet-from"
              type="time"
              dir="ltr"
              className="num"
              value={quietStart}
              onChange={(e) => setQuietStart(e.target.value)}
            />
          </Field>
          <Field label={t("prefs.quietTo")} htmlFor="quiet-to">
            <Input
              id="quiet-to"
              type="time"
              dir="ltr"
              className="num"
              value={quietEnd}
              onChange={(e) => setQuietEnd(e.target.value)}
            />
          </Field>
        </div>
      </GroupedSection>

      {props.hasDigest && (
        <GroupedSection header={t("prefs.digest")} footer={t("prefs.digestFooter")}>
          <div className="p-4">
            <Field label={t("prefs.digestTime")} htmlFor="digest-time">
              <Input
                id="digest-time"
                type="time"
                step={3600}
                dir="ltr"
                className="num"
                value={digestTime}
                onChange={(e) => setDigestTime(e.target.value)}
              />
            </Field>
          </div>
        </GroupedSection>
      )}

      {props.properties.length > 0 && (
        <GroupedSection header={t("prefs.mute")} footer={t("prefs.muteFooter")}>
          <ChipScroller className="p-4" ariaLabel={t("prefs.mute")}>
            {props.properties.map((p) => {
              const on = muted.includes(p.id);
              return (
                <Chip
                  key={p.id}
                  active={on}
                  onClick={() => setMuted((m) => (on ? m.filter((x) => x !== p.id) : [...m, p.id]))}
                >
                  {p.name}
                </Chip>
              );
            })}
          </ChipScroller>
        </GroupedSection>
      )}

      <Button size="lg" block loading={pending} onClick={save}>
        {tc("save")}
      </Button>
      <IosInstallGuide open={guide} onOpenChange={setGuide} />
    </SettingsShell>
  );
}
