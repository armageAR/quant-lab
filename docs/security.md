# Security

## Credential handling

- Store exchange API keys and broker credentials outside the repository.
- Use environment variables or a secrets manager.
- Never expose credentials to the frontend.
- Never log raw secrets.

## Access control

- Apply least-privilege principles to API keys and service accounts.
- Keep withdrawal permissions disabled unless a separate, explicit operational decision enables them.
- Treat live execution as disabled by default.

## Rotation and lifecycle

- Support key rotation without code changes where possible.
- Keep credential lifetimes and ownership documented.
- Revoke unused credentials promptly.

## Logging and masking

- Mask secrets and sensitive identifiers in logs.
- Avoid printing full request payloads when they may contain credentials or account data.
- Use structured logs so masking can be applied consistently.

## Dependency security

- Review dependency updates before adopting them.
- Prefer pinned or controlled versions for critical infrastructure.
- Track advisories that affect authentication, networking, or order routing.

## Operator approval

- Require human approval before the first live execution path is enabled.
- Preserve an audit trail for configuration and execution changes.

## Kill switch

- Maintain a clear kill-switch mechanism for live execution.
- The system should be able to stop new order submission quickly and visibly.

## Incident response basics

- preserve logs and audit data;
- identify affected venues and accounts;
- revoke credentials if compromise is suspected;
- document the incident and follow-up actions.
