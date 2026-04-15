"use client";

import type { StepProps } from "../types";
import type { HubChallenge, ChallengeArea, ImpactScores } from "@/types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MultiSelect } from "@/components/ui/multi-select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CHALLENGE_AREAS } from "@/config/vocabularies";
import { Plus, Trash2 } from "lucide-react";
import { formatLabel } from "@/lib/utils";

const defaultImpact: ImpactScores = {
  technological: 0,
  artistic: 0,
  financial: 0,
  production: 0,
  educational: 0,
  community: 0,
};

const emptyChallenge = {
  title: "",
  problem_description: "",
  area: [] as ChallengeArea[],
  urgency: 3,
  difficulty: 3,
  impact_scores: { ...defaultImpact },
  expected_solution: "",
};

function ScoreInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted capitalize flex-1">{label}</span>
      <div className="flex items-center gap-1">
        {[0, 1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`w-6 h-6 rounded text-xs font-medium transition-colors ${
              n <= value
                ? "bg-primary text-white"
                : "bg-stone-100 text-stone-400 hover:bg-stone-200"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ChallengesStep({ data, updateData, errors }: StepProps) {
  const challenges = data.challenges;

  function addChallenge() {
    updateData({ challenges: [...challenges, { ...emptyChallenge, impact_scores: { ...defaultImpact } }] });
  }

  function removeChallenge(index: number) {
    updateData({ challenges: challenges.filter((_, i) => i !== index) });
  }

  function updateChallenge(index: number, patch: Partial<HubChallenge>) {
    const updated = challenges.map((c, i) =>
      i === index ? { ...c, ...patch } : c
    );
    updateData({ challenges: updated });
  }

  function updateImpact(
    challengeIndex: number,
    key: keyof ImpactScores,
    value: number
  ) {
    const challenge = challenges[challengeIndex];
    updateChallenge(challengeIndex, {
      impact_scores: { ...challenge.impact_scores, [key]: value },
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Describe challenges your hub faces. These help match pilgrims with
        relevant skills to your needs. This section is optional but highly
        valuable.
      </p>

      {challenges.map((challenge, i) => (
        <Card key={i} padding="md" className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">
              Challenge {i + 1}
            </h4>
            <button
              type="button"
              onClick={() => removeChallenge(i)}
              className="text-muted-light hover:text-danger transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <Input
            label="Title"
            name={`challenge-${i}-title`}
            placeholder="e.g. Improve documentation workflow"
            value={challenge.title}
            onChange={(e) => updateChallenge(i, { title: e.target.value })}
            error={errors[`challenges.${i}.title`]}
          />

          <Textarea
            label="Problem Description"
            name={`challenge-${i}-desc`}
            placeholder="Describe the challenge in detail"
            value={challenge.problem_description}
            onChange={(e) =>
              updateChallenge(i, { problem_description: e.target.value })
            }
            error={errors[`challenges.${i}.problem_description`]}
            rows={3}
          />

          <MultiSelect
            label="Challenge Areas"
            options={CHALLENGE_AREAS}
            value={challenge.area}
            onChange={(val) =>
              updateChallenge(i, { area: val as ChallengeArea[] })
            }
            error={errors[`challenges.${i}.area`]}
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">
                Urgency (1–5)
              </label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => updateChallenge(i, { urgency: n })}
                    className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                      n <= challenge.urgency
                        ? "bg-amber-500 text-white"
                        : "bg-stone-100 text-stone-400 hover:bg-stone-200"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-light">1 = more than a year · 5 = one month</p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">
                Difficulty (1–5)
              </label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => updateChallenge(i, { difficulty: n })}
                    className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                      n <= challenge.difficulty
                        ? "bg-rose-500 text-white"
                        : "bg-stone-100 text-stone-400 hover:bg-stone-200"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Impact Scores (0–5)
            </label>
            <div className="space-y-2 p-3 bg-stone-50 rounded-lg">
              {(
                Object.keys(challenge.impact_scores) as (keyof ImpactScores)[]
              ).map((key) => (
                <ScoreInput
                  key={key}
                  label={formatLabel(key)}
                  value={challenge.impact_scores[key]}
                  onChange={(v) => updateImpact(i, key, v)}
                />
              ))}
            </div>
          </div>

          <Textarea
            label="Expected Solution"
            name={`challenge-${i}-solution`}
            placeholder="Describe what a good solution would look like"
            value={challenge.expected_solution}
            onChange={(e) =>
              updateChallenge(i, { expected_solution: e.target.value })
            }
            error={errors[`challenges.${i}.expected_solution`]}
            rows={3}
          />
        </Card>
      ))}

      <Button type="button" variant="secondary" onClick={addChallenge} className="w-full">
        <Plus className="w-4 h-4" />
        Add Challenge
      </Button>
    </div>
  );
}
