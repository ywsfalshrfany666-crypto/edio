import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  normalizeProductCategory,
  productCategorySlugs,
} from "../src/lib/productCategories.ts";
import {
  countProductsForCategoryTerm,
  productMatchesCategoryTerm,
  resolveCategoryTerm,
} from "../src/lib/categoryTaxonomy.ts";

const db = JSON.parse(await readFile(new URL("../server/data/db.json", import.meta.url), "utf8"));
const existingCategories = db.categories.map((category) => category.slug);

assert.deepEqual(existingCategories, [...productCategorySlugs], "DB categories must match the storefront category source.");

const dynamicCollections = ["new", "new-arrivals", "popular", "best-sellers", "sale", "in-stock", "out-of-stock"];
for (const collection of dynamicCollections) {
  assert.equal(existingCategories.includes(collection), false, `${collection} must stay a collection, not a category.`);
}

for (const product of db.products) {
  assert.equal(
    existingCategories.includes(product.category),
    true,
    `${product.name?.en || product.id} has an unsupported category: ${product.category}`,
  );
}

assert.equal(normalizeProductCategory({ name: "Rode PodMic USB dynamic microphone" }), "mic");
assert.equal(normalizeProductCategory({ name: "Focusrite Scarlett 2i2 4th Gen USB Audio Interface" }), "audio-interface");
assert.equal(normalizeProductCategory({ name: "HiFiMAN Ananda Planar Magnetic Headphones" }), "headphones");
assert.equal(normalizeProductCategory({ name: "Kiwi Ears Canta IEM 2-pin cable" }), "iems");
assert.equal(normalizeProductCategory({ name: "MOGAMI Gold XLR Cable 10 ft" }), "accessories");
assert.equal(normalizeProductCategory({ name: "Yamaha HS5 Studio Monitor" }), "unknown");
assert.equal(normalizeProductCategory({ name: "Unclear Model 123" }), "unknown");

const headphoneProducts = db.products.filter((product) => normalizeProductCategory(product) === "headphones");
const closedBackProducts = headphoneProducts.filter((product) => productMatchesCategoryTerm(product, "headphones", "closed-back"));
const openBackProducts = headphoneProducts.filter((product) => productMatchesCategoryTerm(product, "headphones", "open-back"));

assert.ok(headphoneProducts.length > closedBackProducts.length, "Parent headphones route should include more than the closed-back child.");
assert.ok(closedBackProducts.length > 0, "Closed-back child route should have mapped products.");
assert.ok(openBackProducts.length > 0, "Open-back child route should have mapped products.");
assert.equal(
  closedBackProducts.some((product) => productMatchesCategoryTerm(product, "headphones", "open-back")),
  false,
  "Closed-back child products must not leak into open-back.",
);
assert.equal(
  productMatchesCategoryTerm(
    {
      category: "headphones",
      name: "Assignment-only closed headphone",
      subCategories: [],
      categoryAssignment: { secondaryCategorySlugs: ["closed-back", "dynamic-driver"] },
    },
    "headphones",
    "closed-back",
  ),
  true,
  "Explicit category assignments must power child routes even if legacy subCategories are empty.",
);
assert.equal(resolveCategoryTerm("accessories", "cables")?.slug, "audio-cables");
assert.equal(
  countProductsForCategoryTerm(db.products, "accessories", "cases"),
  0,
  "Existing empty child categories must remain empty instead of falling back to the parent.",
);

console.log("category logic smoke test passed");
