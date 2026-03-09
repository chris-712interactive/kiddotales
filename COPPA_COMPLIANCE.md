# COPPA Compliance Guide for KiddoTales

This document outlines the measures KiddoTales needs to implement to comply with the Children's Online Privacy Protection Act (COPPA) and the FTC's 2025 COPPA Rule amendments. **KiddoTales is directed at children** (personalized storybooks for kids ages 3–10), so COPPA applies.

---

## 1. Applicability

**COPPA applies to KiddoTales because:**
- The product is directed at children under 13 (personalized bedtime stories for ages 3–10)
- You collect personal information from/about children: name, age, interests, appearance descriptors, and content that features them
- Even though parents create books (via Google sign-in), the data is about the child

---

## 2. Data You Collect (Current State)

| Data Type | Where Collected | Where Stored | Third Parties |
|-----------|----------------|--------------|---------------|
| Child's name | Create form | Supabase (books), OpenAI, Replicate prompts | OpenAI, Replicate |
| Child's age | Create form | OpenAI/Replicate prompts, book content | OpenAI, Replicate |
| Child's pronouns | Create form | OpenAI prompts | OpenAI |
| Child's interests | Create form | Supabase (books), OpenAI prompts | OpenAI, Replicate |
| Child's appearance (hair, skin, eyes, etc.) | Create form | OpenAI/Replicate prompts | OpenAI, Replicate |
| Generated story text | API | Supabase (books) | — |
| Generated images | API | Supabase Storage | Replicate |
| Parent email | Google Auth | Supabase (users) | Google, Supabase |
| Stripe customer ID | Checkout | Supabase (users) | Stripe |

---

## 3. Required Measures

### 3.1 Verifiable Parental Consent (VPC)

**Before collecting any child personal information**, you must obtain verifiable parental consent.

**Implementation options:**
- **Email + verification link**: Parent enters email → receives link → clicks to verify and consent
- **Credit card verification**: Parent enters card (last 4 digits) — Stripe can support this
- **Government ID**: Higher assurance, more friction (usually overkill for this use case)
- **Video conference**: Human verifies parent identity (high assurance, high cost)

**Recommended for KiddoTales:** Email verification + consent checkbox. Flow:
1. Parent signs in with Google (you already have parent identity)
2. **Before first book creation**, show a consent screen:
   - Clear notice: what data you collect, why, who receives it (OpenAI, Replicate, Supabase)
   - Checkbox: "I am the parent/guardian and consent to KiddoTales collecting [child name, age, interests, etc.] to create personalized stories. I understand this data is shared with OpenAI and Replicate for story and image generation."
   - Require explicit consent before proceeding
3. Log consent: `parent_id`, `child_id` (or session), `timestamp`, `consent_version`, `ip` (optional)

**Database:** Add a `parent_consents` table or `users.parent_consent_at` to track when consent was given.

---

### 3.2 Privacy Policy

**You must have a privacy policy** that includes:

- **What personal information is collected** (child name, age, interests, appearance, etc.)
- **How it is used** (to generate personalized stories and illustrations)
- **Who it is shared with** (OpenAI, Replicate, Supabase, Stripe) and for what purpose
- **Data retention** (how long you keep data; cannot retain indefinitely)
- **Parent rights**: access, correction, deletion, revoke consent
- **How to contact you** for privacy requests
- **Effective date** and update process

**Action:** Create `/privacy` page and link it in footer, sign-in flow, and consent screen.

---

### 3.3 Direct Notice to Parents

Before collecting child data, parents must receive a **direct notice** (not just a link to the policy). This can be:
- A modal or full-page notice before the create form
- An email when the parent first signs up
- The consent screen itself (if it includes the required disclosures)

**The notice must specify:**
- Types of personal information collected
- How it will be used
- Which third parties receive it and for what purposes
- That consent is required before collection

---

### 3.4 Data Retention Policy

COPPA requires you to **not retain child data longer than necessary** and to state retention periods.

**Recommended:**
- **Books**: Retain for [X] months after last activity, or until parent requests deletion
- **User/child metadata**: Same as books, or until account deletion
- **Logs**: Short retention (e.g., 30–90 days) for security/ops only

**Action:** Define retention periods in your privacy policy and implement:
- Scheduled jobs to delete old data
- Or "delete on request" with a clear process

---

### 3.5 Parent Rights: Access, Correction, Deletion, Revoke Consent

Parents must be able to:
1. **Access** their child's information
2. **Correct** inaccurate information
3. **Delete** their child's information
4. **Revoke consent** and stop future collection

