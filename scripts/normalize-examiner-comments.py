#!/usr/bin/env python3
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path.cwd()
CORPUS_DIR = ROOT / "tmp" / "marked-script-comment-corpus"
INPUT = CORPUS_DIR / "final-comment-rows.jsonl"


CRITERIA_PATTERNS = {
    "TR": [
        r"\btask response\b",
        r"\btask achievement\b",
        r"\bTR\b",
        r"\bquestion\b",
        r"\btopic\b",
        r"\baddress(?:ed|es|ing)?\b",
        r"\bopinion\b",
        r"\bposition\b",
        r"\bmain idea\b",
        r"\bclaim\b",
        r"\btoo general\b",
        r"\btoo specific\b",
        r"\btoo extreme\b",
        r"\bstrong claim\b",
        r"\bweak claim\b",
        r"\bbe more specific\b",
        r"\bspecific detail\b",
        r"\brealistic scenario\b",
        r"\bmake sense\b",
        r"\bargument\b",
        r"\bdevelop(?:ed|ment|ing)?\b",
        r"\bsupport(?:ed|ing)?\b",
        r"\brelevant\b",
        r"\birrelevant\b",
        r"\bexample\b",
        r"\bside\b",
        r"\bextent\b",
        r"\bconclusion\b",
    ],
    "CC": [
        r"\bcohesion\b",
        r"\bcoherence\b",
        r"\bC&C\b",
        r"\bCC\b",
        r"\bparagraph(?:ing|s)?\b",
        r"\btopic sentence\b",
        r"\bfinal thought\b",
        r"\blink(?:ing|s)?\b",
        r"\breferencing\b",
        r"\bsubstitution\b",
        r"\bflow\b",
        r"\blogical\b",
        r"\bsequence\b",
        r"\border\b",
        r"\boverlap\b",
        r"\brepetition\b",
        r"\bredundant\b",
        r"\btransition\b",
        r"\bfollows logically\b",
    ],
    "LR": [
        r"\bvocab(?:ulary)?\b",
        r"\blexis\b",
        r"\blexical\b",
        r"\bcollocation\b",
        r"\bword choice\b",
        r"\bword\b",
        r"\bcollocations?\b",
        r"\bparaphrase\b",
        r"\bformal\b",
        r"\binformal\b",
        r"\bacademic\b",
        r"\bcontractions?\b",
        r"\bidiom\b",
        r"\bphrase\b",
        r"\bmeaning\b",
        r"\bvague\b",
        r"\bless common\b",
    ],
    "GRA": [
        r"\bgrammar\b",
        r"\bGRA\b",
        r"\bsentence structure\b",
        r"\bsentence structures\b",
        r"\bstructures\b",
        r"\btoo long\b",
        r"\brun-on\b",
        r"\bwordy\b",
        r"\btense\b",
        r"\bpast simple\b",
        r"\bpresent simple\b",
        r"\bpresent perfect\b",
        r"\bpresent continuous\b",
        r"\bconditional\b",
        r"\bmodal\b",
        r"\barticle\b",
        r"\bcapital letter\b",
        r"\bsemi colons?\b",
        r"\bsemicolon\b",
        r"\bpunctuation\b",
        r"\bclause\b",
        r"\bpreposition\b",
        r"\bsingular\b",
        r"\bplural\b",
        r"\bverb\b",
        r"\bsubject\b",
        r"\bobject\b",
        r"\bagreement\b",
        r"\bstative\b",
        r"\btransitive\b",
        r"\bcountable\b",
        r"\buncountable\b",
        r"\bnoun clause\b",
        r"\badjective clause\b",
    ],
}

