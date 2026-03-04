# assets/

Static assets used as email attachments.

## banner_image.png

The Sol Software logo image attached inline (CID) to all outgoing emails.

**Current state**: Placeholder 1×1 transparent PNG. Replace with the real Sol Software logo before production deployment.

The image is referenced in emails as `cid:banner_image.png` and attached via the `attachments` array in `src/lib/templates.ts`.

Recommended size: height 32px, width proportional, transparent background.
