# Security Policy

`@op-nx/github-cache` is a poisoning-class tool: it serves a shared build cache
over GitHub infrastructure, and a single poisoned cache entry can execute in
every downstream consumer's build. Cache poisoning (the CREEP class,
CVE-2025-36852) is the governing threat this project defends against, so a
private, coordinated vulnerability-disclosure path is a first-class concern.

## Supported Versions

This project is pre-1.0 (0.x). Under standard 0.x semantics the public surface
may still evolve, and only the latest 0.x line receives security fixes. The 1.0
release will formalize the long-term support policy.

| Version         | Supported |
| --------------- | --------- |
| Latest 0.x      | Yes       |
| Any earlier 0.x | No        |

## Reporting a Vulnerability

Please report security vulnerabilities privately through GitHub, never in a
public issue or pull request. A public report for a cache-poisoning-class tool
can disclose a live attack vector before a fix ships.

To report:

1. Open the repository's **Security** tab.
2. Choose **Report a vulnerability** to open a private report through GitHub
   Security Advisories (GitHub private vulnerability reporting).
3. Include the affected version(s), the impact, and a reproduction if you have
   one.

Private vulnerability reporting keeps the report confidential between you and
the maintainer while a fix is prepared, so no contact email is needed.

## Coordinated Disclosure

- **Triage:** an initial response is targeted within 7 days of a report.
- **Fix and disclosure:** once a fix is ready, a GitHub Security Advisory is
  published to coordinate disclosure. Please hold public details until that
  advisory is out.
- **Backstop:** if a report cannot be resolved, coordinated disclosure may
  proceed by mutual agreement, and no later than 90 days after the report.
- **Credit:** reporters are credited in the advisory unless they ask not to be.
