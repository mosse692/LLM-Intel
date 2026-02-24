# Multi-Tenancy Guide

## Problem
Different teams using LLM Copilot need to see their own data, not mixed with other teams.

## Solutions

### Option 1: Separate Instances (Recommended for MVP)

**Each team runs their own instance**

```bash
# Team A
cd /Users/teamA/llm-copilot
PORT=8787 npm start

# Team B
cd /Users/teamB/llm-copilot
PORT=8788 npm start

# Team C
cd /Users/teamC/llm-copilot
PORT=8789 npm start
```

**Pros:**
- ✅ Zero code changes
- ✅ Complete data isolation
- ✅ Each team controls their config
- ✅ No authentication needed

**Cons:**
- ❌ Requires separate deployments
- ❌ Can't see cross-team metrics

---

### Option 2: Project ID in API Calls

**Add a `projectId` to all API calls**

```javascript
// Team A's code
await fetch('http://localhost:8787/api/v1/infer', {
  method: 'POST',
  body: JSON.stringify({
    projectId: 'team-a-product',  // ← Add this
    prompt: 'Hello',
    model: 'gpt-4'
  })
});

// Team B's code
await fetch('http://localhost:8787/api/v1/infer', {
  method: 'POST',
  body: JSON.stringify({
    projectId: 'team-b-analytics',  // ← Add this
    prompt: 'Hello',
    model: 'gpt-4'
  })
});
```

**Dashboard URL:**
```
http://localhost:8787?project=team-a-product
http://localhost:8787?project=team-b-analytics
```

**Implementation Required:**
1. Add `projectId` field to events
2. Filter dashboard by query param
3. Update all API endpoints to accept `projectId`

---

### Option 3: Subdomain/Path-based

**Each team gets their own URL**

```
http://team-a.llm-copilot.com
http://team-b.llm-copilot.com

OR

http://llm-copilot.com/team-a
http://llm-copilot.com/team-b
```

Requires: Reverse proxy (nginx) + authentication

---

### Option 4: Database-per-Team

**Use Postgres with separate databases**

```bash
# Team A
DATABASE_URL=postgresql://localhost:5432/llm_copilot_team_a npm start

# Team B
DATABASE_URL=postgresql://localhost:5432/llm_copilot_team_b npm start
```

---

## Recommended Approach for Different Scenarios

### Scenario 1: Small Startup (1-3 teams)
**Use Option 1: Separate Instances**

```bash
# Deploy on different ports
docker run -p 8787:8787 -e PROJECT_NAME="Team A" llm-copilot
docker run -p 8788:8787 -e PROJECT_NAME="Team B" llm-copilot
```

### Scenario 2: Medium Company (4-10 teams)
**Use Option 2: Project ID**

Each team gets a project ID and filters their dashboard:
- `http://dashboard.company.com?project=team-a`
- `http://dashboard.company.com?project=team-b`

### Scenario 3: Large Enterprise (10+ teams)
**Use Option 3 + Authentication**

Full multi-tenant architecture with:
- User authentication (OAuth/SAML)
- Team/organization hierarchy
- Role-based access control
- Separate databases per tenant

---

## Quick Implementation: Project ID (Option 2)

Here's how to add project-based filtering:

### 1. Update Event Recording

```javascript
// src/metrics-store.js
export async function recordEvent(event) {
  const enriched = {
    ...event,
    projectId: event.projectId || 'default',  // ← Add this
    timestamp: nowIso(),
    id: randomUUID()
  };
  store.events.push(enriched);
}
```

### 2. Update API Endpoints

```javascript
// src/server.js
if (req.method === "GET" && url.pathname === "/api/v1/dashboard/summary") {
  const projectId = url.searchParams.get("project") || "default";
  const summary = await getSummary(250, projectId);  // ← Pass projectId
  return sendJson(res, 200, { ok: true, summary });
}
```

### 3. Update Dashboard

```javascript
// public/index.html
const urlParams = new URLSearchParams(window.location.search);
const projectId = urlParams.get('project') || 'default';

// Include in all API calls
await api(`/api/v1/dashboard/summary?project=${projectId}`);
```

### 4. Usage

```javascript
// Team A's application
await fetch('http://localhost:8787/api/v1/infer', {
  method: 'POST',
  body: JSON.stringify({
    projectId: 'team-a',
    prompt: 'Hello',
    model: 'gpt-4'
  })
});

// Team A's dashboard
window.location = 'http://localhost:8787?project=team-a';
```

---

## Environment Variables Approach

**Simplest solution**: Use environment variable

```bash
# Team A
PROJECT_ID=team-a npm start

# Team B
PROJECT_ID=team-b npm start
```

Then auto-tag all events with that project ID.

---

## Summary

| Approach | Complexity | Isolation | Cost | Best For |
|----------|-----------|-----------|------|----------|
| Separate Instances | Low | High | Medium | < 5 teams |
| Project ID | Medium | Medium | Low | 5-20 teams |
| Subdomain | High | High | High | 20+ teams |
| DB-per-Team | Medium | High | Medium | Any size |

**For most teams: Start with separate instances, migrate to Project ID when needed.**
