import * as core from '@actions/core';

/**
 * Write the OBS-01 "is the cache working" job summary (D-17): a level-2 heading plus
 * a two-column metric/count table. Extracted because the publish bin and the cleanup
 * engine authored this table byte-identically (the octokit-status precedent -- one
 * home for a shape both wrote the same way, so the header cells and heading level
 * cannot drift). Rows are given as `[metric, count]` pairs; counts are stringified
 * here. Only the table rendering is shared -- each engine keeps its own
 * `if (failed > 0) core.setFailed(...)` fail-loud decision (different messages and
 * thresholds).
 */
export async function writeCountSummary(
  heading: string,
  rows: readonly (readonly [string, number])[],
): Promise<void> {
  core.summary.addHeading(heading, 2).addTable([
    [
      { data: 'metric', header: true },
      { data: 'count', header: true },
    ],
    ...rows.map(([metric, count]) => [metric, String(count)]),
  ]);
  await core.summary.write();
}
