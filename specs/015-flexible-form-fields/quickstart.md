# Quickstart: Flexible Form Notification Fields (015)

Paste these directly into the **Inngest Dev Server UI** → "Send Event" panel.  
Run `npm run dev` first, then navigate to `http://localhost:8288`.

Seeded client IDs: `client-acme` (Acme Corp), `client-globex` (Globex Inc)

---

## Minimal — email address only

```json
{
  "name": "form/submitted",
  "data": {
    "clientId": "client-acme",
    "submitterEmail": "jane@example.com"
  }
}
```

Email renders a single Email field row. No name, no message, no CTA button.

---

## Only clientId (bare minimum)

```json
{
  "name": "form/submitted",
  "data": {
    "clientId": "client-acme"
  }
}
```

Email sends with no field rows and a generic subject: `New inquiry — Acme Corp`.

---

## Standard contact form

```json
{
  "name": "form/submitted",
  "data": {
    "clientId": "client-acme",
    "formName": "Contact Form",
    "submittedFrom": "/contact",
    "submitterName": "Jane Smith",
    "submitterEmail": "jane@example.com",
    "submitterPhone": "(555) 123-4567",
    "submitterMessage": "Hi, I'd like to discuss a project."
  }
}
```

Subject: `New form submission: Contact Form — Acme Corp`  
Email renders all six standard fields plus a Reply CTA button.

---

## Quote request with custom fields

```json
{
  "name": "form/submitted",
  "data": {
    "clientId": "client-acme",
    "formName": "Quote Request",
    "submittedFrom": "/services/web-design",
    "submitterName": "Jane Smith",
    "submitterEmail": "jane@example.com",
    "customFields": {
      "Project Budget": "$5,000–$10,000",
      "Timeline": "3 months",
      "Service Type": "Website Redesign"
    }
  }
}
```

Custom fields appear as additional rows below the standard fields.

---

## Globex — no notification preferences (falls back to client.email)

```json
{
  "name": "form/submitted",
  "data": {
    "clientId": "client-globex",
    "formName": "Contact Form",
    "submitterName": "Bob Jones",
    "submitterEmail": "bob@example.com",
    "submitterMessage": "Hello from Globex."
  }
}
```
