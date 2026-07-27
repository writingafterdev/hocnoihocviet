#!/usr/bin/env python3
"""Classify + analyse the extracted examiner-comment corpus."""
import json
import re
import statistics
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CORPUS = ROOT / "tmp" / "corpus" / "examiner-comments.json"
OUT = ROOT / "tmp" / "corpus"

# --- criterion lexicon -------------------------------------------------------
# (weight, regex). Explicit criterion names are weighted heavily.
LEX = {
    "task_response": [
        (6, r"\b(task\s*(achievement|response)|\bTA\b|\bTR\b)\b"),
        (3, r"\b(main idea|both (sides|questions|views|parts)|answer(s|ed|ing)? (the|both) question)"),
        (3, r"\b(develop(ed|ing|ment)?|underdevelop|not developed|fully developed)\b"),
        (3, r"\b(off[- ]topic|irrelevant|not relevant|doesn.t answer|didn.t answer)\b"),
        (3, r"\b(opinion|position|stance|thesis)\b"),
        (2, r"\b(example|specific|more detail|be more specific|support(ing)? idea)"),
        (2, r"\b(word count|too short|under \d+ words|250 words|too long|a little short)\b"),
        (2, r"\b(overgeneral|too strong( a)? claim|strong claim|weak claim|weaken|keep it weak|hypothetical)\b"),
        (2, r"\b(conclusion|introduction|intro)\b"),
        (2, r"\b(paraphrase)\b"),
        (1, r"\b(idea|ideas|argument|point)\b"),
    ],
    "coherence": [
        (6, r"\b(coherence|coherent)\b"),
        (3, r"\b(doesn.t make sense|makes no sense|not clear what|unclear|confusing|hard to follow|"
            r"don.t understand|i don.t follow)\b"),
        (3, r"\b(logical (order|flow|progression)|progression|flow of ideas|order of (the )?ideas|"
            r"switch (around|the order)|move this)\b"),
        (3, r"\b(paragraph(ing)?|one idea per paragraph|new paragraph|topic sentence)\b"),
        (2, r"\b(central topic|single idea|message)\b"),
        (4, r"\btopic .{0,12}(at the )?(beginning|start|end) of (the |your )?sentence"),
        (3, r"\b(information structure|old information|new information|end.weight)\b"),
        (3, r"\bsee\s*c\s*&\s*c\b"),
    ],
    "cohesion": [
        (6, r"\b(cohesion|cohesive device|cohesive)\b"),
        (4, r"\b(referenc(e|ing)|pronoun|antecedent|refers? back|substitut)"),
        (4, r"\b(linker|linking (word|phrase)|connector|transition|signpost)\b"),
        (3, r"\b(however|moreover|furthermore|in addition|therefore|besides|whereas|nevertheless|"
            r"on the other hand|firstly|secondly)\b"),
        (3, r"\b(not (a )?contrast|isn.t contrasting|not contrasting|not adding|doesn.t contrast)\b"),
        (2, r"\b(repeat(ed|ing)? the (noun|word)|repetition|same word twice)\b"),
        (5, r"\bc\s*&\s*c\b"),
        (3, r"\bfixed expressions?\b"),
    ],
    "lexical_resource": [
        (6, r"\b(vocabulary|vocab|lexical|lexis|\bLR\b)\b"),
        (4, r"\b(collocation|word choice|wrong word|doesn.t fit here|not (a )?synonym|synonym|"
            r"word form|spelling|misspel)\b"),
        (4, r"\b(informal|formal|academic|register|colloquial|contraction|phrasal verb|idiom|slang)\b"),
        (3, r"\b(less common (lexis|vocabulary)|precise|precision|natural|unnatural|"
            r"we (never|don.t) say|not english|awkward phrasing)\b"),
        (2, r"\b(overuse|repetitive|used too (often|much)|wordy|concise)\b"),
        (2, r"\b(uncountable|countable)\b"),
        (3, r"\b(same (word )?repeated|repeated in the same sentence|use a synonym)\b"),
        (3, r"\bavoid (using )?(phrasal|idiom|slang|contractions|informal)"),
    ],
    "grammatical_range_accuracy": [
        (6, r"\b(grammar|grammatical|\bGRA\b|\bGR\b)\b"),
        (4, r"\b(tense|present (simple|perfect|continuous)|past (simple|perfect)|future|verb form|"
            r"subject.verb|agreement)\b"),
        (4, r"\b(article|\ba\b/\ban\b|the definite article|plural|singular|\bs\b ending|'s ending|s endings)\b"),
        (4, r"\b(preposition|punctuation|comma|full stop|apostrophe|capital(isation|ization)?)\b"),
        (4, r"\b(relative clause|noun clause|subordinate|conditional|passive|modal|"
            r"sentence structure|run.on|fragment|word order|complex sentence|clause)\b"),
        (3, r"\b(error.free|accurate|accuracy|mistakes? in (every|each|most)|small mistakes|"
            r"frequent errors|grammatical error)\b"),
        (2, r"\b(adjective|adverb|noun|verb|pronoun form)\b"),
        (4, r"\b(semi.?colon|semicolon)\b"),
        (4, r"(‘|“|\")(the|a|an)(’|”|\")"),
        (4, r"\b(definite|indefinite) article"),
    ],
}
LEX = {k: [(w, re.compile(p, re.I)) for w, p in v] for k, v in LEX.items()}

