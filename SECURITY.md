# Security policy

## Reporting a vulnerability

Please do **not** report a security problem in a public issue, pull request or
forum post.

Report it privately through GitHub instead: open the **Security** tab of this
repository, then **Report a vulnerability**.

No such button? Private reporting is not enabled yet: open an issue that only
asks the maintainers for a private contact, without any detail of the problem,
and send the report there.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- the log lines that help (remove tokens, passwords and addresses first).

The fix ships as a new version of the integration, and the advisory is
published once users can update.

## Supported versions

Only the latest release receives security fixes: update the integration from
Gladys before reporting a problem.

## Scope

In scope: the code of this repository and the Docker image it publishes.

What the integration handles:

- The location of your houses, read from Gladys (manifest `location: true`).
  It is converted to Dutch grid coordinates and sent, rounded to the metre, to
  the RIVM open geo service (`data.rivm.nl`, HTTPS) to find the postcode area.
  It is never logged nor stored.
- `/data/stookwijzer.json`: the last advice code of each house (keyed by the
  house selector), so that a restart does not fire a trigger again. No secret:
  the service needs no account and no key.
- Network: outgoing HTTPS to `data.rivm.nl` only, and the connection to
  Gladys.

Out of scope: Gladys Assistant itself (see its
[security policy](https://github.com/GladysAssistant/Gladys/security/policy)),
and the RIVM service the integration reads.
