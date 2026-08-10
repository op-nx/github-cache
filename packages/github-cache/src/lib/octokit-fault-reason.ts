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
 * inlined so the cast in `faultData` is one expression instead of several nested `typeof`
 * guards; every field is optional because NONE of them is guaranteed.
 *
 * Two interfaces, not one, so `faultData` can name its return type directly -- reaching it
 * through `FaultBody`'s optional `response` needs a conditional type that does not compile.
 */
interface FaultData {
  readonly errors?: unknown;
  readonly message?: unknown;
}

interface FaultBody {
  readonly response?: { readonly data?: FaultData };
}

/** GitHub's own reason for a rejected request, as far as the body reveals it. */
export interface FaultReason {
  readonly code?: string;
  readonly message?: string;
}

/**
 * A READABLE string, or undefined -- and the empty string is not one.
 *
 * `''` IS TREATED AS ABSENT, and that is the whole point rather than tidiness. Every
 * consumer below either falls back (`??`) or scans for the first defined value, and both
 * of those idioms treat `''` as PRESENT: `'' ?? x` short-circuits to `''`, and
 * `.find(v => v !== undefined)` accepts it. So an entry carrying an empty message SHADOWS
 * the `data.message` fallback and this module returns nothing readable at exactly the site
 * whose whole purpose is to print GitHub's own reason -- MEASURED on the body
 * `{errors:[{code:'custom',message:''}], message:'Tag name cannot be reused under this
 * ruleset'}`, which yielded `{code:'custom', message:''}` and dropped the one diagnostic in
 * the payload. `custom` is precisely the code whose documented meaning is "refer to the
 * message property", so the pair was maximally useless.
 *
 * The asymmetry is what makes it a bug rather than a preference: `message: null` was ALWAYS
 * handled correctly, because null fails the `typeof` test. Rejecting `''` here makes the two
 * empty-ish shapes behave the same, and makes this module's own docstring true -- "either
 * field is undefined when the body carries nothing readable". An empty string is nothing
 * readable.
 */
function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/**
 * Where GitHub puts a rejection body -- the ONE place this module knows that. Keep it one
 * place: the header's rule ("one body reader per fault class") applies to this file's own
 * internals, and all three exports below used to open with their own copy of the path.
 *
 * Optional chaining absorbs a null, undefined or primitive `error` alike, so no caller-side
 * pre-check is needed.
 */
function faultData(error: unknown): FaultData | undefined {
  return (error as FaultBody | null)?.response?.data;
}

/**
 * The `errors[]` array, or EMPTY -- never undefined, so every consumer below is a plain array
 * pipeline. A non-array `errors` is untrusted remote input (V5) and collapses to empty here
 * rather than throwing at a `.map`.
 *
 * Empty is NOT benign, per the module rule: it means GitHub named no errors, which earns a
 * caller no benign branch.
 */
function faultErrors(error: unknown): unknown[] {
  const raw = faultData(error)?.errors;

  return Array.isArray(raw) ? raw : [];
}

/**
 * One READABLE string field of one `errors[]` entry, applying the empty-string rule uniformly.
 * Field-NAMED rather than split into `entryCode`/`entryMessage`, which would be this same cast
 * and guard authored twice.
 */
function entryField(entry: unknown, name: string): string | undefined {
  return stringOrUndefined((entry as Record<string, unknown> | null)?.[name]);
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
  const errors = faultErrors(error);

  return {
    code: errors
      .map((entry) => entryField(entry, 'code'))
      .find((code) => code !== undefined),
    message:
      errors
        .map((entry) => entryField(entry, 'message'))
        .find((message) => message !== undefined) ??
      stringOrUndefined(faultData(error)?.message),
  };
}

/**
 * GitHub's `errors[].code` enum, exactly the six members this module's header enumerates.
 *
 * A UNION on the PREDICATE's parameter, and nowhere else. A bare `string` there accepted a
 * misspelling -- `'already_exist'` compiles, always returns false, and silently converts a
 * genuine duplicate-upload race into a counted failure. Fail-closed, so not a Core-Value
 * risk, but a green run turns red for a benign cause with the cause invisible.
 *
 * DELIBERATELY NOT applied to `faultMessageForField`'s `field`, whose names are
 * endpoint-specific and open-ended, nor to `faultReason().code`, which renders whatever
 * GitHub actually sent and is not necessarily in the enum.
 */
export type GitHubErrorCode =
  | 'missing'
  | 'missing_field'
  | 'invalid'
  | 'already_exists'
  | 'unprocessable'
  | 'custom';

