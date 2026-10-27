"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { showInNotebook } from "@/components/notebook/arrival";
import { arriveAt } from "@/components/reader/reading-position";
import { LinkButton, TextLink } from "@/components/ui/button";
import { cx, FOCUS } from "@/components/ui/cx";
import { SelectField } from "@/components/ui/field";
import { loadChapter } from "@/lib/chapter-client";
import { getNotes } from "@/lib/notes";
import { positionHref, setWeeklyGoal, type Saved } from "@/lib/storage";
import { plain } from "@/lib/text";
import { DAY_SECONDS, summarizeWeek, type Week } from "@/lib/week";

/** Home for someone who has been here before: pick up the book, see the week, see your words. */
export function WelcomeBack({ saved }: { saved: Saved }) {
  const week = summarizeWeek(saved);
  return (
    <>
      <header className="mb-10 max-w-[38rem]">
        <p className="eyebrow">Pride and Prejudice · Jane Austen · 1813</p>
        <h1 className="mt-2 font-serif text-3xl leading-tight lg:text-4xl">Welcome back.</h1>
        <p className="mt-3 text-[1.0625rem] leading-relaxed text-muted">{summaryLine(week)}</p>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,38rem)_20rem] lg:gap-x-16">
        <ContinueCard position={saved.position} />
        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <WeekCard week={week} />
        </div>
        <RecentWords words={saved.words} />
      </div>
    </>
  );
}

function summaryLine(week: Week) {
  if (week.freshStart) return `New week, fresh start: 0 of ${week.goal} ${week.goal === 1 ? "day" : "days"}.`;
  if (week.met) return "You’ve met this week’s goal. Anything more is a bonus.";
  const left = week.goal - week.daysRead;
  return `${left} more ${left === 1 ? "day" : "days"} of reading to meet this week’s goal.`;
}