ISSUE_PATTERNS = {
    "prompt_coverage": [r"\ball parts?\b", r"\bquestion\b", r"\btopic\b", r"\bdirectly addresses\b", r"\bnot covered\b"],
    "position": [r"\bopinion\b", r"\bposition\b", r"\bstance\b", r"\bconsistent\b", r"\bcontradict\b"],
    "development": [r"\bdevelop", r"\bfully\b", r"\bone sentence only\b", r"\bsupport", r"\bexpand\b", r"\bweak argument\b", r"\bmore detail\b", r"\bbe more specific\b", r"\btoo general\b"],
    "relevance": [r"\brelevant\b", r"\birrelevant\b", r"\bfocus\b", r"\bswitch(?:es|ing)?\b", r"\bother side\b", r"\bnot the topic\b", r"\boff topic\b"],
    "example_support": [r"\bexample\b", r"\bspecific example\b", r"\bevidence\b"],
    "topic_sentence": [r"\btopic sentence\b", r"\bfirst sentence\b", r"\bmain idea\b"],
    "paragraph_focus": [r"\bparagraph\b", r"\bsingle idea\b", r"\blump\b", r"\boverlap\b"],
    "progression_order": [r"\border\b", r"\bsequence\b", r"\bfollows logically\b", r"\blogical progression\b", r"\bflow\b"],
    "cohesion_linking": [r"\blink(?:ing|s)?\b", r"\btransition\b", r"\bconnect(?:ion|ing)?\b"],
    "referencing_substitution": [r"\breferencing\b", r"\bsubstitution\b", r"\bit refers\b", r"\bthis refers\b"],
    "lexical_choice": [r"\bword choice\b", r"\bwrong word\b", r"\bword\b", r"\bmeaning\b", r"\bcollocations?\b", r"\blexis\b", r"\bmade up phrases\b"],
    "register": [r"\bformal\b", r"\binformal\b", r"\bacademic\b", r"\bcontractions?\b", r"\bpejorative\b", r"\bderogatory\b"],
    "grammar_accuracy": [r"\bgrammar\b", r"\btense\b", r"\barticle\b", r"\bmodal\b", r"\bpreposition\b", r"\bagreement\b", r"\bplural\b", r"\bsingular\b", r"\bpast simple\b", r"\bpresent simple\b", r"\bpresent perfect\b", r"\bpresent continuous\b", r"\bconditional\b", r"\bcapital letter\b", r"\bcountable\b", r"\buncountable\b"],
    "sentence_control": [r"\bsentence\b", r"\bclause\b", r"\btoo long\b", r"\brun-on\b", r"\bwordy\b", r"\bcomplex\b", r"\bpunctuation\b", r"\bsemi colons?\b", r"\bsemicolon\b"],
    "score_or_band": [r"\bband score\b", r"\boverall\b", r"\btask response:\s*\d", r"\bgrammar:\s*\d", r"\bvocabulary:\s*\d"],
    "process_advice": [r"\btry to\b", r"\brecommend\b", r"\bmake sure\b", r"\bbe careful\b", r"\blook up\b", r"\bavoid\b"],
    "formatting_artifact": [r"formatted:", r"font:", r"\bunderline\b", r"\bsuperscript\b", r"\bleft:\s*\d", r"\bright:\s*\d", r"\btop:\s*\d", r"\bbottom:\s*\d"],
}

NEGATIVE_PATTERNS = [
    r"\bnot\b",
    r"\bno\b",
    r"\btoo\b",
    r"\bweak\b",
    r"\bwrong\b",
    r"\berror\b",
    r"\bmistake\b",
    r"\bcareful\b",
    r"\bdon't\b",
    r"\bdoesn'?t\b",
    r"\bneeds?\b",
    r"\bshould\b",
    r"\bavoid\b",
    r"\bconfus(?:ed|ing)\b",
    r"\bunclear\b",
    r"\bvague\b",
    r"\bwordy\b",
    r"\bawkward\b",
    r"\brun-on\b",
    r"\btoo general\b",
    r"\btoo specific\b",
    r"\btoo extreme\b",
    r"\bproblem\b",
    r"\black\b",
    r"\bmissing\b",
    r"\bnot sure\b",
    r"\bdropped to\b",
]

POSITIVE_PATTERNS = [
    r"\bgood\b",
    r"\bgreat\b",
    r"\bexcellent\b",
    r"\bclear\b",
    r"\bnice\b",
    r"\baccurate\b",
    r"\bsuitable\b",
    r"\bappropriate\b",
    r"\bwell\b",
    r"\bkeep it up\b",
    r"\bno errors\b",
]

SCORE_RE = re.compile(
    r"\b(overall|task response|task achievement|cohesion/?coherence|coherence(?: and)? cohesion|vocabulary|lexical resource|grammar|GRA|LR|TR|CC)\s*[:\-]?\s*(\d(?:\.\d)?(?:\s*/\s*\d(?:\.\d)?)?)",
    re.I,
)


