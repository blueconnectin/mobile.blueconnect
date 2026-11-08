CREATE TABLE IF NOT EXISTS portal_users (
 uid TEXT PRIMARY KEY,
 email TEXT NOT NULL DEFAULT '',
 name TEXT NOT NULL,
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 project_enabled INTEGER NOT NULL DEFAULT 0 CHECK(project_enabled IN (0,1)),
 project_user_id TEXT UNIQUE,
 revision INTEGER NOT NULL DEFAULT 1,
 updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS account_requests (
 id TEXT PRIMARY KEY,
 uid TEXT NOT NULL REFERENCES portal_users(uid),
 application TEXT NOT NULL CHECK(application IN ('project','payment')),
 mode TEXT NOT NULL CHECK(mode IN ('new','link')),
 legacy_id TEXT,
 requested_role TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending_review' CHECK(status IN ('pending_review','cancelled')),
 created_by TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS one_pending_request ON account_requests(uid, application) WHERE status='pending_review';
CREATE TABLE IF NOT EXISTS portal_audit (
 id TEXT PRIMARY KEY,
 actor_uid TEXT NOT NULL,
 action TEXT NOT NULL,
 target_uid TEXT NOT NULL,
 detail TEXT NOT NULL,
 created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS one_pending_legacy ON account_requests(application,legacy_id) WHERE status='pending_review' AND legacy_id IS NOT NULL;
