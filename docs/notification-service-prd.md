# Product Requirements Document: Notification Service PoC

**Document Version:** 1.1
**Last Updated:** February 13, 2026
**Status:** Draft
**Author:** Casey Ramirez

**Changelog:**
- v1.1: Added comprehensive multi-environment strategy (dev/preview/prod)
- v1.0: Initial draft

---

## Executive Summary

This document outlines the requirements for a Proof of Concept (PoC) notification service designed to handle event-driven and scheduled notifications for a multi-tenant web hosting business. The service will support multiple clients (currently 1, scaling to 100) with minimal infrastructure overhead, excellent developer experience, and AI-assisted workflow development.

### Key Goals
- Replace existing GCP Cloud Functions + Pub/Sub implementation
- Enable rapid development of new notification workflows
- Support AI-agent assisted workflow creation
- Maintain low operational costs and minimal infrastructure
- Provide excellent observability and debugging experience
- Support safe testing with isolated dev/preview/prod environments

---

## Problem Statement

### Current State
- **Platform:** GCP Cloud Functions + Pub/Sub Topics
- **Scale:** 1 client, ~2 notifications/day
- **Pain Points:**
  - Poor local development experience (requires emulators)
  - Difficult to debug (scattered logs in Cloud Logging)
  - Complex to add new workflows (multiple files, configuration)
  - Hard for AI agents to understand and extend
  - Split infrastructure (Vercel for apps, GCP for notifications)

### Desired State
- **Platform:** Inngest on Vercel
- **Scale:** 1-100 clients, 10-1000 notifications/day
- **Benefits:**
  - Excellent local development (no infrastructure needed)
  - Built-in observability UI
  - Simple, consistent patterns for AI agents
  - Consolidated platform (Vercel for everything)
  - Reusable, composable workflows

---

## Goals & Non-Goals

### Goals
1. **Prove Technical Viability:** Demonstrate Inngest can handle core use cases
2. **Establish Patterns:** Create reusable patterns for future workflows
3. **Enable AI Development:** Make codebase AI-agent friendly
4. **Validate Observability:** Confirm debugging/monitoring meets needs
5. **Test Multi-Tenancy:** Support multiple client configurations

### Non-Goals (For PoC)
- âŒ Production deployment (local/dev only)
- âŒ Full client self-service UI
- âŒ SMS or Slack notifications (email only)
- âŒ Advanced analytics/reporting
- âŒ Complex workflow orchestration
- âŒ Performance/load testing

---

## Use Cases

### Primary Use Cases (Must Have)

#### UC-1: Form Submission Notification
**Actor:** NextJS client website
**Trigger:** User submits a form
**Flow:**
1. NextJS app sends event to notification service
2. Service retrieves client configuration
3. Service formats form data
4. Service sends email to client's notification address
5. Service logs delivery result

**Success Criteria:** Email delivered within 10 seconds

---

#### UC-2: Weekly Analytics Report (Scheduled)
**Actor:** Cron scheduler
**Trigger:** Every Monday at 9:00 AM
**Flow:**
1. Scheduler triggers for all active clients
2. For each client (in parallel):
   - Fetch GA4 analytics data
   - Transform to standardized report format (JSON)
   - Template email from JSON
   - Send email to client
3. Log success/failure for each client

**Success Criteria:** All client reports sent within 5 minutes

---

#### UC-3: On-Demand Report Generation
**Actor:** Admin (developer)
**Trigger:** Manual event trigger
**Flow:**
1. Developer triggers event via Inngest UI or API
2. Service generates report for specified client
3. Service sends report immediately

**Success Criteria:** Can trigger manually and see results in UI

---

### Secondary Use Cases (Nice to Have)

#### UC-4: AI-Generated Content
**Actor:** Scheduled job or event
**Trigger:** Weekly or on-demand
**Flow:**
1. Fetch data from source (e.g., analytics, CRM)
2. Send to Claude API for summarization
3. Template AI-generated summary
4. Send email to client

**Success Criteria:** AI content integrated seamlessly

---

