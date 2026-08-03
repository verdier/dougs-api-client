# Security policy

## Reporting a vulnerability

Please report suspected security issues privately through the [GitHub security advisory workflow](https://github.com/verdier/dougs-api-client/security/advisories/new), rather than opening a public issue. Include a minimal reproduction, affected version, impact, and any mitigation you identified. Do not include real Dougs credentials, cookies, session files, or financial data in the report.

A public issue tracker is not an appropriate place for vulnerability details.

## Sensitive data

Credentials, access tokens, and `.session.json` session caches are authentication material. MCP responses may contain financial and personal data. Store, transmit, and retain these only in trusted systems. Store session caches in a private, application-owned directory (for example mode `0700`), do not use a shared directory or symlink, and keep the cache owner-only (`0600`). The client applies cache-file permissions where supported, but session-path symlink/TOCTOU defenses are deferred P2 hardening and are not enforced yet.
