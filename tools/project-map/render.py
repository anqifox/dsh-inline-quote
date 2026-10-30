#!/usr/bin/env python3
"""Minimal observable project-map builder: authored records, checked references, Graphviz."""
import argparse
import copy
import json
import os
from pathlib import Path
import re
import subprocess
import sys


class Invalid(ValueError):
    pass


def check(value, message):
    if not value:
        raise Invalid(message)


def git(root, *args):
    p = subprocess.run(["git", *args], cwd=root, capture_output=True, text=True)
    check(p.returncode == 0, "git error: " + " ".join(args) + " " + p.stderr[:180])
    return p.stdout.strip()


def anchor(ref, root, repo, revision):
    check(isinstance(ref, dict), "source must be object")
    path, needle = ref.get("path"), ref.get("needle")
    check(isinstance(path, str) and isinstance(needle, str) and needle, "invalid source")
    file = (root / path).resolve()
    check(file.is_relative_to(root.resolve()) and file.is_file(), "missing source " + path)
    check(path in git(root, "ls-files", "--", path).splitlines(), "untracked source " + path)
    matches = [i + 1 for i, line in enumerate(file.read_text(encoding="utf-8").splitlines()) if needle in line]
    check(len(matches) == 1, "source anchor is missing or ambiguous " + path + " " + needle)
    url = "https://github.com/" + repo + "/blob/" + revision + "/" + path + "#L" + str(matches[0])
    return {"path": path, "line": matches[0], "url": url}


def validate(data, root, repo, revision):
    check(data.get("schema") == 1, "unsupported schema")
    groups, nodes, edges, notes = [data.get(k) for k in ("groups", "nodes", "edges", "annotations")]
    check(all(isinstance(v, list) for v in (groups, nodes, edges, notes)), "missing collections")
    gid = [g["id"] for g in groups]
    nid = [n["id"] for n in nodes]
    aid = [a["id"] for a in notes]
    for name, values in (("groups", gid), ("nodes", nid), ("annotations", aid)):
        check(len(values) == len(set(values)), "duplicate ID in " + name)
    sources, edges_proven, refs = {}, {}, {}
    for n in nodes:
        ident = n["id"]
        check(n.get("group") in gid, ident + " unknown group")
        check(n.get("kind") in ("action", "decision", "integration", "data"), ident + " invalid kind")
        check(isinstance(n.get("does"), str) and n["does"], ident + " missing behavior")
        check(isinstance(n.get("capabilities"), list) and bool(n["capabilities"]), ident + " missing capabilities")
        check(n.get("verification") in ("source-inspected", "unverified"), ident + " invalid verification")
        if n.get("source"):
            sources[ident] = anchor(n["source"], root, repo, revision)
        else:
            check(n["verification"] == "unverified", ident + " source-inspected without source")
    for i, e in enumerate(edges):
        check(e.get("from") in nid and e.get("to") in nid, "edge " + str(i) + " has unknown node")
        check(e.get("type") in ("call", "event", "data", "dependency", "output"), "edge type invalid")
        edges_proven[str(i)] = anchor(e["source"], root, repo, revision) if e.get("source") else None
    for a in notes:
        ident = a["id"]
        check(a.get("target") in nid, ident + " target missing")
        check(a.get("type") in ("observation", "attempt", "decision", "question"), ident + " type invalid")
        check(isinstance(a.get("text"), str) and a["text"], ident + " empty text")
        check(isinstance(a.get("refs"), list) and a["refs"], ident + " no evidence")
        links = []
        for ref in a["refs"]:
            if ref.get("kind") == "code":
                links.append(anchor(ref, root, repo, revision)["url"])
            elif ref.get("kind") == "commit":
                sha = ref.get("sha", "")
                check(re.fullmatch("[0-9a-f]{40}", sha) is not None, ident + " invalid SHA")
                git(root, "cat-file", "-e", sha + "^{commit}")
                links.append("https://github.com/" + repo + "/commit/" + sha)
            else:
                raise Invalid(ident + " unsupported evidence kind")
        refs[ident] = links
    return {
        "nodes": sources, "edges": edges_proven, "annotations": refs,
        "counts": {k: len(data[k]) for k in ("groups", "nodes", "edges", "annotations")},
        "source_backed_edges": sum(x is not None for x in edges_proven.values()),
        "declared_only_edges": sum(x is None for x in edges_proven.values()),
        "resolved_evidence": sum(map(len, refs.values())),
    }


def quote(s):
    return json.dumps(str(s), ensure_ascii=False)