def contains(patterns, text):
    return any(re.search(pattern, text, re.I) for pattern in patterns)


def classify_criteria(text, source_kind):
    tags = []
    for criterion, patterns in CRITERIA_PATTERNS.items():
        if contains(patterns, text):
            tags.append(criterion)
    lower = text.lower()
    if source_kind == "rubric_line":
        if "vocabulary" in lower:
            tags.append("LR")
        if "grammar" in lower:
            tags.append("GRA")
        if "cohesion" in lower or "coherence" in lower:
            tags.append("CC")
        if "task response" in lower or "task achievement" in lower:
            tags.append("TR")
    seen = []
    for tag in tags:
        if tag not in seen:
            seen.append(tag)
    return seen


def primary_criterion(tags, text):
    if not tags:
        return None
    lower = text.lower()
    explicit_order = [
        ("TR", ["task response", "task achievement", " tr "]),
        ("CC", ["cohesion", "coherence", " c&c ", " cc "]),
        ("LR", ["vocabulary", "lexical", " lexis ", " lr "]),
        ("GRA", ["grammar", " gra "]),
    ]
    padded = f" {lower} "
    for criterion, needles in explicit_order:
        if criterion in tags and any(needle in padded for needle in needles):
            return criterion
    return tags[0]


def classify_issue_families(text):
    families = []
    for family, patterns in ISSUE_PATTERNS.items():
        if contains(patterns, text):
            families.append(family)
    return families


def classify_polarity(text):
    lower = text.lower()
    negative = contains(NEGATIVE_PATTERNS, lower)
    positive = contains(POSITIVE_PATTERNS, lower)
    if negative and positive:
        return "mixed"
    if negative:
        return "critical"
    if positive:
        return "positive"
    if re.search(r"\b\d(?:\.\d)?\b", lower):
        return "score"
    return "neutral"


def severity_hint(text, criteria, issue_families, polarity):
    if "formatting_artifact" in issue_families:
        return "artifact"
    if polarity == "score" or "score_or_band" in issue_families and re.match(r"^\s*(overall|task response|task achievement|cohesion/?coherence|coherence|vocabulary|grammar|LR|GRA|TR|CC)\b", text, re.I):
        return "score_metadata"
    if polarity == "positive":
        return "not_an_error"
    major_families = {"prompt_coverage", "position", "development", "relevance", "paragraph_focus", "progression_order"}
    if any(family in issue_families for family in major_families):
        return "major"
    if criteria and set(criteria) <= {"LR", "GRA"}:
        return "minor_or_local"
    if polarity == "critical":
        return "medium"
    return "unknown"


def extract_scores(text):
    scores = []
    for match in SCORE_RE.finditer(text):
        scores.append({"label": match.group(1), "value": match.group(2)})
    return scores


def normalize_row(row, index):
    text = row["text"].strip()
    criteria = classify_criteria(text, row["source_kind"])
    issues = classify_issue_families(text)
    polarity = classify_polarity(text)
    return {
        "row_id": f"examiner-comment-{index:05d}",
        "source_pdf": row["source_pdf"],
        "page": row.get("page"),
        "source_kind": row["source_kind"],
        "comment_id": row.get("comment_id"),
        "text": text,
        "primary_criterion": primary_criterion(criteria, text),
        "criterion_tags": criteria,
        "polarity": polarity,
        "severity_hint": severity_hint(text, criteria, issues, polarity),
        "issue_families": issues,
        "score_mentions": extract_scores(text),
    }


def write_jsonl(path, rows):
    path.write_text("\n".join(json.dumps(row, ensure_ascii=False) for row in rows) + ("\n" if rows else ""))


