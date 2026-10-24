"""Verify the approved archive and stage a private import manifest; never publish."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import zipfile


def sha(data):
    return hashlib.sha256(data).hexdigest()


def prepare(archive, output):
    output = output.resolve()
    repository = Path(__file__).resolve().parents[1]
    if output.is_relative_to(repository):
        raise ValueError("Source staging must stay outside the repository")
    if output.exists():
        raise ValueError("Output must be new; do not overwrite a prior source snapshot")
    with zipfile.ZipFile(archive) as bundle:
        names = bundle.namelist()
        if sum(info.file_size for info in bundle.infolist()) > 200_000_000:
            raise ValueError("Unexpected archive size")
        if len(names) != len(set(names)):
            raise ValueError("Duplicate ZIP entries")
        for info in bundle.infolist():
            path = PurePosixPath(info.filename)
            if path.is_absolute() or ".." in path.parts or "\\" in info.filename or (info.external_attr >> 16) & 0o170000 == 0o120000:
                raise ValueError("Unsafe ZIP entry")
        manifest = json.loads(bundle.read("定稿清單.json"))
        expected = manifest["檔案"]
        if manifest["章數"] != 14 or manifest["圖片數"] != 14:
            raise ValueError("Unexpected source structure")
        if set(names) != {entry["path"] for entry in expected} | {"定稿清單.json"}:
            raise ValueError("Unlisted or missing source file")
        for entry in expected:
            data = bundle.read(entry["path"])
            if len(data) != entry["bytes"] or sha(data) != entry["sha256"]:
                raise ValueError("Source manifest hash mismatch: " + entry["path"])
        chapters = sorted(name for name in names if re.fullmatch(r"chapters/\d{2}_.+\.md", name))
        images = sorted(name for name in names if re.fullmatch(r"章節插圖/CH\d{2}_.+\.png", name))
        if len(chapters) != 14 or len(images) != 14 or len({sha(bundle.read(name)) for name in images}) != 14:
            raise ValueError("Expected 14 distinct chapters/images")
        rows = []
        full_text = bundle.read("她沒有說好的那一晚_正文.md").decode("utf-8")
        full_chapters = re.split(r"(?m)^## ", full_text)[1:]
        if len(full_chapters) != 14:
            raise ValueError("Unexpected aggregate manuscript headings")
        prepared_bodies = []
        for number, (chapter, image) in enumerate(zip(chapters, images), 1):
            if not chapter.startswith(f"chapters/{number:02}_") or not image.startswith(f"章節插圖/CH{number:02}_"):
                raise ValueError("Non-contiguous chapter/image numbering")
            if Path(chapter).stem[3:] != Path(image).stem[5:]:
                raise ValueError("Chapter/image title mismatch")
            text = bundle.read(chapter).decode("utf-8")
            first, _, body = text.partition("\n")
            if not first.startswith("# ") or not body.strip():
                raise ValueError("Missing chapter heading/body")
            aggregate_heading, _, aggregate_body = full_chapters[number - 1].partition("\n")
            aggregate_body = re.sub(r"\n\n---\s*$", "", aggregate_body.strip()).strip()
            # Chapter 1 additionally contains a local-only image reference and end marker.
            # Remove ONLY those known layout artifacts, then require exact narrative equality.
            normalized = re.sub(r"\n\n!\[[^\]]*\]\(<[^\n]+>\)", "", body).strip()
            normalized = re.sub(r"\n\n——第一章完——$", "", normalized).strip()
            if normalized != aggregate_body or aggregate_heading.strip() != first[2:].strip():
                raise ValueError("Narrative differs between chapter and aggregate source: " + chapter)
            body = aggregate_body
            prepared_bodies.append(body)
            rows.append({"number": number, "title": first[2:].strip(), "sourcePath": chapter,
                         "sourceSha256": sha(bundle.read(chapter)), "imagePath": image,
                         "imageSha256": sha(bundle.read(image)), "bodyPath": f"prepared/{number:02}.txt", "bodySha256": sha(body.encode()),
                         "nonWhitespaceCharacters": len(re.sub(r"\s", "", body))})
        if sum(row["nonWhitespaceCharacters"] for row in rows) != manifest["正文不含空白字元"]:
            raise ValueError("Prepared narrative character count differs from approved manifest")
        # Binary/source extraction is deliberately outside the repository and public tree.
        if "public" in output.parts or ".git" in output.parts:
            raise ValueError("Output must be private")
        output.mkdir(mode=0o700, parents=True)
        for name in chapters + images + ["定稿清單.json"]:
            target = output / name
            target.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
            target.write_bytes(bundle.read(name))
            target.chmod(0o600)
        (output / "prepared").mkdir(mode=0o700)
        for number, body in enumerate(prepared_bodies, 1):
            target = output / f"prepared/{number:02}.txt"
            target.write_text(body)
            target.chmod(0o600)
        result = {"status": "verified-private-staging-not-imported", "sourceDriveId": "1kRDL0Nx4XTjpSZBiNtCPPkLFQLGzRmjg",
                  "sourceModifiedAt": "2026-10-23T23:12:16.648Z", "archiveSha256": sha(archive.read_bytes()),
                  "sourceTitle": "她沒有說好的那一晚", "websiteTitle": "她沒有說好的那一夜", "author": "生涯擺渡人 Max",
                  "verifiedFileCount": len(expected), "chapters": rows, "notifySubscribers": False, "isHidden": True}
        target = output / "import-manifest.json"
        target.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
        target.chmod(0o600)
        return {"passed": True, "filesVerified": len(expected), "chapters": len(rows), "distinctImages": len(images),
                "bodyNonWhitespaceCharacters": sum(row["nonWhitespaceCharacters"] for row in rows), "manifest": str(target)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("archive", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    print(json.dumps(prepare(args.archive, args.output), ensure_ascii=False))
