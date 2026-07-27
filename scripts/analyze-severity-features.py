#!/usr/bin/env python3
"""Can a deterministic, LLM-free ranking rule beat the model's own `severity`?

Offline only -- no API calls. Builds a labelled dataset of (finding -> HIT/MISS)
by reusing the sentence-level matching logic from scripts/score-sentence-level.py
(imported, not reimplemented, so labels agree with the project's scorers), then:

  1. reports base HIT rates per criterion,
  2. reports HIT rate per value of every cheap feature,
  3. evaluates candidate deterministic ranking rules by precision@3 per run,
  4. guards against overfitting with an essay-level A/B split (choose on A,
     report on held-out B, and vice versa).

    python3 scripts/analyze-severity-features.py
    python3 scripts/analyze-severity-features.py --criterion coh
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import random
import statistics
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCORER_PATH = ROOT / "scripts" / "score-sentence-level.py"

# ---------------------------------------------------------------- scorer reuse
_spec = importlib.util.spec_from_file_location("score_sentence_level", SCORER_PATH)
_scorer = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
_spec.loader.exec_module(_scorer)

is_praise = _scorer.is_praise
normalize = _scorer.normalize
sentence_bounds = _scorer.sentence_bounds
sentence_of = _scorer.sentence_of
ANCHOR_FIELD = _scorer.ANCHOR_FIELD

# ------------------------------------------------------------------- data spec
FIXTURES = {
    "coh": ROOT / "tmp/ab/coh-recovered-fixtures.json",
    "cohere": ROOT / "tmp/ab/cohere-recovered-fixtures.json",
    "gra": ROOT / "tmp/ab/gra-clean-fixtures.json",
    "lex": ROOT / "tmp/ab/lex-clean-fixtures.json",
    "tr": ROOT / "tmp/corpus/task_response-fixtures.json",
}

RESULTS = {
    "coh": [
        "tmp/ab/proc-coh-substitution.json",
        "tmp/ab/proc-coh-connective.json",
        "tmp/ab/null-cohrec-6.json",
    ],
    "cohere": ["tmp/ab/cr-base.json"],
    "gra": [
        "tmp/ab/res-gra-new.json",
        "tmp/ab/res-gra-old.json",
        "tmp/ab/null-gra2-8.json",
    ],
    "lex": [
        "tmp/ab/res-lex-new.json",
        "tmp/ab/res-lex-old.json",
        "tmp/ab/null-lex-8.json",
    ],
    "tr": [
        "tmp/ab/null-trfull-4.json",
        "tmp/ab/tr-base20.json",
        "tmp/ab/tr-checklist.json",
    ],
}

SEVERITY_RANK = {"minor": 0, "moderate": 1, "major": 2}
SCOPE_RANK = {"local": 0, "paragraph": 1, "macro": 2}


# ------------------------------------------------------------------- labelling
def covered_sentences(quote: str, essay: str, bounds) -> set[int]:
    """Sentence indices a quote covers -- same rule as score-sentence-level.py."""
    quote = normalize(quote)
    if not quote:
        return set()
    at = essay.find(quote)
    if at < 0:
        return set()
    return {i for i, (s, e) in enumerate(bounds) if s < at + len(quote) and at < e}


def build_dataset(criterion: str, drop_praise: bool = True):
    """One row per finding per run per result file."""
    fixtures = json.loads(FIXTURES[criterion].read_text(encoding="utf-8"))
    field = ANCHOR_FIELD[criterion]

    essays, wanted_by_file, anchor_stats = {}, {}, Counter()
    for fx in fixtures:
        essay = normalize(fx["essay"])
        bounds = sentence_bounds(essay)
        wanted = set()
        for anchor in fx.get(field, []):
            anchor_stats["anchors_total"] += 1
            if drop_praise and is_praise(anchor["comment"]):
                anchor_stats["anchors_praise"] += 1
                continue
            anchor_stats["anchors_nonpraise"] += 1
            at = essay.find(normalize(anchor["anchoredText"]))
            if at < 0:
                anchor_stats["anchors_unlocatable"] += 1
                continue
            wanted.add(sentence_of(at, bounds))
        essays[fx["fileId"]] = (essay, bounds)
        if wanted:
            wanted_by_file[fx["fileId"]] = wanted
            # Diagnostic: where in the essay do human anchors actually sit?
            for s in wanted:
                anchor_stats[f"anchor_relpos_{min(3, int(4 * s / max(1, len(bounds))))}"] += 1

    rows = []
    for rel in RESULTS[criterion]:
        path = ROOT / rel
        if not path.exists():
            continue
        for entry in json.loads(path.read_text(encoding="utf-8")):
            file_id = entry["fileId"]
            if file_id not in wanted_by_file or file_id not in essays:
                continue
            essay, bounds = essays[file_id]
            wanted = wanted_by_file[file_id]
            n_sentences = max(1, len(bounds))
            runs = entry.get("runs") or [{"findings": entry.get("findings", [])}]

            # Pass 1: sentence footprint of every finding (needed for cross-run).
            per_run = []
            for run in runs:
                items = []
                for order, finding in enumerate(run.get("findings") or []):
                    ev = finding.get("evidence") or []
                    touched = set()
                    for e in ev:
                        touched |= covered_sentences(e.get("sourceText", ""), essay, bounds)
                    primary = next(
                        (e for e in ev if e.get("role") == "primary"), ev[0] if ev else {}
                    )
                    ptouch = covered_sentences(primary.get("sourceText", ""), essay, bounds)
                    items.append((order, finding, ev, primary, touched, ptouch))
                per_run.append(items)

            n_runs = len(per_run)
            for run_idx, items in enumerate(per_run):
                dup_counts = Counter(
                    normalize(p.get("sourceText", "")) for _, _, _, p, _, _ in items
                )
                n_findings = len(items)
                for order, finding, ev, primary, touched, ptouch in items:
                    quote = normalize(primary.get("sourceText", ""))
                    words = len(quote.split()) if quote else 0
                    at = essay.find(quote) if quote else -1

                    # Whole sentence vs fragment: quote's char span equals the
                    # trimmed span of exactly one sentence.
                    full_sentence = False
                    if at >= 0 and len(ptouch) == 1:
                        s, e = bounds[next(iter(ptouch))]
                        sent = essay[s:e].strip()
                        full_sentence = normalize(sent) == quote

                    # Cross-run stability (REQUIRES MULTI-PASS).
                    stable = 0
                    if n_runs > 1 and touched:
                        for other_idx, other in enumerate(per_run):
                            if other_idx == run_idx:
                                continue
                            if any(touched & o_t for _, _, _, _, o_t, _ in other):
                                stable += 1
                        stability = stable / (n_runs - 1)
                    else:
                        stability = None

                    para = primary.get("paragraphIndex")
                    para = para if isinstance(para, int) else -1
                    max_para = max(
                        [
                            e.get("paragraphIndex")
                            for _, _, evs, _, _, _ in items
                            for e in evs
                            if isinstance(e.get("paragraphIndex"), int)
                        ]
                        or [0]
                    )
                    if para < 0:
                        para_pos = "unknown"
                    elif para == 0:
                        para_pos = "first"
                    elif para >= max_para:
                        para_pos = "last"
                    else:
                        para_pos = "body"

                    rows.append(
                        {
                            "criterion": criterion,
                            "source": rel,
                            "fileId": file_id,
                            "runKey": (rel, file_id, run_idx),
                            "order": order,
                            "hit": bool(touched & wanted),
                            "hit_primary_only": bool(ptouch & wanted),
                            # --- features ---
                            "severity": finding.get("severity") or "unknown",
                            "severity_rank": SEVERITY_RANK.get(finding.get("severity"), -1),
                            "scope": finding.get("scope") or "unknown",
                            "scope_rank": SCOPE_RANK.get(finding.get("scope"), -1),
                            "n_evidence": len(ev),
                            "has_context": any(e.get("role") != "primary" for e in ev),
                            "quote_words": words,
                            "quote_locatable": at >= 0,
                            "full_sentence": full_sentence,
                            "paragraphIndex": para,
                            "para_pos": para_pos,
                            "has_replacement": bool((finding.get("replacementText") or "").strip()),
                            "has_repair": bool((finding.get("repairVi") or "").strip()),
                            "explain_words": len((finding.get("explanationVi") or "").split()),
                            "repair_words": len((finding.get("repairVi") or "").split()),
                            "label_words": len((finding.get("errorLabelVi") or "").split()),
                            "has_requirement": bool(finding.get("requirementIds")),
                            "dup_in_run": dup_counts[quote] > 1 if quote else False,
                            "dup_count": dup_counts[quote] if quote else 0,
                            "n_findings_in_run": n_findings,
                            "rel_position": (order / max(1, n_findings - 1)) if n_findings > 1 else 0.0,
                            "sentence_pos": (
                                (min(ptouch) / n_sentences) if ptouch else -1.0
                            ),
                            # multi-pass only
                            "cross_run_stability": stability,
                            "n_runs": n_runs,
                        }
                    )
    return rows, anchor_stats, len(wanted_by_file), len(fixtures)


# -------------------------------------------------------------------- features
def bucket(row, feat):
    v = row[feat]
    if feat == "quote_words":
        return "1-3" if v <= 3 else "4-8" if v <= 8 else "9-15" if v <= 15 else "16+"
    if feat == "explain_words":
        return "<=20" if v <= 20 else "21-30" if v <= 30 else "31-40" if v <= 40 else "41+"
    if feat == "repair_words":
        return "0" if v == 0 else "1-5" if v <= 5 else "6-15" if v <= 15 else "16+"
    if feat == "label_words":
        return str(min(v, 6)) + ("+" if v >= 6 else "")
    if feat == "n_evidence":
        return str(min(v, 3)) + ("+" if v >= 3 else "")
    if feat == "dup_count":
        return "1" if v <= 1 else "2" if v == 2 else "3+"
    if feat == "order":
        return "0" if v == 0 else "1" if v == 1 else "2" if v == 2 else "3-5" if v <= 5 else "6+"
    if feat == "paragraphIndex":
        return str(v) if v <= 4 else "5+"
    if feat == "n_findings_in_run":
        return "1-3" if v <= 3 else "4-6" if v <= 6 else "7-10" if v <= 10 else "11+"
    if feat == "sentence_pos":
        return "unloc" if v < 0 else "0-.25" if v < .25 else ".25-.5" if v < .5 else ".5-.75" if v < .75 else ".75-1"
    if feat == "cross_run_stability":
        if v is None:
            return "n/a"
        return "0" if v == 0 else "<=.5" if v <= 0.5 else "<1" if v < 1 else "1.0"
    return str(v)


FEATURES = [
    "severity", "scope", "n_evidence", "has_context", "quote_words", "quote_locatable",
    "full_sentence", "paragraphIndex", "para_pos", "has_replacement", "has_repair",
    "explain_words", "repair_words", "label_words", "has_requirement", "dup_in_run",
    "dup_count", "order", "n_findings_in_run", "sentence_pos", "cross_run_stability",
]


def feature_table(rows, feat, min_n=10):
    groups = defaultdict(list)
    for r in rows:
        groups[bucket(r, feat)].append(r["hit"])
    out = []
    for k in sorted(groups, key=lambda k: (-len(groups[k]), k)):
        v = groups[k]
        out.append((k, len(v), sum(v) / len(v) if v else 0.0, len(v) >= min_n))
    return out


# ----------------------------------------------------------------------- rules
def make_key(spec):
    """spec: list of (feature, direction) -- direction 1 = higher first."""
    def key(r):
        vals = []
        for feat, direction in spec:
            v = r[feat]
            if v is None:
                v = -1
            if isinstance(v, bool):
                v = int(v)
            vals.append(-v * direction)
        return tuple(vals)
    return key


CANDIDATE_FEATURES = [
    "severity_rank", "scope_rank", "n_evidence", "quote_words", "quote_locatable",
    "full_sentence", "has_replacement", "has_repair", "explain_words", "repair_words",
    "label_words", "has_requirement", "dup_count", "has_context", "paragraphIndex",
    "sentence_pos", "order",
]


def build_candidates(include_multipass=False):
    cands = {
        "model_order (as returned)": [],
        "model_severity": [("severity_rank", 1)],
        "model_severity,then order": [("severity_rank", 1)],
    }
    cands = {"model_order (as returned)": [], "model_severity": [("severity_rank", 1)]}
    for f in CANDIDATE_FEATURES:
        for d in (1, -1):
            cands[f"{f} {'desc' if d > 0 else 'asc'}"] = [(f, d)]
    # hand-built composites (lexicographic tie-breaks)
    cands["earliest-text, then model order"] = [("sentence_pos", -1)]
    cands["para asc, then model order"] = [("paragraphIndex", -1)]
    cands["para asc, then severity desc"] = [("paragraphIndex", -1), ("severity_rank", 1)]
    cands["fragment-first, then para asc"] = [("full_sentence", -1), ("paragraphIndex", -1)]
    cands["severity desc, then para asc"] = [("severity_rank", 1), ("paragraphIndex", -1)]
    if include_multipass:
        for d in (1, -1):
            cands[f"cross_run_stability {'desc' if d>0 else 'asc'}"] = [("cross_run_stability", d)]
        cands["stability desc, then para asc"] = [("cross_run_stability", 1), ("paragraphIndex", -1)]
        cands["stability desc, then severity desc"] = [("cross_run_stability", 1), ("severity_rank", 1)]
    return cands


def group(rows, mode):
    """mode='run': one pool per (file, result-file, run).
    mode='pool': one pool per (file, result-file) -- all runs unioned, which is
    the real reconciliation scenario (multi-pass then pick top N)."""
    g = defaultdict(list)
    for r in rows:
        g[r["runKey"] if mode == "run" else (r["source"], r["fileId"])].append(r)
    return g


def precision_at_k(rows, key, k=3, mode="run"):
    """Mean precision@k over pools; denominator is min(k, findings in pool)."""
    scores = []
    for _, items in group(rows, mode).items():
        items = sorted(items, key=lambda r: (key(r), r["order"]))  # deterministic ties
        top = items[:k]
        if not top:
            continue
        scores.append(sum(1 for r in top if r["hit"]) / len(top))
    return (statistics.mean(scores) if scores else 0.0), len(scores)


def oracle_at_k(rows, k=3, mode="run"):
    scores = []
    for _, items in group(rows, mode).items():
        n = min(k, len(items))
        if n == 0:
            continue
        hits = sum(1 for r in items if r["hit"])
        scores.append(min(hits, n) / n)
    return (statistics.mean(scores) if scores else 0.0), len(scores)


def split_by_essay(rows, seed=17):
    files = sorted({r["fileId"] for r in rows})
    rng = random.Random(seed)
    rng.shuffle(files)
    half = set(files[: len(files) // 2])
    a = [r for r in rows if r["fileId"] in half]
    b = [r for r in rows if r["fileId"] not in half]
    return a, b, len(half), len(files) - len(half)


# ------------------------------------------------------------------------ main
def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--criterion", action="append", choices=sorted(FIXTURES))
    ap.add_argument("--k", type=int, default=3)
    ap.add_argument("--min-n", type=int, default=10)
    ap.add_argument("--seeds", type=int, default=5, help="A/B split seeds to average")
    args = ap.parse_args()

    criteria = args.criterion or ["coh", "cohere", "gra", "lex", "tr"]
    all_rows = []

    for crit in criteria:
        rows, astats, n_scored, n_fixtures = build_dataset(crit)
        all_rows.extend(rows)
        runs = {r["runKey"] for r in rows}
        essays = {r["fileId"] for r in rows}
        hits = sum(1 for r in rows if r["hit"])
        print("=" * 78)
        print(f"CRITERION {crit}")
        print(f"  fixtures={n_fixtures} essays_with_usable_anchors={n_scored} essays_in_dataset={len(essays)}")
        print(f"  anchors: total={astats['anchors_total']} praise={astats['anchors_praise']} "
              f"non-praise={astats['anchors_nonpraise']} non-praise-unlocatable={astats['anchors_unlocatable']}")
        print(f"  findings={len(rows)} runs={len(runs)} BASE HIT RATE="
              f"{hits/len(rows):.3f} ({hits}/{len(rows)})" if rows else "  no rows")
        if not rows:
            continue
        strict = sum(1 for r in rows if r["hit_primary_only"])
        print(f"  (strict primary-quote-only hit rate: {strict/len(rows):.3f} ({strict}/{len(rows)}))")
        unloc = sum(1 for r in rows if not r["quote_locatable"])
        print(f"  unlocatable primary quotes: {unloc}/{len(rows)}")
        q = [astats[f"anchor_relpos_{i}"] for i in range(4)]
        print(f"  anchor sentence position quartiles (Q1..Q4 of essay): {q}"
              f"  <- examiner annotation bias check")

        print("\n  -- HIT rate by feature value (n<{} marked *noise*) --".format(args.min_n))
        for feat in FEATURES:
            table = feature_table(rows, feat, args.min_n)
            if len(table) < 2:
                continue
            cells = "  ".join(
                f"{k}={rate:.2f}(n={n}){'' if ok else '*'}" for k, n, rate, ok in table
            )
            print(f"    {feat:22s} {cells}")

        # ---- rule search, per grouping mode
        multipass = any(r["cross_run_stability"] is not None for r in rows)
        cands = build_candidates(multipass)
        base_key = make_key([("severity_rank", 1)])

        for mode in ("run", "pool"):
            pools = group(rows, mode)
            sizes = [len(v) for v in pools.values()]
            rankable = sum(1 for s in sizes if s > args.k)
            print(f"\n  ==== grouping={mode} : pools={len(pools)} "
                  f"median size={statistics.median(sizes):.0f} "
                  f"pools with >{args.k} findings (i.e. actually rankable)={rankable} ====")
            if rankable == 0:
                print("    NOTHING TO RANK: every pool fits inside the top-k. "
                      "Ranking cannot change the result here.")
                continue

            base, npools = precision_at_k(rows, base_key, args.k, mode)
            oracle, _ = oracle_at_k(rows, args.k, mode)
            print(f"    model_severity baseline = {base:.3f}   ORACLE ceiling = {oracle:.3f}"
                  f"   (pools={npools})")
            scored = [(precision_at_k(rows, make_key(spec), args.k, mode)[0], name)
                      for name, spec in cands.items()]
            print("    top in-sample rules:")
            for p, name in sorted(scored, reverse=True)[:8]:
                print(f"      {p:.3f}  {name}")

            # ---- held-out evaluation: choose on A, report on B
            picks = Counter()
            gen_rule, gen_base, gen_orc = [], [], []
            for seed in range(args.seeds):
                for flip in (0, 1):
                    a, b, _, _ = split_by_essay(rows, seed=seed + 1)
                    if flip:
                        a, b = b, a
                    if not a or not b:
                        continue
                    _, name, spec = max(
                        ((precision_at_k(a, make_key(s), args.k, mode)[0], n, s)
                         for n, s in cands.items()),
                        key=lambda t: (t[0], t[1]),
                    )
                    picks[name] += 1
                    gen_rule.append(precision_at_k(b, make_key(spec), args.k, mode)[0])
                    gen_base.append(precision_at_k(b, base_key, args.k, mode)[0])
                    gen_orc.append(oracle_at_k(b, args.k, mode)[0])
            if gen_rule:
                wins = sum(1 for r_, b_ in zip(gen_rule, gen_base) if r_ > b_)
                print(f"    HELD-OUT (choose on A -> score on B, {len(gen_rule)} folds): "
                      f"rule={statistics.mean(gen_rule):.3f}  severity={statistics.mean(gen_base):.3f}  "
                      f"oracle={statistics.mean(gen_orc):.3f}  rule>severity in {wins}/{len(gen_rule)} folds")
                print(f"      rules chosen on A: {dict(picks.most_common(6))}")

            # ---- fixed-rule stability across folds
            folds = []
            for seed in range(args.seeds):
                a, b, _, _ = split_by_essay(rows, seed=seed + 1)
                folds.extend([f for f in (a, b) if f])
            base_vals = [precision_at_k(f, base_key, args.k, mode)[0] for f in folds]
            per_rule = {
                name: [precision_at_k(f, make_key(spec), args.k, mode)[0] for f in folds]
                for name, spec in cands.items()
            }
            print("    fixed rule, mean over all folds (beats severity in N folds):")
            top_fixed = sorted(per_rule.items(), key=lambda kv: -statistics.mean(kv[1]))[:8]
            for name, vals in top_fixed:
                w = sum(1 for v, bv in zip(vals, base_vals) if v > bv)
                print(f"      {statistics.mean(vals):.3f}  {w}/{len(vals)}  {name}")

            # ---- cross-source check: does the top fixed rule hold on every
            # result file separately (different prompt variants / run counts)?
            best_name, _ = top_fixed[0]
            best_spec = cands[best_name]
            print(f"    per-source check for '{best_name}' (rule / severity / oracle, pools):")
            for rel in RESULTS[crit]:
                sub = [r for r in rows if r["source"] == rel]
                if not sub:
                    continue
                pr, npr = precision_at_k(sub, make_key(best_spec), args.k, mode)
                ps, _ = precision_at_k(sub, base_key, args.k, mode)
                po, _ = oracle_at_k(sub, args.k, mode)
                print(f"      {Path(rel).name:28s} {pr:.3f} / {ps:.3f} / {po:.3f}  (pools={npr})")

            # ---- leave-one-essay-out for the top fixed rule
            files = sorted({r["fileId"] for r in rows})
            if len(files) > 2:
                loo_r, loo_b = [], []
                for f in files:
                    sub = [r for r in rows if r["fileId"] == f]
                    loo_r.append(precision_at_k(sub, make_key(best_spec), args.k, mode)[0])
                    loo_b.append(precision_at_k(sub, base_key, args.k, mode)[0])
                w = sum(1 for a_, b_ in zip(loo_r, loo_b) if a_ > b_)
                l = sum(1 for a_, b_ in zip(loo_r, loo_b) if a_ < b_)
                print(f"    per-essay: rule better on {w}, worse on {l}, tied on "
                      f"{len(files)-w-l} of {len(files)} essays")

    # ------------------------- pre-specified rules (no selection => no overfit)
    print("=" * 78)
    print("PRE-SPECIFIED RULE COMPARISON (rules fixed in advance, so the held-out")
    print("column is a clean test -- nothing was chosen by looking at the data)")
    prespec = {
        "severity desc (BASELINE)": [("severity_rank", 1)],
        "model order (free)": [],
        "R1 invert severity": [("severity_rank", -1)],
        "R2 earliest text first": [("sentence_pos", -1)],
        "R3 earliest para first": [("paragraphIndex", -1)],
        "R4 fragment-first, then earliest para": [("full_sentence", -1), ("paragraphIndex", -1)],
    }
    for mode in ("run", "pool"):
        print(f"\n  mode={mode}   cells = full-data p@{args.k} / mean over "
              f"{2*args.seeds} essay-half folds")
        header = f"    {'crit':7s}{'pools':>6s}{'oracle':>8s}" + "".join(
            f"{n[:24]:>26s}" for n in prespec)
        print(header)
        for crit in criteria:
            rows, _, _, _ = build_dataset(crit)
            if not rows:
                continue
            pools = group(rows, mode)
            if sum(1 for v in pools.values() if len(v) > args.k) == 0:
                print(f"    {crit:7s}{len(pools):>6d}   -- nothing rankable "
                      f"(all pools <= k) --")
                continue
            cells = []
            for _, spec in prespec.items():
                kk = make_key(spec)
                folds = []
                for seed in range(args.seeds):
                    a, b, _, _ = split_by_essay(rows, seed=seed + 1)
                    folds += [f for f in (a, b) if f]
                cells.append(
                    f"{precision_at_k(rows, kk, args.k, mode)[0]:.3f}/"
                    f"{statistics.mean([precision_at_k(f, kk, args.k, mode)[0] for f in folds]):.3f}"
                )
            print(f"    {crit:7s}{len(pools):>6d}{oracle_at_k(rows, args.k, mode)[0]:>8.3f}"
                  + "".join(f"{c:>26s}" for c in cells))

    # -------------------------------------------------- pooled cross-criterion
    if len(criteria) > 1 and all_rows:
        print("=" * 78)
        print("ALL CRITERIA POOLED")
        hits = sum(1 for r in all_rows if r["hit"])
        print(f"  findings={len(all_rows)} base hit={hits/len(all_rows):.3f}")
        for feat in FEATURES:
            table = feature_table(all_rows, feat, args.min_n)
            if len(table) < 2:
                continue
            cells = "  ".join(
                f"{k}={rate:.2f}(n={n}){'' if ok else '*'}" for k, n, rate, ok in table
            )
            print(f"    {feat:22s} {cells}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