NON_ASSESSABLE = [
    ("exam_strategy", re.compile(
        r"\b(real exam|on the (day|exam)|40 minutes|time management|practi[cs]e|planning stage|"
        r"note form|exam day|test day|before the exam|homework|next essay|study|my sample|"
        r"check with my)\b", re.I)),
    ("band_arithmetic", re.compile(r"^[\d\s+.=/–-]+$")),
    ("generic_praise", re.compile(
        r"^(good|great|excellent|nice|perfect|ok|okay|yes|clear|well done|good!|great!|"
        r"excellent!|good\s*\||better|fine|very good|good job)[\s!.\|–-]*$", re.I)),
    ("word_artifact", re.compile(r"^(font:|indent|space (before|after)|list paragraph|"
                                 r"bulleted|numbered|style definition)", re.I)),
]

SUMMARY_LABEL = [
    ("task_response", re.compile(r"^task\s*(achievement|response|resonse)", re.I)),
    ("coherence", re.compile(r"^coherence", re.I)),
    ("cohesion", re.compile(r"^(cohesion|c&c)", re.I)),
    ("lexical_resource", re.compile(r"^(vocabulary|lexical)", re.I)),
    ("grammatical_range_accuracy", re.compile(r"^(grammar|grammatical)", re.I)),
    ("non_assessable", re.compile(r"^(overall|band)", re.I)),
]

REWRITE_HINT = re.compile(r"[/–—]|^\W*[a-z]")
IMPERATIVE = re.compile(
    r"^(add|use|try|make|keep|don.t|do not|avoid|remove|change|state|start|give|be |say|write|link|"
    r"develop|show|explain|note|remember|check|switch|move|drop|put|need|you )", re.I)


def classify(text, kind):
    t = text.strip()
    if kind == "summary":
        for name, rx in SUMMARY_LABEL:
            if rx.match(t):
                return name, "summary_label"
    for name, rx in NON_ASSESSABLE:
        if name == "exam_strategy":
            continue
        if rx.match(t):
            return "non_assessable", name
    scores = {}
    for crit, pats in LEX.items():
        s = 0
        for w, rx in pats:
            if rx.search(t):
                s += w
        if s:
            scores[crit] = s
    if not scores:
        for name, rx in NON_ASSESSABLE:
            if name == "exam_strategy" and rx.search(t):
                return "non_assessable", name
        # bare rewrite suggestion / replacement wording, no criterion cue
        if len(t.split()) <= 14 and not IMPERATIVE.match(t):
            return "lexical_resource", "bare_rewrite_suggestion"
        return "non_assessable", "unclassified"
    best = max(scores.values())
    winners = [k for k, v in scores.items() if v == best]
    if len(winners) > 1:
        order = ["task_response", "grammatical_range_accuracy", "lexical_resource", "cohesion", "coherence"]
        winners.sort(key=lambda w: order.index(w))
    return winners[0], "lexicon"


