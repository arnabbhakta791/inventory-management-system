# Claude Instructions — MERN Inventory Assignment

## Standing Rules

### Always Use Context7 for Library Documentation
Before writing any code that uses an external library (React, Mongoose, Express, Ant Design,
Socket.io, Vite, JWT, bcrypt, etc.), **always** fetch up-to-date documentation via the
Context7 MCP tools:

1. `mcp__context7__resolve-library-id` — resolve the library name to a Context7 ID
2. `mcp__context7__get-library-docs` — fetch the relevant docs for the topic at hand

This ensures generated code matches the installed version's API (e.g. Mongoose 9 deprecations,
Ant Design 5 component props, React 18 hooks rules) rather than training-data snapshots.

## Project Overview

Multi-tenant Inventory Management SaaS — MERN stack interview assignment.
See `ARCHITECTURE.md` for design decisions and `README.md` for setup instructions.

### Key Constraints
- **MongoDB Atlas M0** — no multi-document ACID transactions. Use document-level atomicity
  (`findOneAndUpdate` with `$elemMatch` guard) + manual rollback pattern in `stockService.js`.
- **Tenant isolation** — every Mongoose query MUST include `tenantId` from `req.tenantId`
  (set by `middleware/auth.js` as a real `ObjectId`, not a string).
- **UTC dates** — never use `setHours(0,0,0,0)` for UTC boundaries; use `Date.UTC(...)` to
  avoid IST (or any other timezone) offset bugs in aggregation pipelines.
