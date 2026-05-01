#!/usr/bin/env python3
import csv
import html
import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/Users/yousif/Downloads/wc-product-export-18-4-2026-1776483478626.csv")
CATALOG_PATH = ROOT / "src/data/catalog.ts"
OUT_PATH = ROOT / "src/data/catalogCsvAdditions.ts"


def slugify(value: str) -> str:
    value = html.unescape(value).lower()
    value = re.sub(r"<[^>]+>", " ", value)
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-") or "product"


def strip_html(value: str) -> str:
    value = html.unescape(value or "")
    value = re.sub(r"<br\s*/?>", " ", value, flags=re.I)
    value = re.sub(r"</(p|div|li|h[1-6]|ul|ol)>", " ", value, flags=re.I)
    value = re.sub(r"<[^>]+>", " ", value)
    value = value.replace("\\r", " ").replace("\\n", " ")
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def norm(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", html.unescape(value).lower())


def category_from(raw: str) -> str:
    lower = (raw or "").lower()
    if "headphone" in lower:
        return "headphones"
    if "iem" in lower:
        return "iems"
    if "dap" in lower:
        return "dap"
    if "dac" in lower or "amp" in lower:
        return "dac"
    if "microphone" in lower or "mic" in lower:
        return "mic"
    if "interface" in lower:
        return "audio-interface"
    if "accessorie" in lower or "accessory" in lower or "eartips" in lower or "cable" in lower:
        return "accessories"
    return "accessories"


def sub_categories(raw: str) -> list[str]:
    parts = []
    for item in (raw or "").split(","):
        leaf = item.split(">")[-1].strip()
        key = slugify(leaf)
        if key and key not in {"iem", "dac-amp", "accessories", "headphone", "headphones"}:
            parts.append(key)
    return sorted(set(parts))


def brand_name(row: dict[str, str]) -> str:
    brand = (row.get("Brands") or "").strip()
    fixes = {
        "7hz": "7Hz",
        "MOONDROP": "Moondrop",
        "SIMGOT": "SIMGOT",
        "TRUTHEAR": "TRUTHEAR",
        "DUNU": "DUNU",
        "JCALLY": "JCALLY",
        "JUZEAR": "JUZEAR",
    }
    return fixes.get(brand, brand or "EDIO")


def variation_base(value: str) -> str:
    text = strip_html(value)
    return re.split(r"\s+-\s+", text, maxsplit=1)[0].strip()


def numeric_price(value: str) -> int | None:
    if not value:
        return None
    try:
        return int(float(value))
    except ValueError:
        return None


def product_from_row(row: dict[str, str], variation_prices: dict[str, list[int]]) -> dict:
    product_id = row["ID"].strip()
    name = strip_html(row["Name"])
    prices = [
        p
        for p in [
            numeric_price(row.get("Sale price", "")),
            numeric_price(row.get("Regular price", "")),
            *variation_prices.get(norm(name), []),
        ]
        if p is not None
    ]
    images = [item.strip() for item in (row.get("Images") or "").split(",") if item.strip()]
    description = strip_html(row.get("Short description") or row.get("Description") or "")
    tagline = description[:180]
    attr_name = strip_html(row.get("Attribute 1 name") or "")
    attr_values = [strip_html(v) for v in (row.get("Attribute 1 value(s)") or "").split(",") if strip_html(v)]
    features = []
    if attr_name and attr_values:
        features.append(f"{attr_name}: {', '.join(attr_values)}")
    if description:
        sentences = re.split(r"(?<=[.!?])\s+", description)
        features.extend([s[:180] for s in sentences if len(s) > 20][:4])

    return {
        "id": product_id,
        "slug": f"{slugify(name)}-{product_id}",
        "name": {"en": name, "ar": name},
        "brand": brand_name(row),
        "category": category_from(row.get("Categories", "")),
        "subCategories": sub_categories(row.get("Categories", "")),
        "tagline": {"en": tagline, "ar": tagline},
        "price": min(prices) if prices else 0,
        "compareAt": None,
        "currency": "IQD",
        "image": images[0] if images else "/placeholder.svg",
        "gallery": images or ["/placeholder.svg"],
        "badge": None,
        "features": features[:6],
        "specs": [],
        "inStock": bool(prices),
    }


def ts(value) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2)


def main() -> None:
    catalog = CATALOG_PATH.read_text()
    existing_ids = set(re.findall(r'\n\s*id: "([^"]+)"', catalog))
    existing_slugs = set(re.findall(r'\n\s*slug: "([^"]+)"', catalog))
    existing_names = {norm(match) for match in re.findall(r'name: \{ en: "((?:[^"\\]|\\.)*)"', catalog)}

    with CSV_PATH.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))

    variation_prices: dict[str, list[int]] = {}
    for row in rows:
        if row.get("Type") != "variation":
            continue
        price = numeric_price(row.get("Sale price", "")) or numeric_price(row.get("Regular price", ""))
        if price is None:
            continue
        variation_prices.setdefault(norm(variation_base(row.get("Name", ""))), []).append(price)

    additions = []
    seen_names = set(existing_names)
    seen_ids = set(existing_ids)
    seen_slugs = set(existing_slugs)
    for row in rows:
        if row.get("Type") == "variation":
            continue
        if row.get("ID") in seen_ids:
            continue
        product = product_from_row(row, variation_prices)
        name_key = norm(product["name"]["en"])
        if name_key in seen_names or product["slug"] in seen_slugs:
            continue
        additions.append(product)
        seen_ids.add(product["id"])
        seen_slugs.add(product["slug"])
        seen_names.add(name_key)

    body = [
        "// AUTO-GENERATED from WooCommerce CSV additions. Do not hand-edit; rerun scripts/import_wc_csv_additions.py.",
        'import type { Product } from "./catalog";',
        "",
        f"export const csvProductAdditions: Product[] = {ts(additions)};",
        "",
    ]
    OUT_PATH.write_text("\n".join(body))
    print(f"generated {len(additions)} additions at {OUT_PATH}")


if __name__ == "__main__":
    main()
