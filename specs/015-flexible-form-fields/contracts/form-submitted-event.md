# Event Contract: `form/submitted`

**Version**: 2.0  
**Feature**: 015-flexible-form-fields  
**Status**: Updated (replaces v1.0 from feature 003)

---

## Overview

The `form/submitted` event triggers the `send-form-notification` Inngest function. It is fired by client web applications when a visitor submits a form. The notification service routes the event to the appropriate client recipients and sends a formatted notification email.

---

## Event Shape

```
Event name: "form/submitted"

Payload {
  clientId:         string            REQUIRED
  submitterName?:   string            optional
  submitterEmail?:  string            optional
  submitterPhone?:  string            optional
  submitterMessage?: string           optional
  submittedFrom?:   string            optional
  formName?:        string            optional
  customFields?:    { [key: string]: string }  optional
  formId?:          string            DEPRECATED — ignored
}
```

---

## Field Reference

### `clientId` *(required)*
The identifier of the client whose notification recipients should receive the email. Must match a record in the clients database.

- Example: `"acme-co"`
- Validation: Non-empty string. Workflow aborts with an error if absent or empty.

---

### `submitterName` *(optional)*
Full name of the person who submitted the form.

- Example: `"Jane Smith"`
- Used in: email body (Name field), email preview text, reply CTA button label

---

### `submitterEmail` *(optional)*
Email address of the form submitter.

- Example: `"jane@example.com"`
- Used in: email body (Email field with mailto link), reply CTA button href
- Note: When absent, the reply CTA button is omitted from the notification email.

---

### `submitterPhone` *(optional)*
Phone number of the form submitter, in any format.

- Example: `"(555) 123-4567"` or `"+15551234567"`
- Used in: email body (Phone field with tel link)

---

### `submitterMessage` *(optional)*
Free-text message or comments from the submitter.

- Example: `"Hi, I'd like to get a quote for a new website."`
- Used in: email body (Comments section)

---

### `submittedFrom` *(optional)*
URL path of the page where the form was submitted.

- Example: `"/contact"`, `"/services/web-design"`, `"/home"`
- Used in: email body (Source Page field)
- Note: Full URLs are also accepted; the value is rendered as-is.

---

### `formName` *(optional)*
Human-readable name of the form. Used to identify which form generated the submission when a client has multiple forms.

- Example: `"Contact Form"`, `"Quote Request"`, `"Newsletter Sign-up"`
- Used in: email subject line (`New form submission: <formName> — <Client Name>`)
- Note: When absent, the generic subject `New inquiry — <Client Name>` is used.

---

### `customFields` *(optional)*
Arbitrary key-value pairs for data that doesn't fit any standard field. Keys are the field labels; values are plain-text strings.

- Example: `{ "Project Budget": "$5,000–$10,000", "Timeline": "3 months" }`
- Used in: email body (Additional Details section)
- Constraints: Values are rendered as plain text (HTML characters are escaped). An empty object is treated as absent.

---

### `formId` *(deprecated — ignored)*
Previously used as a machine-readable form identifier. Replaced by `formName`. Callers should migrate to `formName`. This field is accepted but not rendered or logged.

---

## Subject Line Logic

| Condition | Subject |
|---|---|
| `formName` is present | `New form submission: <formName> — <Client Name>` |
| `formName` is absent | `New inquiry — <Client Name>` |

---

## Minimal Valid Payload

```json
{
  "clientId": "acme-co"
}
```

## Full Payload Example

```json
{
  "clientId": "acme-co",
  "submitterName": "Jane Smith",
  "submitterEmail": "jane@example.com",
  "submitterPhone": "(555) 123-4567",
  "submitterMessage": "Hi, I'd like a quote for a website redesign.",
  "submittedFrom": "/services/web-design",
  "formName": "Quote Request",
  "customFields": {
    "Project Budget": "$5,000–$10,000",
    "Timeline": "3 months",
    "Service Type": "Website Redesign"
  }
}
```

## Legacy Payload (still valid — backward compatible)

```json
{
  "clientId": "acme-co",
  "submitterName": "Jane Smith",
  "submitterEmail": "jane@example.com",
  "submitterMessage": "Hi, I'd like a quote.",
  "formId": "contact"
}
```

---

## Version History

| Version | Feature | Change |
|---|---|---|
| 1.0 | 003-form-notification | Initial event. `submitterName`, `submitterEmail`, `submitterMessage` were required. `formId` was optional. |
| 2.0 | 015-flexible-form-fields | All fields except `clientId` made optional. Added `submitterPhone`, `submittedFrom`, `formName`, `customFields`. Deprecated `formId`. |
