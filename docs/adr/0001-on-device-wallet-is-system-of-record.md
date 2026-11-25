# 0001 — The on-device Wallet is the system of record

- **Status:** Accepted
- **Date:** 2026-11-25

## Context

QR Wallet exists so a phone owner can show a scannable code within seconds,
often where there is no reliable signal. The information being shown is
personal: names, phone numbers, email addresses, and links. The problem
statement explicitly rejects ad-supported QR apps that may require a network or
an account, and the parent spec puts backend, accounts, synchronization, cloud
backup, analytics, and telemetry out of scope.

An architecture is therefore needed for where the Wallet lives and what, if
anything, it talks to. The constraints are:

- The app must open and show every Card offline.
- Personal contact details must never be uploaded to a service.
- The app must be usable without an account or sign-in.
- There is no server-side component to own, pay for, or keep available.

## Decision

The Wallet on the device is the system of record. There is no backend, no
account, and no synchronization.

- The complete Wallet — every Card plus the active Card id — is stored in the
  device's `localStorage` under the versioned key `qr_wallet_v1`.
- Writes are single atomic operations. Stored state is strictly validated on
  read; unreadable state is preserved verbatim under `qr_wallet_v1_corrupt` and
  the Seed Cards are created instead of silently discarding the raw value.
- The persistence boundary accepts an injected `Storage` implementation, with
  `localStorage` as the production default. This keeps the Wallet store pure
  Node-testable.
- A Backup file is the only way to move a Wallet to another device. It is a
  user-initiated export/import of the same on-device Wallet, not a sync
  mechanism.
- A best-effort persistent-storage request reduces the chance of eviction, but
  it is not a durability guarantee.

## Alternatives considered

- **Backend with accounts and sync.** Rejected: it contradicts the core promise
  of privacy, offline use, and no sign-in, and adds an operational surface the
  product deliberately does not have.
- **Cloud backup service.** Rejected for the same reasons. Backup files are
  user-controlled and never touch a server.
- **IndexedDB or a custom file store instead of `localStorage`.** Not needed for
  a bounded Wallet (at most 100 Cards, each Payload at most 800 UTF-8 bytes),
  and `localStorage` keeps the persistence boundary small enough to fake in
  Node tests.
- **Speculative migration framework.** Rejected: version 1 is strict until a
  real v2 exists.

## Consequences

- The Wallet works fully offline and private by construction; there is no
  upload path to accidentally add later.
- Losing the device loses the Wallet unless the owner made a Backup. iOS can
  evict site data after a period of non-use, so Backup is the real durability
  mechanism and the README documents that caveat.
- There is no multi-device story and no automatic conflict handling; that is
  accepted product scope, not an accidental gap.
- Validation, corruption recovery, and write-failure surfacing are part of the
  Wallet store, not an afterthought in the UI.
