#!/usr/bin/env python3
"""Hand-coded taxonomy of examiner Task Response anchors, plus per-category recall.

The 165 anchors in tmp/corpus/task_response-fixtures.json were read one by one
and each given a single primary label (see LABELS below). The index is the
1-based order the anchors appear when the fixture file is walked essay by essay,
anchor by anchor -- see dump_anchors() for the exact enumeration.

Two things this script is careful about:

  * scripts/score-sentence-level.py's is_praise() is reused verbatim, and its
    verdict is reported next to the hand verdict so the disagreement is visible
    rather than hidden. is_praise fires on "better", "clear", "great" and misses
    "irrelevant", so it mislabels in both directions.
  * recall is computed per category with the same sentence-level rule the A/B
    scorer uses, over only the essays a given result file actually covers.

    python3 scripts/analyze-tr-miss-taxonomy.py
"""
import importlib.util
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FIXTURES = ROOT / "tmp" / "corpus" / "task_response-fixtures.json"

_spec = importlib.util.spec_from_file_location("sl", ROOT / "scripts" / "score-sentence-level.py")
sl = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(sl)

# label -> human-readable name
NAMES = {
    "DEV": "Development depth (idea asserted, not developed)",
    "SPEC": "Specificity / concrete example demanded",
    "PARA": "Paragraph & sentence information structure",
    "COV": "Task coverage, both sides, clarity of position",
    "FOCUS": "Idea count & focus (too many ideas / listing / new idea)",
    "PARAPH": "Prompt paraphrase quality",
    "REL": "Relevance (off-topic / sentence adds nothing)",
    "CLAIM": "Claim strength & hedging",
    "PROP": "Proportion & placement conventions",
    "IDEAQ": "Idea plausibility",
    "OTHER": "Other criterion leaked into TR (lexis / sentence length)",
    "META": "Non-actionable (band verdict, examiner aside, rubric text)",
    "PRAISE": "Praise / accepted as-is",
}

# 1-based anchor index -> hand label.
LABELS = {
    1: "META", 2: "FOCUS", 3: "PRAISE", 4: "OTHER", 5: "PRAISE", 6: "REL",
    7: "PARA", 8: "SPEC", 9: "PRAISE", 10: "PRAISE", 11: "COV", 12: "PARAPH",
    13: "PRAISE", 14: "SPEC", 15: "META", 16: "CLAIM", 17: "PARA", 18: "SPEC",
    19: "FOCUS", 20: "SPEC", 21: "PRAISE", 22: "PRAISE", 23: "PRAISE",
    24: "FOCUS", 25: "SPEC", 26: "PARA", 27: "SPEC", 28: "CLAIM", 29: "PRAISE",
    30: "SPEC", 31: "PARA", 32: "REL", 33: "SPEC", 34: "PRAISE", 35: "IDEAQ",
    36: "PROP", 37: "PARA", 38: "SPEC", 39: "DEV", 40: "DEV", 41: "PRAISE",
    42: "PRAISE", 43: "PRAISE", 44: "DEV", 45: "DEV", 46: "PRAISE",
    47: "META", 48: "DEV", 49: "FOCUS", 50: "PRAISE", 51: "DEV", 52: "SPEC",
    53: "PRAISE", 54: "OTHER", 55: "FOCUS", 56: "CLAIM", 57: "FOCUS",
    58: "PRAISE", 59: "DEV", 60: "SPEC", 61: "PRAISE", 62: "COV", 63: "COV",
    64: "PRAISE", 65: "PRAISE", 66: "PRAISE", 67: "COV", 68: "PRAISE",
    69: "PRAISE", 70: "PRAISE", 71: "SPEC", 72: "PRAISE", 73: "PRAISE",
    74: "PRAISE", 75: "DEV", 76: "PRAISE", 77: "SPEC", 78: "PRAISE",
    79: "PRAISE", 80: "PRAISE", 81: "SPEC", 82: "COV", 83: "REL", 84: "REL",
    85: "DEV", 86: "PRAISE", 87: "PRAISE", 88: "CLAIM", 89: "PROP", 90: "DEV",
    91: "DEV", 92: "COV", 93: "COV", 94: "COV", 95: "REL", 96: "SPEC",
    97: "PRAISE", 98: "FOCUS", 99: "FOCUS", 100: "COV", 101: "PARA",
    102: "DEV", 103: "PARA", 104: "DEV", 105: "PRAISE", 106: "PRAISE",
    107: "PRAISE", 108: "PARAPH", 109: "REL", 110: "DEV", 111: "DEV",
    112: "PRAISE", 113: "SPEC", 114: "DEV", 115: "DEV", 116: "DEV",
    117: "PARAPH", 118: "PARAPH", 119: "DEV", 120: "OTHER", 121: "DEV",
    122: "DEV", 123: "PRAISE", 124: "REL", 125: "PROP", 126: "PARA",
    127: "SPEC", 128: "SPEC", 129: "PARA", 130: "PRAISE", 131: "PRAISE",
    132: "PRAISE", 133: "PRAISE", 134: "CLAIM", 135: "PRAISE", 136: "COV",
    137: "PRAISE", 138: "PARA", 139: "PRAISE", 140: "PRAISE", 141: "PRAISE",
    142: "CLAIM", 143: "PRAISE", 144: "PRAISE", 145: "PRAISE", 146: "PRAISE",
    147: "PARA", 148: "PRAISE", 149: "PRAISE", 150: "DEV", 151: "OTHER",
    152: "PRAISE", 153: "PARAPH", 154: "COV", 155: "DEV", 156: "COV",
    157: "PRAISE", 158: "PRAISE", 159: "PRAISE", 160: "SPEC", 161: "PRAISE",
    162: "SPEC", 163: "PARA", 164: "SPEC", 165: "PRAISE",
}

