-- A key may change and remove everyone's work (spec 055).
ALTER TABLE api_keys DROP CONSTRAINT api_keys_scope_check;
ALTER TABLE api_keys ADD CONSTRAINT api_keys_scope_check CHECK (scope IN ('read', 'write', 'full'));

-- Copies of a board saved before such a key changes people's work, and before a restore.
CREATE TABLE board_copies (
    workspace_id text NOT NULL,
    board_id text NOT NULL,
    id text NOT NULL,
    saved_at timestamptz NOT NULL,
    by_user_id text REFERENCES users (id) ON DELETE SET NULL,
    reason text NOT NULL CHECK (reason IN ('key', 'restore')),
    elements integer NOT NULL,
    doc jsonb NOT NULL,
    -- People's elements as keys wrote them since this copy: unchanged, they need no new copy.
    written jsonb NOT NULL DEFAULT '{"nodes": {}, "edges": {}}',
    PRIMARY KEY (workspace_id, board_id, id),
    -- A board that moves to another workspace takes its copies along.
    FOREIGN KEY (workspace_id, board_id) REFERENCES boards (workspace_id, id)
        ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX board_copies_saved ON board_copies (board_id, saved_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON board_copies TO tiko_app, tiko_jobs;
ALTER TABLE board_copies ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_copies FORCE ROW LEVEL SECURITY;
CREATE POLICY app_rows ON board_copies TO tiko_app
    USING (workspace_id = nullif(current_setting('app.workspace_id', true), ''))
    WITH CHECK (workspace_id = nullif(current_setting('app.workspace_id', true), ''));
CREATE POLICY jobs_rows ON board_copies TO tiko_jobs USING (true) WITH CHECK (true);
