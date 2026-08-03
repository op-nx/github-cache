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