# Which shipped sub-pass, if any, asks the model to look for this.
TARGETED = {
    "DEV": "yes - TR_DEVELOPMENT (whole pass)",
    "SPEC": "no - explicitly disclaimed by both",
    "PARA": "no - nothing in either pass",
    "COV": "yes - TR_COVERAGE a/b/c/e",
    "FOCUS": "partly - TR_COVERAGE f only (repeat), not count/listing",
    "PARAPH": "no - nothing in either pass",
    "REL": "partly - TR_COVERAGE d (drift), disclaimed by DEVELOPMENT",
    "CLAIM": "no - nothing in either pass",
    "PROP": "partly - TR_COVERAGE g (intro/concl length)",
    "IDEAQ": "no - nothing in either pass",
    "OTHER": "n/a - belongs to another criterion",
    "META": "n/a - not reproducible",
    "PRAISE": "n/a - not a finding",
}

ARMS = {
    "shipped 2-pass (res-tr-cur)": "tmp/ab/res-tr-cur.json",
    "sub: development": "tmp/ab/res-tr-sub-development.json",
    "sub: coverage": "tmp/ab/res-tr-sub-coverage.json",
    "sub: specificity (unshipped)": "tmp/ab/res-tr-sub-specificity.json",
    "v9 monolith": "tmp/ab/res-tr-v9.json",
    "v10 monolith": "tmp/ab/res-tr-v10.json",
    "old monolith (exam set)": "tmp/ab/result-tr-old-exam.json",
    "new monolith (exam set)": "tmp/ab/result-tr-new-exam.json",
}


def walk(fixtures):
    """Yield (index, fixture, anchor) in the canonical enumeration order."""
    index = 0
    for fixture in fixtures:
        for anchor in fixture.get("trAnchors", []):
            index += 1
            yield index, fixture, anchor


def touched_sentences(entry, essay, bounds):
    """Sentence indices covered by any verifiable model quote, per run."""
    runs = entry.get("runs") or [{"findings": entry.get("findings", [])}]
    out = []
    for run in runs:
        touched = set()
        for finding in run.get("findings", []):
            for evidence in finding.get("evidence", []):
                quote = sl.normalize(evidence.get("sourceText", ""))
                at = essay.find(quote) if quote else -1
                if at < 0:
                    continue
                for i, (start, end) in enumerate(bounds):
                    if start < at + len(quote) and at < end:
                        touched.add(i)
        out.append(touched)
    return out


