import assert from "node:assert/strict";
import { getTierCapabilities } from "./entitlements";

function testEntitlementsSnapshotByTier() {
  const free = getTierCapabilities("free");
  const spark = getTierCapabilities("spark");
  const magic = getTierCapabilities("magic");
  const legend = getTierCapabilities("legend");

  assert.equal(free.tier, "free");
  assert.equal(free.bookLimitPeriod, "total");
  assert.equal(free.voiceLimit, 0);
  assert.equal(free.allowedVoices.length, 0);
  assert.equal(free.historyLimit, 3);
  assert.equal(free.pdfLevel, "basic");
  assert.equal(free.maxChildProfiles, 1);
  assert.equal(free.sharingSeats, 0);
  assert.equal(free.lessonPackAccess, "default");
  assert.equal(free.priorityWeight, 0);
  assert.equal(free.commercialUse, false);

  assert.equal(spark.tier, "spark");
  assert.equal(spark.bookLimitPeriod, "monthly");
  assert.equal(spark.voiceLimit, 5);
  assert.deepEqual(spark.allowedVoices, ["nova"]);
  assert.equal(spark.historyLimit, 10);
  assert.equal(spark.pdfLevel, "basic");
  assert.equal(spark.maxChildProfiles, 3);
  assert.equal(spark.sharingSeats, 0);
  assert.equal(spark.lessonPackAccess, "default");
  assert.equal(spark.priorityWeight, 1);
  assert.equal(spark.commercialUse, false);

  assert.equal(magic.tier, "magic");
  assert.equal(magic.bookLimitPeriod, "monthly");
  assert.equal(magic.voiceLimit, 10);
  assert.deepEqual(magic.allowedVoices, ["nova", "alloy", "shimmer"]);
  assert.equal(magic.historyLimit, 500);
  assert.equal(magic.pdfLevel, "premium");
  assert.equal(magic.maxChildProfiles, 3);
  assert.equal(magic.sharingSeats, 0);
  assert.equal(magic.lessonPackAccess, "default");
  assert.equal(magic.priorityWeight, 2);
  assert.equal(magic.commercialUse, false);

  assert.equal(legend.tier, "legend");
  assert.equal(legend.bookLimitPeriod, "monthly");
  assert.equal(legend.voiceLimit, 15);
  assert.equal(legend.allowedVoices.length, 9);
  assert.equal(legend.historyLimit, 500);
  assert.equal(legend.pdfLevel, "premium");
  assert.equal(legend.maxChildProfiles, 5);
  assert.equal(legend.sharingSeats, 2);
  assert.equal(legend.lessonPackAccess, "custom");
  assert.equal(legend.priorityWeight, 3);
  assert.equal(legend.commercialUse, true);
}

function testUnknownTierNormalizesToFree() {
  const unknown = getTierCapabilities("enterprise");
  const free = getTierCapabilities("free");
  assert.deepEqual(unknown, free);
}

function testCapabilityProgressionMonotonic() {
  const free = getTierCapabilities("free");
  const spark = getTierCapabilities("spark");
  const magic = getTierCapabilities("magic");
  const legend = getTierCapabilities("legend");

  assert.ok(free.bookLimit <= spark.bookLimit);
  assert.ok(spark.bookLimit <= magic.bookLimit);
  assert.ok(magic.bookLimit <= legend.bookLimit);

  assert.ok(free.voiceLimit <= spark.voiceLimit);
  assert.ok(spark.voiceLimit <= magic.voiceLimit);
  assert.ok(magic.voiceLimit <= legend.voiceLimit);

  assert.ok(free.priorityWeight <= spark.priorityWeight);
  assert.ok(spark.priorityWeight <= magic.priorityWeight);
  assert.ok(magic.priorityWeight <= legend.priorityWeight);
}

testEntitlementsSnapshotByTier();
testUnknownTierNormalizesToFree();
testCapabilityProgressionMonotonic();
console.log("entitlements tests passed");