function ContinueCard({ position }: { position: Saved["position"] }) {
  const [excerpt, setExcerpt] = useState<string | null>(null);

  useEffect(() => {
    if (!position) return;
    let current = true;
    loadChapter(position.chapter)
      .then((paragraphs) => {
        const text = plain(paragraphs[position.paragraph] ?? "");
        if (current) setExcerpt(text.length > 160 ? `${text.slice(0, 160).replace(/\s+\S*$/, "")}…` : text);
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [position]);

  if (!position) {
    return (
      <section aria-labelledby="continue-heading" className="rounded-lg border border-rule bg-surface p-6">
        <h2 id="continue-heading" className="eyebrow">
          Start reading
        </h2>
        <p className="mt-2 font-serif text-2xl">Chapter 1</p>
        <LinkButton href="/read/1" className="mt-5">
          Start Chapter 1 <span aria-hidden="true">→</span>
        </LinkButton>
      </section>
    );
  }

  return (
    <section aria-labelledby="continue-heading" className="rounded-lg border border-rule bg-surface p-6">
      <h2 id="continue-heading" className="eyebrow">
        Continue reading
      </h2>
      <p className="mt-2 font-serif text-2xl">
        Chapter {position.chapter}
        <span className="text-muted">, paragraph {position.paragraph + 1}</span>
      </p>
      <blockquote className="mt-3 min-h-[3.5em] border-l-2 border-rule pl-4 font-serif text-[1.0625rem] leading-relaxed text-muted">
        {excerpt ?? <span className="sr-only">Loading the paragraph…</span>}
      </blockquote>
      <LinkButton href={positionHref(position)} onClick={() => arriveAt(position)} className="mt-5">
        Continue <span aria-hidden="true">→</span>
      </LinkButton>
      <TextLink href="/read" className="ml-4 font-sans text-sm">
        Contents
      </TextLink>
    </section>
  );
}

function WeekCard({ week }: { week: Week }) {
  const readDays = week.days.filter((d) => d.read).map((d) => d.label);
  const minutesLeft = Math.ceil((DAY_SECONDS - week.todaySeconds) / 60);
  const today = week.days.find((d) => d.today);

  return (
    <section aria-labelledby="week-heading" className="rounded-lg border border-rule bg-surface p-6">
      <h2 id="week-heading" className="eyebrow">
        This week
      </h2>
      <p className="mt-2 font-serif text-3xl">
        {week.daysRead}{" "}
        <span className="text-xl text-muted">
          {week.met
            ? `${week.daysRead === 1 ? "day" : "days"} · goal met`
            : `of ${week.goal} ${week.goal === 1 ? "day" : "days"}`}
        </span>
      </p>

      <div
        role="img"
        className="mt-4 flex justify-between gap-1"
        aria-label={readDays.length ? `Read on ${listOf(readDays)}.` : "No reading days yet this week."}
      >
        {week.days.map((d) => (
          <div key={d.label} className="flex flex-col items-center gap-1.5">
            <span
              className={cx(
                "flex size-8 items-center justify-center rounded-full border-2 text-xs font-semibold",
                d.read && "border-accent bg-accent text-white",
                !d.read && d.today && "border-ink text-ink",
                !d.read && !d.today && "border-rule text-transparent",
                d.future && "opacity-60",
              )}
            >
              {d.read ? "✓" : ""}
            </span>
            <span className={cx("text-xs", d.today ? "font-semibold text-ink" : "text-muted")}>{d.label[0]}</span>
          </div>
        ))}
      </div>

      <p className="mt-4 font-sans text-sm leading-relaxed">
        {today?.read
          ? "Today counts toward your goal."
          : week.todaySeconds > 0
            ? `Read ${minutesLeft} more ${minutesLeft === 1 ? "minute" : "minutes"} today to count it.`
            : "Read for 5 minutes today to count it."}
      </p>
      <p className="mt-1 font-sans text-sm leading-relaxed text-muted">
        {week.streak >= 2
          ? `${week.streak} weeks in a row.`
          : week.streak === 1
            ? week.met
              ? "Goal met. Keep it up next week for a streak."
              : "You met last week’s goal. Keep it going."
            : "Meet your goal this week to start a streak."}
      </p>

      <div className="mt-5 border-t border-rule pt-5">
        <SelectField
          id="weekly-goal"
          label="Weekly goal"
          hint="A day counts after 5 minutes of reading."
          value={week.goal}
          onChange={(e) => setWeeklyGoal(Number(e.target.value))}
        >
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <option key={n} value={n}>
              {n === 7 ? "Every day" : `${n} ${n === 1 ? "day" : "days"} a week`}
            </option>
          ))}
        </SelectField>
      </div>
    </section>
  );
}

function listOf(items: string[]) {
  return items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

function RecentWords({ words }: { words: Saved["words"] }) {
  const recent = [...words].sort((a, b) => b.savedAt.localeCompare(a.savedAt)).slice(0, 3);
  return (
    <section aria-labelledby="recent-heading">
      <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-2">
        <h2 id="recent-heading" className="eyebrow">
          Your latest words
        </h2>
        {words.length > 0 && (
          <TextLink href="/notebook" className="font-sans text-sm">
            All {words.length} in your notebook
          </TextLink>
        )}
      </div>
      {recent.length === 0 ? (
        <p className="mt-4 text-[0.9375rem] leading-relaxed text-muted">
          Words you save will show up here. Tap an underlined word while you read, or use + Add a word.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-rule">
          {recent.map((w) => {
            const hint = w.noteId ? getNotes(w.chapter).find((n) => n.id === w.noteId)?.short : undefined;
            return (
              <li key={w.id}>
                <Link
                  href={`/notebook#word-${w.id}`}
                  onClick={() => showInNotebook(w.id)}
                  className={cx("group block rounded-sm py-3", FOCUS)}
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-serif text-lg group-hover:underline">{w.phrase}</span>
                    <span className="shrink-0 font-sans text-xs text-muted">Chapter {w.chapter}</span>
                  </span>
                  {(w.myNote || hint) && (
                    <span className="mt-0.5 block truncate font-sans text-sm text-muted">{w.myNote || hint}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