#### UC-5: AI-Assisted Workflow Creation
**Actor:** Developer + Claude AI Agent
**Trigger:** Developer instruction to AI
**Flow:**
1. Developer describes desired workflow to Claude
2. Claude reads workflow specs and template
3. Claude generates new workflow following patterns
4. Developer reviews and deploys

**Success Criteria:** Claude can create 80% working workflow from description

---

## Technical Architecture

### Technology Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **Event Platform** | Inngest | Event-driven, serverless, great DX |
| **Runtime** | Node.js 20+ | Modern, TypeScript support |
| **Language** | TypeScript | Type safety, AI-friendly |
| **Database** | Neon Postgres | Serverless, free tier, SQL |
| **Email Provider** | Resend | Simple API, generous free tier |
| **Hosting** | Vercel | Consolidate with NextJS apps |
| **AI Provider** | Anthropic Claude | Required per business needs |

### Architecture Diagram

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                     NextJS Client Apps                       â”‚
â”‚                    (Hosted on Vercel)                        â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
             â”‚
             â”‚ Send Event
             â†“
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                    Inngest Event Bus                         â”‚
â”‚                  (Managed Service)                           â”‚
â””â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
     â”‚
     â”œâ”€â†’ Event: form/submitted
     â”œâ”€â†’ Event: analytics/report.requested
     â””â”€â†’ Event: custom/workflow.triggered
             â”‚
             â†“
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚              Notification Service Functions                  â”‚
â”‚                  (Vercel Functions)                          â”‚
â”‚                                                              â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”             â”‚
â”‚  â”‚  Function: generate-analytics-report       â”‚             â”‚
â”‚  â”‚  Steps:                                    â”‚             â”‚
â”‚  â”‚    1. Fetch GA4 data                       â”‚             â”‚
â”‚  â”‚    2. Transform to JSON                    â”‚             â”‚
â”‚  â”‚    3. Template email                       â”‚             â”‚
â”‚  â”‚    4. Send email                           â”‚             â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜             â”‚
â”‚                                                              â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”             â”‚
â”‚  â”‚  Function: send-form-notification          â”‚             â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜             â”‚
â””â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
      â”‚                                   â”‚
      â”‚                                   â”‚
      â†“                                   â†“
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚   Resend     â”‚                  â”‚    Neon      â”‚
â”‚   (Email)    â”‚                  â”‚  (Database)  â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Project Structure

```
notification-service/
â”œâ”€â”€ README.md
â”œâ”€â”€ package.json
â”œâ”€â”€ tsconfig.json
â”œâ”€â”€ .gitignore
â”œâ”€â”€ .env.local                    # Local environment variables (gitignored)
â”œâ”€â”€ .env.example                  # Template for env vars (committed)
â”‚
â”œâ”€â”€ specs/                        # Workflow specifications (for AI)
â”‚   â”œâ”€â”€ README.md
â”‚   â”œâ”€â”€ form-notification.md
â”‚   â”œâ”€â”€ weekly-analytics.md
â”‚   â””â”€â”€ template.md              # Template for new workflows
â”‚
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ index.ts                 # Main entry point
â”‚   â”‚
â”‚   â”œâ”€â”€ inngest/
â”‚   â”‚   â”œâ”€â”€ client.ts            # Inngest client setup (environment-aware)
â”‚   â”‚   â””â”€â”€ functions/           # All Inngest functions
â”‚   â”‚       â”œâ”€â”€ template.ts      # Template for AI to copy
â”‚   â”‚       â”œâ”€â”€ form-notification.ts
â”‚   â”‚       â”œâ”€â”€ weekly-analytics.ts
â”‚   â”‚       â””â”€â”€ index.ts         # Export all functions
â”‚   â”‚
â”‚   â”œâ”€â”€ lib/
â”‚   â”‚   â”œâ”€â”€ config.ts           # Environment configuration
â”‚   â”‚   â”œâ”€â”€ db.ts               # Database client & queries
â”‚   â”‚   â”œâ”€â”€ analytics.ts        # GA4 integration
â”‚   â”‚   â”œâ”€â”€ email.ts            # Email provider abstraction (env-aware)
â”‚   â”‚   â””â”€â”€ templates.ts        # Email templates
â”‚   â”‚
â”‚   â”œâ”€â”€ types/
â”‚   â”‚   â””â”€â”€ index.ts            # Shared TypeScript types
â”‚   â”‚
â”‚   â””â”€â”€ utils/
â”‚       â””â”€â”€ logger.ts           # Logging utilities
â”‚
â”œâ”€â”€ .claude/
â”‚   â””â”€â”€ CLAUDE.md               # Instructions for AI agents
â”‚
â””â”€â”€ scripts/
    â”œâ”€â”€ setup-db.ts             # Database schema setup
    â”œâ”€â”€ seed-data.ts            # Seed test clients
    â””â”€â”€ test-event.ts           # Send test events
```

