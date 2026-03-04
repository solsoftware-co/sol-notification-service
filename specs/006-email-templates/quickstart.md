# Quickstart: Email Templates

**Feature**: 006-email-templates
**Date**: 2026-03-03

This guide covers the three most common tasks developers will perform with the email template system.

---

## 1. Preview an email locally

Run the preview script to render an email to a local HTML file and open it in a browser:

```bash
npm run email:preview
```

The script (`scripts/test-email-preview.ts`) renders both the inquiry and analytics email templates with mock data and writes the output to `.email-preview/last.html`.

To preview a specific template, pass the type flag:

```bash
npm run email:preview -- --type inquiry
npm run email:preview -- --type analytics
```

---

## 2. Add a new email template

### Step 1 — Create the component

Create a new file in `src/emails/templates/`:

```
src/emails/templates/my-notification-v1.tsx
```

The template must:
- Accept typed props (define an interface at the top of the file)
- Use only components from `src/emails/components/` and `@react-email/components`
- Style exclusively via tokens from `src/emails/styles.ts` — never write raw colour/font values
- Include `<Banner />` as the first body element
- Include `<EmailFooter />` as the last element inside the content container
- Include `<Preview>` from `@react-email/components` inside `<Head>` for inbox preview text

Minimal structure:

```tsx
import { Html, Head, Preview, Body, Container } from "@react-email/components";
import { Banner } from "../components/banner";
import { EmailHeader } from "../components/email-header";
import { EmailFooter } from "../components/email-footer";
import { bodyStyle, containerStyle, contentContainerStyle } from "../styles";

type MyNotificationProps = {
  previewText: string;
  subheader: string;
  header: string;
  // ... your fields
};

export default function MyNotificationV1Email(props: MyNotificationProps) {
  return (
    <Html>
      <Head>
        <Preview>{props.previewText}</Preview>
      </Head>
      <Body style={bodyStyle}>
        <Banner />
        <div style={containerStyle}>
          <Container style={contentContainerStyle}>
            <EmailHeader subheader={props.subheader} header={props.header} />
            {/* your content sections */}
            <EmailFooter />
          </Container>
        </div>
      </Body>
    </Html>
  );
}
```

### Step 2 — Add a render function

Add a new exported function to `src/lib/templates.ts`:

```typescript
export async function renderMyNotificationEmail(
  data: MyNotificationData,
  client: ClientRow
): Promise<EmailRenderResult> {
  const banner = await loadBannerAttachment();
  const html = await render(
    <MyNotificationV1Email
      previewText={`...`}
      subheader={client.name}
      header="My Notification"
      // map data fields to props
    />
  );
  return {
    subject: `My notification — ${client.name}`,
    html,
    attachments: [banner],
  };
}
```

### Step 3 — Call from workflow function

Inside your Inngest function's `step.run("send-email", ...)`:

```typescript
const rendered = await renderMyNotificationEmail(data, client);
return sendEmail({
  to: client.email,
  subject: rendered.subject,
  html: rendered.html,
  attachments: rendered.attachments,
});
```

---

## 3. Update brand colours or typography

All visual tokens are defined in `src/emails/styles.ts`. This is the single file to change for brand updates.

**Do not** write colour or font values anywhere else — only in `src/emails/styles.ts`.

Key token groups:
- `colors` — primary, secondary, background, surface, text, link colours
- `typography` — font families, sizes, weights, letter spacing
- `spacing` — padding and margin values used in components
- `radii` — border radius values for cards and containers

After changing a token, run `npm run email:preview` to verify both templates render correctly.

---

## File structure reference

```
src/emails/
├── styles.ts                    # Design tokens — the only place for colours/fonts
├── components/
│   ├── banner.tsx               # Sol Software logo header (uses CID image)
│   ├── email-header.tsx         # Subheader + headline text block
│   ├── email-footer.tsx         # Footer with copyright and automated notice
│   ├── stat-card.tsx            # Metric display (title, large value, description)
│   ├── chart-card.tsx           # Chart image with title and description
│   ├── data-row.tsx             # Labelled key-value row pair
│   └── data-table.tsx           # Sortable data rows with header (top sources, pages)
└── templates/
    ├── sales-lead-v1.tsx        # Inquiry / sales lead email (full feature set)
    └── analytics-report-v1.tsx  # Weekly analytics report email

src/lib/
└── templates.ts                 # Render functions: renderFormNotificationEmail(),
                                 #   renderAnalyticsReportEmail()

assets/
└── banner_image.png             # Logo file for CID attachment
```
