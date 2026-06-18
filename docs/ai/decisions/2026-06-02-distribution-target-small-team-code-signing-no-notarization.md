---
date: 2026-06-02
repo: lyricstamp
tags: [decision, lyricstamp]
---

# Distribution target: small team (code signing, no notarization)

**Decision**: Target Apple Developer ID Application certificate signing for Gatekeeper bypass on team machines. Skip full notarization for now.

**Context**: App is macOS-only, AbletonOSC integration requires localhost OSC — not suitable for public App Store.

**Consequences**: Team members may need to right-click → Open on first launch if Gatekeeper still prompts despite signing.
