# Contract: Client Settings — Banner Sub-Key

**Feature**: 019-client-email-banner
**Type**: Internal client settings schema

---

## Location

Stored in `clients.settings` JSONB column under the key `"banner"`.

## Shape

```json
{
  "banner": {
    "imageUrl": "https://cdn.example.com/logo.png",
    "height": 60,
    "width": 240
  }
}
```

## Fields

| Field | Type | Required | Constraints | Default |
|-------|------|----------|-------------|---------|
| `imageUrl` | string | No | Absolute URL, `http` or `https` protocol | System default banner |
| `height` | number | No | Positive integer (pixels) | `40` |
| `width` | number | No | Positive integer (pixels) | Unset (natural scaling) |

## Behaviour

- All fields are optional. Absent → system default for that field.
- Invalid values (bad URL, non-positive dimension) → logged as warning, falls back to default for that field only.
- `imageUrl` unreachable at render time → falls back to local default banner, email still sends.

## Example: Full Config

```json
{
  "notifications": {
    "form_submitted": ["owner@clientsite.com"]
  },
  "banner": {
    "imageUrl": "https://cdn.clientsite.com/assets/logo-dark.png",
    "height": 80,
    "width": 320
  }
}
```

## Example: Landscape Logo (wide, short)

```json
{
  "banner": {
    "imageUrl": "https://cdn.clientsite.com/logo-horizontal.png",
    "height": 35,
    "width": 280
  }
}
```

## Example: Portrait Logo (tall, narrow)

```json
{
  "banner": {
    "imageUrl": "https://cdn.clientsite.com/logo-stacked.png",
    "height": 80,
    "width": 100
  }
}
```

## Example: Image Only, Default Dimensions

```json
{
  "banner": {
    "imageUrl": "https://cdn.clientsite.com/logo.png"
  }
}
```