def dot(data, results):
    records = {a["target"]: 0 for a in data["annotations"]}
    for a in data["annotations"]:
        records[a["target"]] += 1
    lines = ['digraph Map {', 'graph [rankdir=LR, bgcolor=white, compound=true, nodesep=.55, ranksep=.9];',
             'node [fontname="Noto Sans CJK SC", shape=box, style="rounded,filled", color="#64748b", fillcolor="#f8fafc"];',
             'edge [fontname="Noto Sans CJK SC", fontsize=10, arrowsize=.65];']
    for group in data["groups"]:
        lines += ["subgraph " + quote("cluster_" + group["id"]) + " {",
                  "label=" + quote(group["title"]) + '; color="#cbd5e1"; style=rounded;']
        for n in data["nodes"]:
            if n["group"] != group["id"]:
                continue
            label = n["title"] + ("\n〔注记 " + str(records[n["id"]]) + "〕" if n["id"] in records else "")
            src = results["nodes"].get(n["id"])
            lines.append(quote(n["id"]) + " [label=" + quote(label) +
                         (', shape=diamond' if n["kind"] == "decision" else "") +
                         (', style="dashed,filled"' if n["verification"] == "unverified" else "") +
                         (", URL=" + quote(src["url"]) if src else "") + "];")
        lines.append("}")
    for i, e in enumerate(data["edges"]):
        lines.append(quote(e["from"]) + " -> " + quote(e["to"]) +
                     " [label=" + quote(e.get("label", e["type"])) +
                     (", style=dashed" if results["edges"][str(i)] is None else "") + "];")
    return "\n".join(lines + ["}"]) + "\n"


def notes(data, results, repo, sha):
    lines = ["# Project Map: " + data["project"], "",
             "Generated from explicit records at " + sha + ".",
             "Source-inspected does NOT imply live-tested; dashed relations are declarations.", "",
             "## Observations", "",
             "| Item | Count |", "| --- | ---: |"]
    for key, value in results["counts"].items():
        lines.append("| " + key + " | " + str(value) + " |")
    for key in ("source_backed_edges", "declared_only_edges", "resolved_evidence"):
        lines.append("| " + key + " | " + str(results[key]) + " |")
    lines += ["", "## Nodes", ""]
    for n in data["nodes"]:
        s = results["nodes"].get(n["id"])
        lines += ["### " + n["title"] + " (" + n["id"] + ")", "", n["does"], "",
                  "Capabilities: " + "; ".join(n["capabilities"]), "",
                  "Evidence state: " + n["verification"] + (", [source](" + s["url"] + ")" if s else ""), ""]
    lines += ["## Edges", ""]
    for i, e in enumerate(data["edges"]):
        s = results["edges"][str(i)]
        lines.append("- " + e["from"] + " → " + e["to"] + " [" + e["type"] + "] " +
                     e.get("label", "") + (" [source](" + s["url"] + ")" if s else " (declaration only)"))
    lines += ["", "## Annotations: independent evidence and attempts", ""]
    for a in data["annotations"]:
        links = results["annotations"][a["id"]]
        lines += ["### " + a["id"] + " [" + a["type"] + "]", "",
                  "Target: " + a["target"], "", a["text"], "",
                  "References: " + " · ".join("[reference " + str(i + 1) + "](" + x + ")"
                                          for i, x in enumerate(links)), ""]
    return "\n".join(lines) + "\n"


def self_test(data, root, repo, sha):
    validate(data, root, repo, sha)
    cases = [
        ("dangling-edge", lambda x: x["edges"][0].update({"to": "missing.node"})),
        ("bad-note-target", lambda x: x["annotations"][0].update({"target": "missing.node"})),
        ("bad-source", lambda x: x["nodes"][0]["source"].update({"needle": "NO_SUCH_SOURCE_SYMBOL_987"})),
        ("bad-commit", lambda x: x["annotations"][0]["refs"][0].update({"sha": "0" * 40})),
        ("duplicate-node", lambda x: x["nodes"].append(copy.deepcopy(x["nodes"][0]))),
    ]
    for name, mutate in cases:
        broken = copy.deepcopy(data)
        mutate(broken)
        try:
            validate(broken, root, repo, sha)
        except Invalid:
            print("EXPECTED_REJECTION " + name)
        else:
            raise Invalid("failed to reject " + name)
    print("SELF_TEST_PASS: valid input + " + str(len(cases)) + " expected rejections")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", default=".project-map/map.json")
    p.add_argument("--output", default="project-map-output")
    p.add_argument("--self-test", action="store_true")
    args = p.parse_args()
    root = Path.cwd()
    repo = os.getenv("GITHUB_REPOSITORY", "anqifox/dsh-inline-quote")
    sha = git(root, "rev-parse", "HEAD")
    data = json.loads(Path(args.input).read_text(encoding="utf-8"))
    if args.self_test:
        self_test(data, root, repo, sha)
        return
    results = validate(data, root, repo, sha)
    folder = Path(args.output)
    folder.mkdir(parents=True, exist_ok=True)
    (folder / "overview.dot").write_text(dot(data, results), encoding="utf-8")
    (folder / "notes.md").write_text(notes(data, results, repo, sha), encoding="utf-8")
    proc = subprocess.run(["dot", "-Tsvg", str(folder / "overview.dot"), "-o", str(folder / "overview.svg")],
                          capture_output=True, text=True)
    check(proc.returncode == 0, "dot failed: " + proc.stderr[:400])
    report = {"state": "validated", "repository": repo, "revision": sha,
              "records": args.input, "measurements": results,
              "notice": "Only source anchors and commit objects checked. No DSH runtime test."}
    (folder / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("BUILD_PASS " + json.dumps({"sha": sha[:12], **results["counts"],
                                      "verified_edges": results["source_backed_edges"],
                                      "declared_edges": results["declared_only_edges"]}, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except (Invalid, OSError, ValueError, KeyError) as error:
        print("BUILD_FAIL " + str(error), file=sys.stderr)
        sys.exit(1)
