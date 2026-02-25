import { sendEmail } from "../src/lib/email";

sendEmail({
  to: "client@example.com",
  subject: "Weekly Analytics Report — Acme Corp",
  html: `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #1a1a1a;">Weekly Report</h1>
      <p>Hello Acme Corp,</p>
      <p>Here is your analytics summary for the week.</p>
      <table style="width:100%; border-collapse: collapse; margin-top: 16px;">
        <tr style="background:#f5f5f5;">
          <th style="padding:8px; text-align:left; border:1px solid #ddd;">Metric</th>
          <th style="padding:8px; text-align:right; border:1px solid #ddd;">Value</th>
        </tr>
        <tr>
          <td style="padding:8px; border:1px solid #ddd;">Page Views</td>
          <td style="padding:8px; text-align:right; border:1px solid #ddd;">12,340</td>
        </tr>
        <tr style="background:#f5f5f5;">
          <td style="padding:8px; border:1px solid #ddd;">Sessions</td>
          <td style="padding:8px; text-align:right; border:1px solid #ddd;">4,210</td>
        </tr>
        <tr>
          <td style="padding:8px; border:1px solid #ddd;">Conversions</td>
          <td style="padding:8px; text-align:right; border:1px solid #ddd;">87</td>
        </tr>
      </table>
      <p style="margin-top:24px; color:#666; font-size:13px;">
        This report was generated automatically by the notification service.
      </p>
    </div>
  `,
})
  .then((result) => console.log("Result:", result))
  .catch((err) => console.error("Error:", err.message));
