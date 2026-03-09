# KiddoTales Information Security Program

This document outlines KiddoTales' information security practices for protecting children's personal information. It supports our compliance with COPPA and the FTC's Children's Online Privacy Protection Rule.

---

## 1. Scope

This program applies to all systems that collect, store, or process child personal information, including:

- Child names, ages, interests, appearance details, and generated story content
- Parent/guardian account information
- Books and illustrations stored in our systems

---

## 2. Access Controls

- **Who has access:** Only the company owner and lead engineers have access to production systems and data.
- **How access is managed:** Individual accounts (no shared credentials) with multi-factor authentication (MFA) required for all personnel with access.
- **Review frequency:** Access is reviewed monthly to ensure only authorized personnel retain access.

---

## 3. Encryption

- **In transit:** All traffic uses HTTPS (TLS). Vercel and Supabase enforce encryption in transit.
- **At rest:** Supabase encrypts database and storage data at rest. Sensitive environment variables (API keys, secrets) are stored in Vercel's encrypted environment and are not committed to source control.

---

## 4. Vendors and Third Parties

We share child data only with vendors necessary to provide the service:

| Vendor | Purpose | Data Shared |
|--------|---------|-------------|
| **Supabase** | Database and image storage | Books, user accounts, child info |
| **Vercel** | Hosting and deployment | Application traffic |
| **OpenAI** | Story generation | Child name, age, interests, appearance |
| **Replicate** | Image generation | Child info in prompts |
| **Google** | Authentication | Parent email, account ID |
| **Stripe** | Subscription payments | Parent billing info |

We maintain Data Processing Agreements (DPAs) with OpenAI and Replicate where applicable. We select vendors with appropriate security practices and do not use child data for advertising or profiling.

---

## 5. Incident Response

In the event of a security incident or data breach affecting child information:

1. **Assess** – Determine scope, impact, and affected users.
2. **Contain** – Take steps to stop the breach and prevent further exposure.
3. **Notify** – Notify affected users (parents/guardians), the FTC, state attorneys general, and other valid parties as required by law. We aim to provide notice within **72 hours** of confirming a breach.
4. **Document** – Record the incident, response actions, and outcomes for compliance and improvement.

**Security contact:** privacy@712int.com. Incidents are handled by the company owner.

---

## 6. Data Retention

We retain child data only as long as necessary. See our [Privacy Policy](/privacy) and [COPPA Compliance Guide](./COPPA_COMPLIANCE.md) for retention rules. Automated retention deletion runs daily via cron.

---

## 7. Current Limitations and Roadmap

- **Audit logs:** Not yet implemented. We plan to add audit logging as the product scales.
- **Penetration testing:** Not yet performed. We will consider third-party security assessments as we grow.

---

## 8. Review and Updates

This security program is reviewed and updated periodically to reflect changes in our systems, vendors, or regulatory requirements.

---

## Compliance Frameworks

Our primary focus is **COPPA** (Children's Online Privacy Protection Act). At our current stage, we do not pursue SOC 2 or ISO 27001 certification. We may revisit these frameworks as we scale or if enterprise customers require them.

---

*Last updated: March 2025*
