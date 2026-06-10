# Security Specification & Adversarial Verification Spec

This document details the Zero-Trust Firestore Security Specification for Pandior, evaluating potential vulnerabilities and outlining the "Dirty Dozen" payload checks to prevent unauthorized data access, privilege escalation, and resource exhaustion.

---

## 1. Data Invariants

1.  **Identity Bond**: A user can only access (read, write) documents containing user profile data, events, or tasks where the `uid` or `ownerId` perfectly matches their Firestore auth unique ID (`request.auth.uid`).
2.  **Immutability Integrity**: Fields like `createdAt` and `ownerId` can never be modified post-creation.
3.  **Strict Size Enforcements**: To prevent "Denial of Wallet" resource exhaustion attacks, all string inputs are bounded (e.g., `title.size() <= 100`, `description.size() <= 1000`).
4.  **Temporal Authenticity**: All timetamps are generated using the server's transactional timestamp (`request.time`) instead of trusting client clock systems.

---

## 2. The "Dirty Dozen" Payload Tests (Negative Test Cases)

Below are twelve payloads modeled to penetrate or bypass typical Firestore rules that must be strictly blocked by returning `PERMISSION_DENIED`.

| Payload ID | Targeted Attack / Vulnerability | Malicious Action Attempted | Expected Outcome |
| :--- | :--- | :--- | :--- |
| **01** | Identity Spoofing | authenticated User A attempts to write an Event with `ownerId="UserB"` | `PERMISSION_DENIED` |
| **02** | Cross-User Profile Tampering | authenticated User A attempts to edit User B's `/users/UserB` profile | `PERMISSION_DENIED` |
| **03** | Privilege Escalation (Shadow Fields) | authenticated User A attempts to inject an unauthorized `isAdmin` or admin flag on account config | `PERMISSION_DENIED` |
| **04** | State Corruption (Missing Fields) | Adding an Event without mandatory `start` or `end` timestamp fields | `PERMISSION_DENIED` |
| **05** | Resource Injection | Trying to write an Event with a title of 50,000 characters | `PERMISSION_DENIED` |
| **06** | Temporal Verification Bypass | Setting a manually crafted future/past date for `createdAt` instead of `request.time` | `PERMISSION_DENIED` |
| **07** | ID Poisoning Guard | Attempting to create a document with a malformed ID string filled with terminal command injected patterns or excessively long strings | `PERMISSION_DENIED` |
| **08** | Orphaned Entity Insertion | Creating an event or task referencing a non-existent parent or user profile entity | `PERMISSION_DENIED` |
| **09** | Out of Order Status Skipping | Forcing a task status transition directly to completed bypassing standard lifecycles | `PERMISSION_DENIED` |
| **10** | Unsigned Client Access | Attempting to write or query data without passing a valid auth token | `PERMISSION_DENIED` |
| **11** | Key Tampering | Modifying the immutable `ownerId` or `id` fields during an event/task update operation | `PERMISSION_DENIED` |
| **12** | Database Scraping (Blanket Reads) | Attempting to run a collection-wide `getDocs()` query without specified identity bounds and filters | `PERMISSION_DENIED` |

---

## 3. Verified Security Rules Strategy

All collection schemas are mapped to strict, isolated match boundaries. By defaulting to a global-deny pattern, any request that fails exact schema validation or identity checks is instantly blocked.