# --- recurring error types ---------------------------------------------------
ERROR_TYPES = {
    "task_response": [
        ("idea not developed / thin support", r"\b(not (fully )?developed|underdevelop|develop (it|this|both|the idea)|"
                                              r"needs? (more )?develop|poorly developed|more detail|develop more)"),
        ("example missing / vague / illogical", r"\b(example)\b"),
        ("opinion / position unclear or absent", r"\b(opinion|position|stance)\b"),
        ("overstated or unsupported claim", r"\b(strong claim|weak claim|weaken|keep it weak|hypothetical|"
                                            r"too strong|impossible claim|overgeneral)"),
        ("question not fully answered / off topic", r"\b(both (questions|parts|sides|views)|off[- ]topic|irrelevant|"
                                                    r"answer (the|both) question|doesn.t answer)"),
        ("paraphrase of prompt weak / copied", r"\bparaphras"),
        ("length / word count", r"\b(word count|too short|a little short|too long|250 words)"),
        ("too many main ideas in one paragraph", r"\b(two main ideas|3 ideas|too many (main )?ideas|both ideas)"),
        ("not specific enough / add concrete detail", r"\b(more specific|be specific|specific detail|"
                                                     r"as specific as possible|vague|more detail|crystal)"),
        ("main idea unclear or missing", r"\b(main idea|topic sentence)\b"),
    ],
    "coherence": [
        ("meaning unclear / does not make sense", r"\b(doesn.t make sense|makes no sense|unclear|confusing|"
                                                  r"don.t understand|hard to follow|what do you mean)"),
        ("topic sentence weak or missing", r"\btopic sentence\b"),
        ("illogical order / ideas need reordering", r"\b(switch (around|the order)|order of|move (this|it)|progression|flow)"),
        ("information order inside the sentence", r"\b(beginning|end) of (the |your )?sentence"),
        ("paragraphing problem", r"\bparagraph"),
    ],
    "cohesion": [
        ("referencing / pronoun reference faulty", r"\b(referenc|pronoun|refers? back|antecedent)"),
        ("wrong or mechanical linker", r"\b(linker|linking|connector|however|moreover|furthermore|besides|"
                                       r"in addition|therefore|nevertheless|firstly|secondly)"),
        ("false contrast / wrong logical relation", r"\b(not (a )?contrast|isn.t contrasting|not contrasting|not adding)"),
        ("repetition instead of substitution", r"\b(repetit|repeat|same word twice|substitut)"),
        ("fixed expression / signposting phrase", r"\bfixed expression"),
        ("cross-reference to the C&C feedback", r"\bc\s*&\s*c\b"),
    ],
    "lexical_resource": [
        ("register too informal", r"\b(informal|colloquial|contraction|phrasal verb|slang|academic|formal)"),
        ("collocation error", r"\bcollocation"),
        ("wrong word / word choice", r"\b(word choice|wrong word|doesn.t fit|not (a )?synonym|not synonyms|"
                                     r"we (never|don.t) say|means|precise|precision)"),
        ("word form / spelling", r"\b(word form|spelling|misspel)"),
        ("countable / uncountable noun", r"\b(uncountable|countable)"),
        ("repetition / overuse of a word", r"\b(overuse|repetitive|used too|same word)"),
        ("wordiness / lack of concision", r"\b(wordy|concise|too long.winded|messy)"),
        ("unnatural / non-native phrasing", r"\b(doesn.t sound natural|unnatural|awkward|not english|"
                                            r"we (never|don.t) say|translation)"),
        ("narrow range / repeats key words", r"\b(range|repeating words|show your vocabulary|"
                                             r"more academic|less common)"),
        ("suggested upgrade wording (bare rewrite)", r"^$"),  # filled from reason
    ],
    "grammatical_range_accuracy": [
        ("article error (a/an/the)", r"\b(article|\bthe\b needed|missing the)"),
        ("tense / verb form", r"\b(tense|present (simple|perfect|continuous)|past (simple|perfect)|verb form|"
                              r"subject.verb|agreement)"),
        ("singular / plural and -s endings", r"\b(plural|singular|s ending|.s ending)"),
        ("preposition error", r"\bpreposition"),
        ("punctuation", r"\b(punctuation|comma|full stop|apostrophe|capital)"),
        ("clause / sentence structure", r"\b(relative clause|noun clause|clause|sentence structure|run.on|"
                                        r"fragment|word order|complex sentence|subordinate|conditional|passive|modal)"),
        ("overall accuracy density", r"\b(error.free|mistakes? in (every|each|most)|small mistakes|frequent errors|"
                                     r"lots of mistakes|too many.*mistakes|minor error|careless mistake|errors are rare)"),
        ("word class (adjective/adverb/noun/verb) error", r"\b(adjective|adverb|noun needed|compound noun|"
                                                          r"possessive|verb\b)"),
    ],
}
# checked BEFORE the criterion-specific list
PRE_BUCKETS = [
    ("rubric score line, little/no justification",
     r"^(task\s*(achievement|response)|cohesion|coherence|vocabulary|lexical|grammar|grammatical)"
     r"[^:]{0,24}:\s*\d[\d\s./=+-]*$"),
]
# checked AFTER, so a specific error type always wins
POST_BUCKETS = [
    ("praise / positive confirmation",
     r"\b(good|great|excellent|perfect|nice|well done|clear|strong|accurate|keep it up|"
     r"impressive|very clear|no problem|fine)\b"),
]
ERROR_TYPES = {
    k: [(n, re.compile(p, re.I)) for n, p in PRE_BUCKETS]
       + [(n, re.compile(p, re.I)) for n, p in v]
       + [(n, re.compile(p, re.I)) for n, p in POST_BUCKETS]
    for k, v in ERROR_TYPES.items()
}

