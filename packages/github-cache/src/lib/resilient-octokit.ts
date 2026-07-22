import * as core from '@actions/core';
import { Octokit } from '@octokit/rest';
import { retry } from '@octokit/plugin-retry';
import { throttling } from '@octokit/plugin-throttling';

/**
 * One Octokit constructed with the upstream-blessed resilience pairing (F04): the
 * retry plugin (retries 429 + all 5xx with a quadratic backoff; 404/422 stay in its
 * doNotRetry list) and the throttling plugin (honors primary/secondary rate-limit
 * headers). `octokit@5.0.5` ships exactly this pairing on `@octokit/core@7`, which is
 * the authoritative confirmation that it is the maintained combination for this line,
 * not a hand-rolled guess.
 *
 * Both the publish adapter (action/index.ts) and the cleanup bin (cleanup/index.ts)
 * used a bare `new Octokit({ auth: token })` that treated a transient 429/5xx as
 * permanent; this replaces both with the SAME helper -- one resilience surface, not a
 * duplicated throttle block.
 *
 * retry is wired BEFORE throttling, mirroring upstream's own composition order.
 *
 * Both throttle callbacks are MANDATORY -- the plugin throws at construction if either
 * is absent. Each logs a core.warning carrying ONLY options.method and options.url and
 * the attempt number (never the token or a raw workflow-command string, matching the
 * existing publish-mirror.ts discipline) and returns `retryCount < 1` (one retry),
 * matching upstream's default handlers and bounding the doubled-up 429 handling
 * (throttling catches a 429 first, then retry's error hook can retry it too).
 *
 * 404 and 422 are in plugin-retry's doNotRetry list, so ensureShardRelease's
 * 404-means-absent / 422-means-race discrimination keeps working with zero added
 * latency and no code change.
 *
 * ponytail: accepts the throttling defaults, INCLUDING the write group's
 * minTime: 1000. That paces uploads at one per second, so a full 1000-asset shard
 * adds up to ~16 minutes of wall clock to a publish leg -- acceptable for a push-only
 * background mirror. Upgrade path if it ever hurts: a per-group throttle override, NOT
 * removing the plugin.
 */
const ResilientOctokit = Octokit.plugin(retry, throttling);

export function createResilientOctokit(token: string): Octokit {
  return new ResilientOctokit({
    auth: token,
    throttle: {
      onRateLimit: (retryAfter, options, _octokit, retryCount) => {
        core.warning(
          `github-cache: rate limit on ${options.method} ${options.url}; ` +
            `retrying in ${retryAfter}s (attempt ${retryCount + 1}).`,
        );

        return retryCount < 1;
      },
      onSecondaryRateLimit: (retryAfter, options, _octokit, retryCount) => {
        core.warning(
          `github-cache: secondary rate limit on ${options.method} ${options.url}; ` +
            `retrying in ${retryAfter}s (attempt ${retryCount + 1}).`,
        );

        return retryCount < 1;
      },
    },
  });
}