---

## Environment Strategy

### Overview

The notification service supports three isolated environments with automatic branching via Inngest and Vercel:

| Environment | Purpose | Trigger | Email Behavior | Database |
|-------------|---------|---------|----------------|----------|
| **Development** | Local coding | `npm run dev` | Mock (console.log) | Local or dev DB |
| **Preview** | PR testing | Push to branch | Test (redirected) | Staging DB |
| **Production** | Live system | Merge to main | Live (real emails) | Production DB |

### Environment Isolation

Inngest automatically creates branch environments based on deployment context:

```typescript
// src/inngest/client.ts
import { Inngest } from 'inngest';

const env = process.env.VERCEL_ENV || 'development';

export const inngest = new Inngest({
  id: 'notification-service',
  env, // Automatically creates separate environments
  eventKey: process.env.INNGEST_EVENT_KEY,
});
```

**What's Isolated:**
- âœ… Function runs (separate history per environment)
- âœ… Event processing (events in preview don't affect production)
- âœ… Retries (failed runs don't cross environments)
- âœ… UI Dashboard (filter by environment)

**What Requires Configuration:**
- âš ï¸ Database (use separate DATABASE_URL per environment)
- âš ï¸ Email sending (configure EMAIL_MODE per environment)
- âš ï¸ External APIs (use test/sandbox modes where available)

### Configuration Management

```typescript
// src/lib/config.ts
export const config = {
  env: process.env.VERCEL_ENV || 'development',
  isProd: process.env.VERCEL_ENV === 'production',
  isPreview: process.env.VERCEL_ENV === 'preview',
  isDev: !process.env.VERCEL_ENV || process.env.VERCEL_ENV === 'development',

  email: {
    mode: process.env.EMAIL_MODE || (
      process.env.VERCEL_ENV === 'production' ? 'live' :
      process.env.VERCEL_ENV === 'preview' ? 'test' :
      'mock'
    ),
    testRecipient: process.env.TEST_EMAIL || 'test@yourdomain.com',
  },

  database: {
    url: process.env.DATABASE_URL,
  },

  inngest: {
    eventKey: process.env.INNGEST_EVENT_KEY,
    signingKey: process.env.INNGEST_SIGNING_KEY,
  },

  resend: {
    apiKey: process.env.RESEND_API_KEY,
  },
};
```

### Email Behavior Per Environment

```typescript
// src/lib/email.ts
import { config } from './config';
import { Resend } from 'resend';

const resend = new Resend(config.resend.apiKey);

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export async function sendEmail(options: EmailOptions) {
  const { mode, testRecipient } = config.email;

  switch (mode) {
    case 'mock':
      // Development: Just log, don't send
      console.log('ðŸ“§ [MOCK] Would send email:', {
        to: options.to,
        subject: options.subject,
        bodyLength: options.html.length,
      });
      return {
        id: `mock-${Date.now()}`,
        success: true,
        env: 'development'
      };

    case 'test':
      // Preview: Send to test address with context
      console.log('ðŸ“§ [TEST] Redirecting email to test address:', testRecipient);
      console.log('    Original recipient:', options.to);

      return await resend.emails.send({
        from: options.from || 'notifications@yourdomain.com',
        to: testRecipient,
        subject: `[TEST: ${options.to}] ${options.subject}`,
        html: `
          <div style="border: 2px solid orange; padding: 10px; margin-bottom: 20px;">
            <strong>âš ï¸ TEST EMAIL</strong><br>
            Original Recipient: ${options.to}<br>
            Environment: Preview
          </div>
          ${options.html}
        `,
      });

    case 'live':
      // Production: Send for real
      console.log('ðŸ“§ [LIVE] Sending email to:', options.to);
      return await resend.emails.send({
        from: options.from || 'notifications@yourdomain.com',
        to: options.to,
        subject: options.subject,
        html: options.html,
      });

    default:
      throw new Error(`Unknown EMAIL_MODE: ${mode}`);
  }
}
```

### Database Per Environment

Use Neon's database branching feature for automatic preview databases:

**Setup:**
1. **Production Database:** Main Neon project
2. **Preview Databases:** Auto-created branches (one per PR)
3. **Development Database:** Local Postgres or Neon dev branch

**Configuration in Vercel:**
```bash
# Production environment variables
DATABASE_URL=postgresql://prod-connection-string

# Preview environment variables (use Neon branching)
DATABASE_URL=postgresql://preview-connection-string

# Local (.env.local)
DATABASE_URL=postgresql://localhost:5432/notification_service_dev
```

**Neon Auto-Branching:**
Neon can automatically create a database branch for each Vercel preview deployment:
- Each preview gets a copy of production data
- Changes in preview don't affect production
- Branches auto-delete when PR closes

### Environment Flow Diagram

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  LOCAL DEVELOPMENT                                         â”‚
â”‚  â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€  â”‚
â”‚  Branch: feature/new-workflow                              â”‚
â”‚  Command: npm run dev                                      â”‚
â”‚  Inngest: http://localhost:8288 (dev environment)          â”‚
â”‚  Email: MOCK (console.log only)                            â”‚
â”‚  Database: Local Postgres / Neon dev branch                â”‚
â”‚  Testing: Manual triggers via UI, instant feedback         â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                        â”‚
                        â”‚ git push origin feature/new-workflow
                        â†“
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  PREVIEW (STAGING)                                         â”‚
â”‚  â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€  â”‚
â”‚  Branch: feature/new-workflow                              â”‚
â”‚  URL: https://app-git-feature-new-workflow.vercel.app      â”‚
â”‚  Inngest: preview-feature-new-workflow environment         â”‚
â”‚  Email: TEST (redirect to test@yourdomain.com)             â”‚
â”‚  Database: Neon preview branch (auto-created)              â”‚
â”‚  Testing: Safe testing with real infrastructure            â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                        â”‚
                        â”‚ Merge PR to main
                        â†“
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  PRODUCTION                                                â”‚
â”‚  â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€  â”‚
â”‚  Branch: main                                              â”‚
â”‚  URL: https://notification-service.vercel.app              â”‚
â”‚  Inngest: production environment                           â”‚
â”‚  Email: LIVE (send to real client emails)                  â”‚
â”‚  Database: Production Neon database                        â”‚
â”‚  Testing: Real client events, monitored carefully          â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Development Workflow

#### 1. Local Development
```bash
# Start local dev server
npm run dev

# Environment: development
# Inngest UI: http://localhost:8288
# Email Mode: mock (console.log only)
# Database: Local Postgres
```

**Testing locally:**
1. Open http://localhost:8288
2. Click "Send Event"
3. Fill in test data
4. Watch execution in real-time
5. Check console for mocked emails

#### 2. Preview Deployment (PR)
```bash
# Create feature branch
git checkout -b feature/new-workflow

# Make changes, commit, push
git push origin feature/new-workflow

# Vercel automatically deploys preview
# URL: https://notification-service-git-feature-new-workflow.vercel.app
```

**Preview Environment:**
- Inngest creates branch environment: `preview-feature-new-workflow`
- Email mode: `test` (sends to TEST_EMAIL address)
- Database: Neon preview branch (isolated data)
- Can test workflows without affecting production

**Testing in preview:**
1. Open https://app.inngest.com
2. Filter by environment: "preview-feature-new-workflow"
3. Trigger test event via API or UI
4. Check test email inbox for results
5. Verify data in preview database

#### 3. Production Deployment
```bash
# Merge PR to main
git checkout main
git merge feature/new-workflow
git push origin main

# Vercel deploys to production
```

**Production Environment:**
- Inngest environment: `production`
- Email mode: `live` (sends real emails)
- Database: Production Neon database
- Real events from NextJS client apps

### Safety Features

Prevent accidental production impacts:

```typescript
// src/inngest/functions/weekly-analytics.ts
import { inngest } from '../client';
import { config } from '../../lib/config';

export const scheduleWeeklyReports = inngest.createFunction(
  {
    id: "schedule-weekly-reports",
    // Rate limit in non-production to prevent accidents
    rateLimit: config.isProd ? undefined : {
      limit: 1,
      period: '1h'
    }
  },
  { cron: "0 9 * * MON" },
  async ({ step }) => {
    // Safety check
    if (!config.isProd) {
      console.warn('âš ï¸  Running in non-production mode');
    }

    const clients = await step.run("get-clients", () =>
      getActiveClients()
    );

    // In dev/preview, limit to test clients only
    const clientsToProcess = config.isProd
      ? clients
      : clients.filter(c => c.email.includes('test'));

    console.log(`Processing ${clientsToProcess.length} clients in ${config.env}`);

    // Fan out to individual reports
    await step.run("fan-out", () =>
      inngest.send(
        clientsToProcess.map(client => ({
          name: "analytics/report.requested",
          data: {
            clientId: client.id,
            ga4PropertyId: client.ga4PropertyId,
            email: client.email
          }
        }))
      )
    );
  }
);
```

### Environment-Specific Testing

**Functional Requirement: FR-9 (Multi-Environment Support)**

- [ ] Local development runs with mocked emails
- [ ] Preview environment sends test emails only
- [ ] Production sends real emails to clients
- [ ] Each environment has isolated Inngest history
- [ ] Preview databases don't affect production data
- [ ] Can trigger workflows in any environment independently
- [ ] Environment indicated in logs and UI
- [ ] Safety limits prevent accidental production runs from dev/preview

### Observability Across Environments

**Inngest Dashboard Filtering:**
```
Environments:
  â”œâ”€ development (local runs)
  â”œâ”€ preview-feature-new-workflow (PR #123)
  â”œâ”€ preview-fix-bug (PR #124)
  â””â”€ production (live system)
```

Each environment shows:
- Function runs with status
- Step-by-step execution
- Input/output data
- Logs and errors
- Retry attempts

**Debugging workflow:**
1. Identify environment where issue occurred
2. Filter Inngest dashboard by that environment
3. Find the failed run
4. Review step-by-step execution
5. Check logs and error messages
6. Replay in preview environment to test fix

### Environment Variables Summary

See [Appendix A](#a-environment-variables) for complete list.

**Required per environment:**
- `INNGEST_EVENT_KEY` - Inngest authentication
- `DATABASE_URL` - Database connection string
- `RESEND_API_KEY` - Email provider key
- `EMAIL_MODE` - `mock` / `test` / `live`
- `TEST_EMAIL` - Where to send test emails (preview only)

**Vercel Setup:**
1. Set production values in Production environment variables
2. Set preview values in Preview environment variables
3. Set development values in Development environment variables
4. Use `.env.local` for local development (not committed)

---

## Functional Requirements

### FR-1: Event-Driven Notifications
**Priority:** P0 (Must Have)

- [ ] Service accepts events from NextJS apps
- [ ] Events include: event name, client ID, payload data
- [ ] Service routes events to appropriate handlers
- [ ] Handlers execute independently (failure isolation)
- [ ] Failed events retry automatically (3 attempts)

### FR-2: Scheduled Workflows
**Priority:** P0 (Must Have)

- [ ] Support cron-based scheduling
- [ ] Weekly analytics report runs every Monday 9am
- [ ] Scheduler fans out to individual client workflows
- [ ] Each client workflow runs in parallel
- [ ] Failures for one client don't block others

### FR-3: Multi-Tenant Configuration
**Priority:** P0 (Must Have)

- [ ] Store client configs in database
- [ ] Each client has: ID, GA4 property ID, email, active status
- [ ] Workflows fetch client config dynamically
- [ ] Support multiple clients (1-100)
- [ ] Easy to add/remove clients

### FR-4: Email Notifications
**Priority:** P0 (Must Have)

- [ ] Send emails via Resend API
- [ ] Support HTML templates
- [ ] Include client-specific data in emails
- [ ] Log email delivery status
- [ ] Handle failures gracefully

### FR-5: Analytics Integration
**Priority:** P1 (Should Have)

- [ ] Fetch data from Google Analytics 4
- [ ] Support configurable metrics
- [ ] Transform to standardized JSON format
- [ ] Reusable across workflows

### FR-6: Observability
**Priority:** P0 (Must Have)

- [ ] All workflow runs visible in UI
- [ ] Track individual step execution
- [ ] Log inputs/outputs per step
- [ ] Display errors with stack traces
- [ ] Support manual replay of failed runs

### FR-7: Local Development
**Priority:** P0 (Must Have)

- [ ] Run entire service locally with `npm run dev`
- [ ] No Docker/infrastructure required
- [ ] Inngest Dev UI accessible locally
- [ ] Can trigger test events from UI
- [ ] Hot reload on code changes

### FR-8: AI-Friendly Codebase
**Priority:** P1 (Should Have)

- [ ] Consistent patterns across all workflows
- [ ] Clear, descriptive function names
- [ ] Workflow specs in markdown format
- [ ] Template file for new workflows
- [ ] Instructions for AI in `.claude/CLAUDE.md`

### FR-9: Multi-Environment Support
**Priority:** P0 (Must Have)

- [ ] Support development, preview, and production environments
- [ ] Automatic environment detection (via VERCEL_ENV)
- [ ] Mock email sending in development
- [ ] Test email redirects in preview
- [ ] Live email sending in production only
- [ ] Separate databases per environment
- [ ] Inngest branch environments auto-created
- [ ] Environment-specific safety limits
- [ ] Clear environment indicators in logs

---

## Non-Functional Requirements

### NFR-1: Performance
- [ ] Email notifications sent within 10 seconds of event
- [ ] Weekly reports for 100 clients complete within 5 minutes
- [ ] Individual workflow steps timeout after 30 seconds
- [ ] Database queries return within 1 second

### NFR-2: Reliability
- [ ] 99% email delivery success rate
- [ ] Automatic retries on transient failures
- [ ] Failed workflows don't lose data
- [ ] Graceful degradation on provider outages

### NFR-3: Scalability
- [ ] Support 1-100 clients without code changes
- [ ] Handle 1000 notifications/day
- [ ] Parallel execution for scheduled workflows
- [ ] Database handles 100 concurrent connections

### NFR-4: Cost
- [ ] Stay within free tiers during PoC
  - Inngest: 50k runs/month free
  - Resend: 3k emails/month free
  - Neon: 512MB database free
  - Vercel: Hobby plan
- [ ] Projected cost for 100 clients < $50/month

### NFR-5: Developer Experience
- [ ] Setup time: < 15 minutes
- [ ] New workflow creation: < 30 minutes (with AI)
- [ ] Debug failed workflow: < 5 minutes
- [ ] Deploy changes: < 2 minutes

### NFR-6: Security
- [ ] API keys stored in environment variables
- [ ] Database credentials not committed to git
- [ ] Client data isolated per tenant
- [ ] Email addresses validated before sending

---

## Data Model

### Database Schema

#### `clients` table
```sql
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  ga4_property_id VARCHAR(50),
  active BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### `notification_logs` table (optional for PoC)
```sql
CREATE TABLE notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  workflow_name VARCHAR(100) NOT NULL,
  event_name VARCHAR(100),
  status VARCHAR(20) NOT NULL, -- 'sent', 'failed', 'retrying'
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Event Schemas

#### `form/submitted`
```typescript
{
  name: "form/submitted",
  data: {
    clientId: string;
    formType: "contact" | "quote" | "support";
    formData: Record<string, any>;
    submittedAt: string; // ISO timestamp
  }
}
```

#### `analytics/report.requested`
```typescript
{
  name: "analytics/report.requested",
  data: {
    clientId: string;
    ga4PropertyId: string;
    email: string;
    reportType?: "weekly" | "monthly";
  }
}
```

---

## Success Criteria

### PoC Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| **Setup Time** | < 15 min | Time from clone to running locally |
| **Local Dev Works** | 100% | Can send test events, see results |
| **Workflow Creation** | < 30 min | Time to add new workflow with AI help |
| **Email Delivery** | > 95% | % of test emails successfully sent |
| **Observability** | 100% | Can debug any failed workflow |
| **Multi-Tenant** | 100% | Works with 3+ test clients |
| **Multi-Environment** | 100% | Dev/preview/prod work correctly |
| **AI Extension** | 80% | Claude generates working workflow from spec |

### PoC Deliverables

- [ ] Working codebase running locally
- [ ] 2-3 example workflows implemented
- [ ] Multi-environment support (dev/preview/prod)
- [ ] Environment-aware email sending (mock/test/live)
- [ ] Database setup with seed data
- [ ] Documentation (README, specs, environment setup)
- [ ] AI agent instructions (CLAUDE.md)
- [ ] Demo video showing key features across environments

---

## Timeline & Milestones

### Phase 1: Foundation (Day 1)
- [ ] Project setup (package.json, TypeScript)
- [ ] Environment configuration system
- [ ] Inngest client configuration (environment-aware)
- [ ] Database setup (Neon with branching)
- [ ] Environment variables (.env.example, .env.local)
- [ ] Email provider with environment modes

### Phase 2: Core Workflows (Day 1-2)
- [ ] Form notification workflow
- [ ] Weekly analytics workflow
- [ ] Client configuration system
- [ ] Environment-specific safety features

### Phase 3: Multi-Environment Testing (Day 2)
- [ ] Test locally (mock emails)
- [ ] Test with multiple clients
- [ ] Deploy to preview (test email redirects)
- [ ] Verify Inngest branch environments
- [ ] Test failure scenarios across environments
- [ ] Document debugging process

### Phase 4: AI Integration (Day 2-3)
- [ ] Create workflow specs
- [ ] Write AI agent instructions
- [ ] Test AI-assisted workflow creation
- [ ] Refine patterns for AI

### Phase 5: Documentation (Day 3)
- [ ] README with setup instructions
- [ ] Workflow documentation
- [ ] Architecture diagrams
- [ ] Demo video

**Total Timeline:** 3 days

---

## Future Considerations

### Post-PoC Enhancements

1. **Additional Channels**
   - SMS notifications (Twilio)
   - Slack messages (Slack API)
   - Push notifications (Firebase)

2. **Client Self-Service**
   - Admin UI for clients to configure notifications
   - Template editor for email customization
   - Analytics dashboard

3. **Advanced Features**
   - A/B testing for email templates
   - Rate limiting per client
   - Notification preferences (frequency, channel)
   - Webhook support (send to client's endpoints)

4. **Production Readiness**
   - Monitoring & alerting (Sentry, Datadog)
   - Load testing
   - Security audit
   - Backup & disaster recovery

5. **AI Enhancements**
   - AI-generated email content
   - Smart scheduling (optimal send times)
   - Anomaly detection (unusual metrics)
   - Auto-summarization of complex data

---

## Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Inngest doesn't meet needs** | High | Low | Keep PoC scope small, easy to pivot |
| **GA4 API complexity** | Medium | Medium | Start with simple metrics, mock if needed |
| **Database setup issues** | Low | Low | Use Neon's quick setup, fallback to SQLite |
| **AI patterns don't work** | Medium | Medium | Manual workflow creation still works |
| **Cost overruns** | Medium | Low | Monitor usage, stay in free tiers |
| **Email deliverability** | High | Low | Use Resend's verified domains |

---

## Appendix

### A. Environment Variables

#### Development (.env.local)
```bash
# Environment
NODE_ENV=development
VERCEL_ENV=development

# Inngest (get from https://app.inngest.com)
INNGEST_EVENT_KEY=test_your_event_key
INNGEST_SIGNING_KEY=signkey-test-xxx

# Database - Local Postgres or Neon dev branch
DATABASE_URL=postgresql://localhost:5432/notification_service_dev
# Or: postgresql://neon-dev-branch-url

# Email - Mock mode (no real emails sent)
RESEND_API_KEY=re_xxx  # Can use test API key
EMAIL_MODE=mock

# Test email address (not used in mock mode)
TEST_EMAIL=dev@yourdomain.com

# GA4 (optional for PoC)
GA4_CREDENTIALS=./credentials/ga4-dev-credentials.json

# AI (optional for PoC)
ANTHROPIC_API_KEY=sk-ant-dev-xxx
```

#### Preview (Vercel Preview Environment Variables)
```bash
# Environment (set by Vercel automatically)
VERCEL_ENV=preview

# Inngest
INNGEST_EVENT_KEY=test_your_event_key
INNGEST_SIGNING_KEY=signkey-test-xxx

# Database - Neon preview branch (auto-created per PR)
DATABASE_URL=postgresql://neon-preview-branch-url

# Email - Test mode (redirects to test address)
RESEND_API_KEY=re_xxx
EMAIL_MODE=test
TEST_EMAIL=preview-testing@yourdomain.com

# GA4 - Can use sandbox/test property
GA4_CREDENTIALS=base64_encoded_credentials

# AI
ANTHROPIC_API_KEY=sk-ant-preview-xxx
```

#### Production (Vercel Production Environment Variables)
```bash
# Environment (set by Vercel automatically)
VERCEL_ENV=production

# Inngest - Production keys
INNGEST_EVENT_KEY=prod_your_event_key
INNGEST_SIGNING_KEY=signkey-prod-xxx

# Database - Production Neon database
DATABASE_URL=postgresql://neon-production-url

# Email - Live mode (sends real emails)
RESEND_API_KEY=re_live_xxx
EMAIL_MODE=live

# No TEST_EMAIL needed in production

# GA4 - Production credentials
GA4_CREDENTIALS=base64_encoded_production_credentials

# AI
ANTHROPIC_API_KEY=sk-ant-prod-xxx
```

#### .env.example (Template for team)
```bash
# Copy this to .env.local and fill in your values

# Environment
NODE_ENV=development
VERCEL_ENV=development

# Inngest (get from https://app.inngest.com)
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

# Database
DATABASE_URL=postgresql://localhost:5432/notification_service_dev

# Email
RESEND_API_KEY=
EMAIL_MODE=mock
TEST_EMAIL=test@yourdomain.com

# GA4 (optional)
GA4_CREDENTIALS=

# AI (optional)
ANTHROPIC_API_KEY=
```

### B. Key Dependencies

```json
{
  "dependencies": {
    "inngest": "^3.x",
    "@neondatabase/serverless": "^0.9.x",
    "resend": "^3.x",
    "@google-analytics/data": "^4.x",
    "anthropic": "^0.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "@types/node": "^20.x",
    "tsx": "^4.x"
  }
}
```

### C. Reference Links

- [Inngest Documentation](https://www.inngest.com/docs)
- [Resend Documentation](https://resend.com/docs)
- [Neon Documentation](https://neon.tech/docs)
- [GA4 API Reference](https://developers.google.com/analytics/devguides/reporting/data/v1)

---

## Approval & Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| **Developer** | Casey Ramirez | 2026-02-13 | âœ“ |
| **Reviewer** | TBD | | |

---

**Document Status:** Ready for Development
**Next Steps:** Begin Phase 1 - Foundation setup