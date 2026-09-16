# Separate release gates

These are evidence requirements, not approvals or legal advice. Owner/professional review is required for privacy, retention, deletion, transport and store-policy decisions. No Philippine fare rule, transport classification or partner authority is assumed.

| Gate | Permitted scope after evidence | Required evidence | Current disposition |
| --- | --- | --- | --- |
| Private software test | Fictional bookings/accounts in isolated local/disposable backend; no transport | RLS and transaction checks; explicit demo isolation; no production credentials/records | Consult QA.md for local code/DB evidence; not permission for a real service |
| Invited beta | Intended backend and approved tester data handling | Authenticated deployed lifecycle, two installed no-Metro apps, owner-authorized backend, individual accounts, tested email or documented invite route, retention/deletion/support decisions, privacy notice and permission-copy review, backup/restore evidence | BLOCKED pending hosted/device and owner policy evidence |
| Compensated transport | Approved real operations only | Applicable transport classification; operator/vehicle authority; permitted geography; insurance; approved fare/discount handling and quote changes; accountable staffing/support; incident escalation; completed beta and recovery evidence | BLOCKED; no legal/insurance/operational evidence supplied |
| Public store release | Publicly distributed reviewed app | Stable operational beta; applicable current store requirements checked against actual distribution plan; signed artifacts; owner developer accounts; truthful metadata, data disclosures, privacy/support URLs, deletion handling and private review accounts; store review/submission authorization | BLOCKED; no store submission or approval |

Account deletion/retention: the signed-in web Account requests screen and native account screen record an authorized request; Operations displays pending requests. This is a request queue, not completed deletion. No completion processor is implemented while retention is undecided. Do not hard-delete transactional or audit data to satisfy an undefined policy. Owner must define retention by data category (identity documents, coordinates, contact details, auth accounts, rides and collection logs), lawful basis, deletion/request identity verification, access controls, response owner and timeframes. Public account-management/deletion readiness remains blocked until the approved policy is implemented and tested. This document does not substitute for an accessible approved privacy notice.

Support: actual contact, coverage hours, cancellation/no-show response, driver reconfirmation cutoff and emergency escalation responsibility must be supplied and reflected accurately in the product. Do not call an unstaffed in-app queue 24/7 support.

Store metadata and review-account instructions are preparatory owner tasks. No current store policy conclusions were made in this phase, so no unverified policy or public-launch claim is supplied.