def write_report(path, rows):
    by_source = defaultdict(list)
    for row in rows:
        by_source[row["source_pdf"]].append(row)

    criterion_counts = Counter(row["primary_criterion"] or "UNCLASSIFIED" for row in rows)
    polarity_counts = Counter(row["polarity"] for row in rows)
    severity_counts = Counter(row["severity_hint"] for row in rows)
    issue_counts = Counter(family for row in rows for family in row["issue_families"])
    source_counts = Counter(row["source_pdf"] for row in rows)

    chunks = ["# Examiner Comment Normalization Report", ""]
    chunks.append(f"Normalized rows: {len(rows)}")
    chunks.append(f"Sources covered: {len(by_source)}")
    chunks.append("")
    chunks.append("## Criteria")
    chunks.append("")
    for key, count in criterion_counts.most_common():
        chunks.append(f"- {key}: {count}")
    chunks.append("")
    chunks.append("## Polarity")
    chunks.append("")
    for key, count in polarity_counts.most_common():
        chunks.append(f"- {key}: {count}")
    chunks.append("")
    chunks.append("## Severity")
    chunks.append("")
    for key, count in severity_counts.most_common():
        chunks.append(f"- {key}: {count}")
    chunks.append("")
    chunks.append("## Issue Families")
    chunks.append("")
    for key, count in issue_counts.most_common():
        chunks.append(f"- {key}: {count}")
    chunks.append("")
    chunks.append("## Largest Sources")
    chunks.append("")
    for source, count in source_counts.most_common(20):
        chunks.append(f"- {count}: {source}")
    chunks.append("")
    chunks.append("## Sample Critical Rows")
    chunks.append("")
    for row in [row for row in rows if row["polarity"] in {"critical", "mixed"}][:40]:
        chunks.append(
            f"- `{row['row_id']}` `{row.get('primary_criterion') or 'UNCLASSIFIED'}` "
            f"`{row['severity_hint']}` `{row['source_pdf']}` p.{row.get('page')}: {row['text']}"
        )
    path.write_text("\n".join(chunks))


def write_by_source(path, rows):
    by_source = defaultdict(list)
    for row in rows:
        by_source[row["source_pdf"]].append(row)
    source_rows = []
    for source, items in sorted(by_source.items()):
        source_rows.append(
            {
                "source_pdf": source,
                "row_count": len(items),
                "criteria": dict(Counter(item["primary_criterion"] or "UNCLASSIFIED" for item in items)),
                "polarities": dict(Counter(item["polarity"] for item in items)),
                "severities": dict(Counter(item["severity_hint"] for item in items)),
                "issue_families": dict(Counter(family for item in items for family in item["issue_families"])),
                "score_mentions": [score for item in items for score in item["score_mentions"]],
            }
        )
    write_jsonl(path, source_rows)


def write_label_review_queue(path, rows):
    needs_review = [
        row
        for row in rows
        if (row["severity_hint"] == "unknown" and row["polarity"] not in {"score", "positive"})
        or (row["primary_criterion"] is None and row["polarity"] in {"critical", "mixed"})
    ]
    write_jsonl(path.with_suffix(".jsonl"), needs_review)
    chunks = ["# Examiner Comment Label Review Queue", ""]
    chunks.append(f"Rows needing semantic label review: {len(needs_review)}")
    chunks.append("")
    chunks.append("These rows are intentionally not forced into a criterion by heuristics. Review them before using them as hard prompt rules.")
    chunks.append("")
    for row in needs_review[:300]:
        chunks.append(
            f"- `{row['row_id']}` `{row.get('primary_criterion') or 'UNCLASSIFIED'}` "
            f"`{row['polarity']}` `{row['severity_hint']}` `{row['source_pdf']}` p.{row.get('page')}: {row['text']}"
        )
    if len(needs_review) > 300:
        chunks.append("")
        chunks.append(f"... {len(needs_review) - 300} more rows in `{path.with_suffix('.jsonl').name}`")
    path.write_text("\n".join(chunks))


def main():
    source_rows = [json.loads(line) for line in INPUT.read_text().splitlines() if line.strip()]
    normalized = [normalize_row(row, index + 1) for index, row in enumerate(source_rows)]
    write_jsonl(CORPUS_DIR / "examiner-comment-normalized.jsonl", normalized)
    write_by_source(CORPUS_DIR / "examiner-source-summary.jsonl", normalized)
    write_report(CORPUS_DIR / "examiner-comment-normalization-report.md", normalized)
    write_label_review_queue(CORPUS_DIR / "examiner-comment-label-review-queue.md", normalized)
    print(
        json.dumps(
            {
                "normalized_rows": len(normalized),
                "sources": len({row["source_pdf"] for row in normalized}),
                "criteria": Counter(row["primary_criterion"] or "UNCLASSIFIED" for row in normalized),
                "polarity": Counter(row["polarity"] for row in normalized),
                "severity": Counter(row["severity_hint"] for row in normalized),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