**Implementation:**
- **Settings / Account page**: Add "Manage my child's data" section
- **Access**: Show list of books, child info used (name, interests, etc.)
- **Correction**: Allow editing stored child details (if you store them separately) or re-consent with corrected info
- **Deletion**: "Delete all my books and child data" button → delete from Supabase (books, storage), and optionally from OpenAI/Replicate if you have deletion agreements
- **Revoke consent**: Mark `parent_consent_at = null` and block new book creation until re-consent

**Action:** Add API routes:
- `GET /api/user/child-data` — list books and child info
- `DELETE /api/user/child-data` — delete all books and child-related data
- `PATCH /api/user/consent` — revoke consent

---

### 3.6 Third-Party Data Sharing (OpenAI, Replicate)

The 2025 COPPA amendments require **separate, explicit parental consent** before disclosing children's personal information to third parties for purposes beyond the core service.

**Current flow:** You send child name, age, interests, appearance to OpenAI and Replicate without explicit disclosure in consent.

**Required:**
- **Disclose in consent**: "Child information (name, age, interests, appearance) is shared with OpenAI (story generation) and Replicate (image generation) to create your personalized book. These providers process data per their privacy policies and do not use it for advertising."
- **Data Processing Agreements (DPAs)**: Ensure OpenAI and Replicate have DPAs that:
  - Limit use to your authorized purpose only
  - Prohibit secondary use (e.g., training on child data for unrelated products)
  - Support deletion requests
- **Vendor diligence**: Document that OpenAI and Replicate do not use child data for ads or profiling

**OpenAI:** Check [OpenAI's Enterprise/API DPA](https://openai.com/policies) — they typically offer DPAs for business customers.  
**Replicate:** Check [Replicate's terms](https://replicate.com/terms) for data handling and DPA availability.

---

### 3.7 Written Information Security Program

COPPA requires a **written information security program** appropriate to the sensitivity of the data.

**Include:**
- Access controls (who can access child data)
- Encryption in transit (HTTPS) and at rest (Supabase encrypts by default)
- Incident response plan (breach notification to parents/FTC)
- Vendor security (Supabase, OpenAI, Replicate)
- Regular review/updates

**Action:** Create a short `SECURITY.md` or internal doc outlining these practices.

---

### 3.8 No Behavioral Advertising / Profiling

For child-directed services, **do not** use:
- Behavioral/targeted advertising
- Persistent identifiers for ad purposes
- Third-party ad SDKs
- Retargeting or lookalike audiences

**Current state:** KiddoTales does not appear to use adtech. **Keep it that way.** If you add analytics later, use:
- Privacy-preserving analytics (aggregate counts, no cross-app IDs)
- No ad IDs, fingerprinting, or third-party cookies

---

### 3.9 Age Gate (Optional but Recommended)

Even though KiddoTales is parent-facing (parents create books for kids), consider:
- **Landing page**: "For parents creating stories for children ages 3–10"
- **Create form**: "I am a parent or guardian creating a story for my child" — reinforces that the user is the parent, not the child

This supports your position that you obtain parental consent (the parent is the one using the app).

---

## 4. Implementation Checklist

| # | Measure | Priority | Effort |
|---|---------|----------|--------|
| 1 | Add verifiable parental consent flow before first book creation | **High** | Medium |
| 2 | Create privacy policy page (`/privacy`) | **High** | Medium |
| 3 | Add direct notice (consent screen with disclosures) | **High** | Low |
| 4 | Define and document data retention policy | **High** | Low |
| 5 | Implement parent deletion API and UI | **High** | Medium |
| 6 | Implement parent access/correction UI | **Medium** | Medium |
| 7 | Add consent revocation in settings | **Medium** | Low |
| 8 | Obtain/verify DPAs with OpenAI and Replicate | **High** | Low (legal) |
| 9 | Document written information security program | **Medium** | Low |
| 10 | Ensure no adtech/behavioral tracking | **High** | Low (already compliant) |

---

## 5. FTC 2025 Amendments Timeline

- **Effective date**: June 21, 2025  
- **Compliance deadline**: April 22, 2026  

Start implementing now to meet the deadline.

---

## 6. References

- [FTC COPPA Rule](https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa)
- [FTC 2025 COPPA Amendments](https://www.ftc.gov/news-events/news/press-releases/2025/01/ftc-finalizes-changes-childrens-privacy-rule-limiting-companies-ability-monetize-kids-data)
- [COPPA Safe Harbor Programs](https://www.ftc.gov/legal-library/browse/statutes/childrens-online-privacy-protection-act) (consider joining for compliance framework)

---

*This guide is for informational purposes. Consult a privacy attorney for legal advice tailored to your situation.*