BAND_KEYS = ["5.5", "6", "6.5", "7", "7.5"]


def band_of(rec):
    b = rec.get("bandFromFilename") or rec.get("bandFromSummary")
    if not b:
        return None
    b = b.rstrip("0").rstrip(".") if "." in b else b
    return b


JUSTIFY_RE = re.compile(
    r"(this (is|would be|puts|keeps) (a |an )?\d|drops? (it|you|your score) to|"
    r"limits? (your|the) score|prevents? (an?|the) \d|to get (a |to )?\d|"
    r"for a \d|\d/\d|band \d|would be a \d|gives? you (a )?\d|because|so your .* score)",
    re.I)


def main():
    recs = json.load(open(CORPUS))
    rows = []
    for r in recs:
        for c in r["comments"]:
            if c.get("wordArtifact"):
                continue
            crit, reason = classify(c["text"], c["kind"])
            rows.append({
                "pdf": r["sourcePdf"],
                "band": band_of(r),
                "kind": c["kind"],
                "text": c["text"],
                "anchor": c.get("anchoredText", ""),
                "criterion": crit,
                "reason": reason,
            })

    out = {}
    total = len(rows)
    out["total_comments"] = total
    out["scripts"] = len(recs)
    out["by_criterion"] = {}
    for crit, n in Counter(r["criterion"] for r in rows).most_common():
        out["by_criterion"][crit] = {"count": n, "pct": round(100 * n / total, 1)}
    out["by_kind"] = dict(Counter(r["kind"] for r in rows))
    out["non_assessable_reasons"] = dict(Counter(r["reason"] for r in rows if r["criterion"] == "non_assessable"))

    # recurring error types
    out["error_types"] = {}
    for crit, pats in ERROR_TYPES.items():
        sub = [r for r in rows if r["criterion"] == crit]
        buckets = defaultdict(list)
        for r in sub:
            hit = False
            for name, rx in pats:
                if rx.search(r["text"]):
                    buckets[name].append(r["text"])
                    hit = True
                    break
            if not hit:
                if r["reason"] == "bare_rewrite_suggestion":
                    buckets["suggested upgrade wording (bare rewrite)"].append(r["text"])
                else:
                    buckets["other / unbucketed"].append(r["text"])
        out["error_types"][crit] = [
            {"type": k, "count": len(v), "pct_of_criterion": round(100 * len(v) / max(1, len(sub)), 1),
             "examples": v[:3]}
            for k, v in sorted(buckets.items(), key=lambda kv: -len(kv[1]))
        ]

    # per script counts, by band
    per_pdf = Counter(r["pdf"] for r in rows)
    band_of_pdf = {r["sourcePdf"]: band_of(r) for r in recs}
    out["comments_per_script"] = {}
    allc = sorted(per_pdf.values())
    out["comments_per_script"]["ALL"] = {
        "n_scripts": len(per_pdf), "min": min(allc), "median": statistics.median(allc),
        "max": max(allc), "mean": round(statistics.mean(allc), 1)}
    for b in BAND_KEYS:
        vals = sorted(v for k, v in per_pdf.items() if band_of_pdf.get(k) == b)
        if vals:
            out["comments_per_script"][f"band-{b}"] = {
                "n_scripts": len(vals), "min": min(vals), "median": statistics.median(vals),
                "max": max(vals), "mean": round(statistics.mean(vals), 1)}

    # focus shift by band (criterion mix per band, margin/inline only = the "findings")
    out["focus_by_band"] = {}
    for b in BAND_KEYS:
        sub = [r for r in rows if r["band"] == b and r["kind"] != "summary"]
        if not sub:
            continue
        c = Counter(r["criterion"] for r in sub)
        out["focus_by_band"][f"band-{b}"] = {
            "n_comments": len(sub),
            "mix_pct": {k: round(100 * v / len(sub), 1) for k, v in c.most_common()},
        }
    # praise vs problem ratio by band
    PRAISE = re.compile(r"\b(good|great|excellent|nice|perfect|well done|clear|strong|keep it up|"
                        r"very good|fine|better|impressive|love it)\b", re.I)
    PROBLEM = re.compile(r"\b(weak|wrong|error|mistake|不|not |don.t|doesn.t|no |avoid|too |unclear|"
                         r"confus|missing|need|should|must|try to|careful|problem|issue)\b", re.I)
    out["tone_by_band"] = {}
    for b in BAND_KEYS:
        sub = [r for r in rows if r["band"] == b and r["kind"] != "summary"]
        if not sub:
            continue
        p = sum(1 for r in sub if PRAISE.search(r["text"]))
        q = sum(1 for r in sub if PROBLEM.search(r["text"]) and not PRAISE.search(r["text"]))
        out["tone_by_band"][f"band-{b}"] = {
            "praise_pct": round(100 * p / len(sub), 1),
            "problem_only_pct": round(100 * q / len(sub), 1),
            "median_words_per_comment": statistics.median([len(r["text"].split()) for r in sub]),
        }

    # band justification phrasing
    just = [r["text"] for r in rows if JUSTIFY_RE.search(r["text"]) and re.search(r"\d", r["text"])]
    out["justification_examples"] = just[:60]
    out["justification_count"] = len(just)

    # summary rows verbatim (the ground-truth "why this band")
    out["summary_rows_sample"] = [r["text"] for r in rows if r["kind"] == "summary"][:40]

    json.dump(out, open(OUT / "analysis-examiner.json", "w"), ensure_ascii=False, indent=1)
    json.dump(rows, open(OUT / "classified-comments.json", "w"), ensure_ascii=False, indent=1)
    print(json.dumps({k: v for k, v in out.items()
                      if k in ("total_comments", "scripts", "by_criterion", "by_kind",
                               "comments_per_script", "focus_by_band", "tone_by_band",
                               "non_assessable_reasons")}, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
