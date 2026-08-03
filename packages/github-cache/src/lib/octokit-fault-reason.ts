/**
 * Read GitHub's OWN reason for a rejected request out of the response body (ROBUST-01,
 * D-04) -- the body half of the fault contract whose STATUS half is `statusOf` next door.
 *
 * A `lib/` LEAF for the same reason `octokit-status.ts` is one, and after the same defect:
 * that file records that the 404/422/5xx contract "was previously authored byte-identically
 * in both (I8/simplify: drift risk on a fault-discrimination contract encoded twice)". This
 * reader was born module-private to `publish-mirror.ts`, which recreated that risk one layer
 * up in the same subsystem -- with a visible consequence, since the cleanup engine's delete
 * failure could only render a STATUS. One body reader per fault class, shared by every call
 * site of that class, not by every call site inside one file.
 *
 * WHY THE MESSAGE AND NOT ONLY THE CODE. GitHub's `errors[].code` enum is GLOBAL rather
 * than per-endpoint and has exactly six members (missing, missing_field, invalid,
 * already_exists, unprocessable, custom). Policy rejections -- rulesets, immutability, org
 * settings -- get no code of their own: they arrive as `custom`, whose documented meaning is
 * literally "refer to the message property to diagnose the error". A code-only reader is
 * therefore a reader that CANNOT diagnose; it prints "code custom" and the next
 * investigation window buys nothing.
 *
 * Undefined is NOT benign, and no call site may treat it as such: a status-only classifier
 * that guessed benign is the entire defect this function exists to close, so re-introducing
 * the guess one level down -- "unreadable body, probably a duplicate" -- would be the same
 * bug with more steps. Only an explicit code earns a benign branch. Optional chaining
 * absorbs a null/undefined error and a primitive one alike, so no caller-side pre-check is
 * needed.
 */

/**
 * The shape of the only part of a fault's body this module reads. Declared rather than
 * inlined so the cast below is one expression instead of several nested `typeof` guards;
 * every field is optional because NONE of them is guaranteed.
 */
interface FaultBody {
  readonly response?: {
    readonly data?: { readonly errors?: unknown; readonly message?: unknown };
  };
}

/** GitHub's own reason for a rejected request, as far as the body reveals it. */
export interface FaultReason {
  readonly code?: string;
  readonly message?: string;
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/**
 * THE TWO LOOKUPS ARE INDEPENDENT, and coupling them loses messages. `code` is the first
 * `errors[]` entry carrying a string `code`; `message` is the first entry carrying a string
 * `message`, ANYWHERE in the array, falling back to the top-level `data.message` (some 422
 * bodies carry no `errors` array at all). Binding one entry on its code and then reading
 * THAT entry's message discards the diagnostic whenever the entry carrying it has no code --
 * a `{resource, field, message}` entry is a real shape, and the fallback then prints the
 * generic "Validation Failed" instead of the one useful string in the body.
 *
 * Either field is undefined when the body is absent, is not the documented shape, or
 * carries nothing readable.
 */
export function faultReason(error: unknown): FaultReason {
  const data = (error as FaultBody | null)?.response?.data;
  const raw = data?.errors;
  const errors: unknown[] = Array.isArray(raw) ? raw : [];

  return {
    code: errors
      .map((entry) =>
        stringOrUndefined((entry as { code?: unknown } | null)?.code),
      )
      .find((code) => code !== undefined),
    message:
      errors
        .map((entry) =>
          stringOrUndefined((entry as { message?: unknown } | null)?.message),
        )
        .find((message) => message !== undefined) ??
      stringOrUndefined(data?.message),
  };
}

/**
 * The message of the FIRST `errors[]` entry scoped to a given `field`, or undefined.
 *
 * WHY THIS EXISTS AND `faultReason().message` DOES NOT COVER IT. That lookup returns the
 * first entry carrying a message ANYWHERE in the array, which is the right answer when a
 * caller wants "whatever GitHub said" for a log line -- but the wrong one when a caller
 * needs a SPECIFIC entry's message to decide something. On the measured createRelease
 * rejection for a burned tag name the array arrives as
 * [pre_receive, tag_name, <no field>], all three `code: custom`, so `faultReason().message`
 * returns the `pre_receive` entry: a generic "Repository rule violations found / Cannot
 * create ref due to creations being restricted" that reads exactly like a tag ruleset and
 * is NOT the authoritative reason. A predicate written the obvious way, as a substring test
 * against that message, could therefore never fire -- it would fail closed, so not
 * dangerous, but it would ship a guard that cannot work and a verification window would
 * read "the guard did not fire" instead of "the guard is wrong".
 *
 * Scoping on `field` is also what makes a caller's substring test structurally unable to
 * match a neighbouring entry, which matters when one of those neighbours is a decoy whose
 * own condition must stay fatal.
 *
 * A caller-SPECIFIC predicate does not belong here. This returns the message and nothing
 * more; the one call site that needs it composes its own substring test, because a
 * publisher-shaped `isBurnedTagName()` in a generic body reader would be an abstraction
 * with exactly one consumer.
 *
 * Undefined on everything else -- absent body, `errors` missing or not an array, no entry
 * with that field, an entry whose `message` is not a string. The 422 body is untrusted
 * remote input (V5), and per this module's rule undefined is NOT benign: a caller must
 * treat it as "GitHub did not say this", never as "probably fine".
 */
export function faultMessageForField(
  error: unknown,
  field: string,
): string | undefined {
  const raw = (error as FaultBody | null)?.response?.data?.errors;
  const errors: unknown[] = Array.isArray(raw) ? raw : [];

  return errors
    .filter((entry) => (entry as { field?: unknown } | null)?.field === field)
    .map((entry) =>
      stringOrUndefined((entry as { message?: unknown } | null)?.message),
    )
    .find((message) => message !== undefined);
}