def main() -> int:
    fixtures = json.loads(FIXTURES.read_text(encoding="utf-8"))
    rows = list(walk(fixtures))
    assert len(rows) == len(LABELS), f"{len(rows)} anchors but {len(LABELS)} labels"

    # ---------- praise accounting ----------
    auto_praise = sum(1 for _, _, a in rows if sl.is_praise(a["comment"]))
    hand_praise = sum(1 for i, _, _ in rows if LABELS[i] == "PRAISE")
    both = sum(1 for i, _, a in rows if sl.is_praise(a["comment"]) and LABELS[i] == "PRAISE")
    auto_only = auto_praise - both
    hand_only = hand_praise - both
    print(f"anchors                                   {len(rows)}")
    print(f"is_praise() praise / non-praise           {auto_praise} / {len(rows) - auto_praise}")
    print(f"hand-read  praise / non-praise            {hand_praise} / {len(rows) - hand_praise}")
    print(f"  is_praise says praise, hand says not    {auto_only}")
    print(f"  hand says praise, is_praise says not    {hand_only}")
    print(f"  is_praise agreement with hand read      "
          f"{(len(rows) - auto_only - hand_only) / len(rows) * 100:.1f}%")

    actionable = [(i, f, a) for i, f, a in rows if LABELS[i] not in ("PRAISE", "META", "OTHER")]
    print(f"\nactionable TR anchors (drop praise/meta/other-criterion)  {len(actionable)}")

    # ---------- taxonomy ----------
    counts = Counter(LABELS[i] for i, _, _ in rows)
    denom = len(actionable)

    # ---------- per-category recall ----------
    per_arm = {}
    for label, path in ARMS.items():
        path = ROOT / path
        if not path.exists():
            continue
        entries = {e["fileId"]: e for e in json.loads(path.read_text(encoding="utf-8"))}
        hits, seen = Counter(), Counter()
        for i, fixture, anchor in rows:
            entry = entries.get(fixture["fileId"])
            if not entry:
                continue
            essay = sl.normalize(fixture["essay"])
            bounds = sl.sentence_bounds(essay)
            at = essay.find(sl.normalize(anchor["anchoredText"]))
            if at < 0:
                continue
            want = sl.sentence_of(at, bounds)
            runs = touched_sentences(entry, essay, bounds)
            if not runs:
                continue
            cat = LABELS[i]
            seen[cat] += 1
            if any(want in t for t in runs):
                hits[cat] += 1
        per_arm[label] = (hits, seen)

    # Union: was this anchor's sentence ever touched by ANY arm? An upper bound
    # on what the current prompt family can reach, across all 26 essays covered.
    union_hits, union_seen = Counter(), Counter()
    all_entries = defaultdict(list)
    for path in ARMS.values():
        path = ROOT / path
        if not path.exists():
            continue
        for e in json.loads(path.read_text(encoding="utf-8")):
            all_entries[e["fileId"]].append(e)
    for i, fixture, anchor in rows:
        entries = all_entries.get(fixture["fileId"])
        if not entries:
            continue
        essay = sl.normalize(fixture["essay"])
        bounds = sl.sentence_bounds(essay)
        at = essay.find(sl.normalize(anchor["anchoredText"]))
        if at < 0:
            continue
        want = sl.sentence_of(at, bounds)
        cat = LABELS[i]
        union_seen[cat] += 1
        if any(want in t for e in entries for t in touched_sentences(e, essay, bounds)):
            union_hits[cat] += 1
    per_arm["UNION of all 8 arms"] = (union_hits, union_seen)

    print("\n" + "=" * 118)
    print("TAXONOMY  (share is of the {} actionable anchors)".format(denom))
    print("=" * 118)
    header = f"{'category':13} {'n':>4} {'share':>7}  {'targeted by shipped prompt':46}"
    for label in per_arm:
        header += f" {label.split(' (')[0][:14]:>15}"
    print(header)
    print("-" * len(header))
    order = sorted(
        (c for c in counts if c not in ("PRAISE", "META", "OTHER")),
        key=lambda c: -counts[c],
    )
    for cat in order + ["OTHER", "META", "PRAISE"]:
        n = counts[cat]
        share = f"{n / denom * 100:5.1f}%" if cat in order else "     -"
        line = f"{cat:13} {n:4} {share:>7}  {TARGETED[cat][:46]:46}"
        for label, (hits, seen) in per_arm.items():
            if seen[cat]:
                line += f" {hits[cat]:>6}/{seen[cat]:<3}{hits[cat]/seen[cat]*100:4.0f}%"
            else:
                line += f" {'-':>15}"
        print(line)

    # ---------- verbatim examples ----------
    print("\n" + "=" * 118)
    print("VERBATIM EXAMPLES")
    print("=" * 118)
    by_cat = defaultdict(list)
    for i, fixture, anchor in rows:
        by_cat[LABELS[i]].append((i, fixture["fileId"], sl.normalize(anchor["comment"])))
    for cat in order:
        print(f"\n{cat}  ({counts[cat]}, {counts[cat]/denom*100:.1f}%)  {NAMES[cat]}")
        for i, pdf, comment in by_cat[cat][:3]:
            print(f"   #{i:<4} [{pdf}]")
            print(f"          \"{comment[:190]}\"")

    # ---------- coverage caveat ----------
    print("\n" + "=" * 118)
    for label, (hits, seen) in per_arm.items():
        tot_s, tot_h = sum(seen.values()), sum(hits.values())
        act_s = sum(seen[c] for c in order)
        act_h = sum(hits[c] for c in order)
        print(f"{label:30} anchors scorable {tot_s:3}  overall {tot_h/max(1,tot_s)*100:5.1f}%   "
              f"actionable-only {act_h}/{act_s} = {act_h/max(1,act_s)*100:5.1f}%")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
