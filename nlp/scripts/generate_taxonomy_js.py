"""Generate the dashboard's taxonomy label map from taxonomy.yaml.

The dashboard renders taxonomy ids (ACT_*, HAZ_*, LSR_*, BAR_*, ...) that come
back inside a report's fingerprint. Showing the raw id to an HSE officer is
not useful, so this script emits a plain JS file mapping every id to its
human label.

`label` in taxonomy.yaml is explicitly editable (see the RULES header there),
so this file is GENERATED, never hand-edited: re-run it whenever the taxonomy
changes.

    python nlp/scripts/generate_taxonomy_js.py

Writes dashboard/taxonomy-labels.js.
"""

from pathlib import Path
import json
import sys

import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
TAXONOMY_PATH = REPO_ROOT / "nlp" / "taxonomy" / "taxonomy.yaml"
OUTPUT_PATH = REPO_ROOT / "dashboard" / "taxonomy-labels.js"

# Every top-level key whose value is a list of {id, label} entries. `version`
# is a scalar and is carried through separately.
GROUP_KEYS = [
    "life_saving_rules",
    "failure_modes",
    "barrier_categories",
    "barriers",
    "hazards",
    "activities",
    "exposures",
    "consequences",
    "severity_bands",
    "context_flags",
    "location_levels",
]


def collect_labels(taxonomy):
    """Flatten every group into one id -> label map.

    Ids are globally unique by prefix convention, so one flat map is enough
    and saves the dashboard having to know which group a given id came from.
    """
    labels = {}
    duplicates = []

    for key in GROUP_KEYS:
        entries = taxonomy.get(key)

        if not entries:
            print(f"warning: taxonomy.yaml has no '{key}' section", file=sys.stderr)
            continue

        for entry in entries:
            entry_id = entry.get("id")
            label = entry.get("label")

            if not entry_id:
                print(f"warning: entry in '{key}' has no id: {entry!r}", file=sys.stderr)
                continue

            if not label:
                print(f"warning: {entry_id} has no label, skipping", file=sys.stderr)
                continue

            if entry_id in labels and labels[entry_id] != label:
                duplicates.append(entry_id)

            labels[entry_id] = label

    if duplicates:
        raise SystemExit(
            "taxonomy.yaml has conflicting labels for: " + ", ".join(sorted(set(duplicates)))
        )

    return dict(sorted(labels.items()))


def render(version, labels):
    body = json.dumps(labels, indent=4, ensure_ascii=False)
    # Re-indent the JSON body to sit inside the assignment.
    body = "\n".join(
        ("    " + line if index else line)
        for index, line in enumerate(body.splitlines())
    )

    return f'''// GENERATED FILE - DO NOT EDIT.
// Source: nlp/taxonomy/taxonomy.yaml (taxonomy version {version})
// Regenerate with: python nlp/scripts/generate_taxonomy_js.py
//
// Maps every taxonomy id to its human label, so no raw ACT_*/HAZ_*/LSR_* id
// ever reaches the screen.

window.SanketakTaxonomy = {{
    version: "{version}",

    labels: {body},

    // Returns the human label for a taxonomy id. An id with no entry is
    // returned unchanged rather than blanked — a visible unknown id is a bug
    // report, a blank is a silent loss.
    label: function (id) {{
        if (!id) {{
            return "";
        }}

        return window.SanketakTaxonomy.labels[id] || String(id);
    }},

    labelList: function (ids) {{
        if (!Array.isArray(ids)) {{
            return [];
        }}

        return ids.map(window.SanketakTaxonomy.label);
    }}
}};
'''


def main():
    taxonomy = yaml.safe_load(TAXONOMY_PATH.read_text(encoding="utf-8"))
    version = taxonomy.get("version", "unknown")
    labels = collect_labels(taxonomy)

    OUTPUT_PATH.write_text(render(version, labels), encoding="utf-8")
    print(f"wrote {OUTPUT_PATH.relative_to(REPO_ROOT)} ({len(labels)} labels, taxonomy v{version})")


if __name__ == "__main__":
    main()