/**
 * Does ANY `errors[]` entry carry exactly this code?
 *
 * WHY THIS EXISTS AND `faultReason().code` DOES NOT COVER IT. That lookup returns the FIRST
 * string code anywhere in the array, which is the right answer for a log line -- one code to
 * print -- and the wrong one for a DECISION, because it is order-dependent in both
 * directions. It is also asymmetric with the same function's `message`, which deliberately
 * scans the WHOLE array; the code lookup reads like it does the same and does not.
 *
 * WHAT THE WHOLE-ARRAY SCAN ACTUALLY BUYS, stated precisely because an earlier revision of
 * this block credited it with closing a hole it only WIDENS. Scanning removes the
 * ORDER-DEPENDENCE of a first-code read: the verdict no longer turns on which entry GitHub
 * happened to put first. It does not narrow the benign set -- it enlarges it, because a body
 * is now benign whenever the code appears ANYWHERE, including behind a permanent policy
 * rejection. On `[{code:'already_exists'}, {code:'custom', message:'Release assets are
 * immutable under this ruleset'}]` a first-code read and an ANY scan both answer benign, and
 * both are wrong: that is the shape of run 30767511870. Narrowing it back is
 * `hasOnlyFaultCode` below, which is what the asset-upload path uses.
 *
 * So this predicate is correct only where a benign sibling cannot co-occur with a fatal one,
 * or where fatal siblings are excluded by some OTHER condition. `ensureShardRelease`'s create
 * race is that case: an `already_exists` there means the release exists, which the branch
 * then re-reads and proves, so a decoy sibling cannot make the re-read succeed.
 *
 * A BOOLEAN, not a code, and deliberately not a general "codes()" accessor: every caller
 * asks a yes/no question about ONE documented code, and returning the set would just move
 * the order-dependence into the call sites. The name says what it proves -- GitHub SAID
 * this -- which keeps the module's rule intact: only an explicit code earns a benign branch,
 * and an unreadable body still earns none.
 */
export function hasFaultCode(error: unknown, code: GitHubErrorCode): boolean {
  return faultErrors(error).some((entry) => entryField(entry, 'code') === code);
}

/**
 * Is EVERY `errors[]` entry exactly this code, on a NON-EMPTY array?
 *
 * The CONJUNCTION `hasFaultCode` cannot express, and the one a fail-closed benign branch
 * needs. `hasFaultCode` asks whether GitHub said this ANYWHERE, so one recognised entry
 * absolves every unrecognised sibling in the same body; this asks whether the recognised
 * signature is ALL GitHub said. A single unrecognised sibling therefore makes the whole body
 * fatal, which is the rule for the asset-upload path: the measured run-30767511870 payload
 * carried a benign `already_exists` beside a `code: custom` immutability rejection and was
 * classified a duplicate no-op, so 65 permanently-rejected uploads exited GREEN.
 *
 * NON-EMPTY IS LOAD-BEARING, not defensive tidiness. `[].every(...)` is vacuously true, so
 * without the length test an absent body, a null body, a non-array `errors` and an empty
 * `errors` would all collapse to the EMPTY array from `faultErrors` and answer benign --
 * reintroducing the guess this module exists to forbid, at the one call site whose whole
 * purpose is to stop guessing. Per the header's standing rule, undefined is not benign, so
 * every unreadable shape must return false and fall through to the caller's fault branch.
 *
 * READS NO MESSAGE, deliberately. The field-scoped, textually-anchored accessor
 * (`faultMessageForField`) governs the paths whose benign signal IS a message -- there the
 * decoy bites, because `faultReason().message` yields the first message-carrying entry. Here
 * the signal is a CODE, so a code-set conjunction is structurally immune to that decoy rather
 * than merely careful about it. A message read on this path would be the defect, not the
 * safeguard. If a future benign signature on such a path needs a message, the field-scoped
 * accessor becomes mandatory again for it.
 *
 * An entry carrying NO readable code fails the comparison and so makes the body fatal --
 * a `{resource, field, message}` entry is a real shape and it is not a recognised benign
 * signature.
 */
export function hasOnlyFaultCode(
  error: unknown,
  code: GitHubErrorCode,
): boolean {
  const errors = faultErrors(error);

  return (
    errors.length > 0 &&
    errors.every((entry) => entryField(entry, 'code') === code)
  );
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
  return (
    faultErrors(error)
      // A RAW equality, deliberately NOT `entryField(entry, 'field')`. The empty-string rule
      // belongs to values this module RETURNS, not to the selector a caller passes: routing the
      // scope through `stringOrUndefined` would make `faultMessageForField(e, '')` stop matching
      // an entry whose own `field` is `''`. No caller does that today, and none should, but the
      // scope filter has no business changing meaning to share a helper.
      .filter((entry) => (entry as { field?: unknown } | null)?.field === field)
      .map((entry) => entryField(entry, 'message'))
      .find((message) => message !== undefined)
  );
}
