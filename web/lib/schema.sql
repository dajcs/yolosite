CREATE TABLE IF NOT EXISTS offers (
  id serial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'manual',
  email_ref text,
  link text,
  posting_text text,
  employer text,
  title text,
  location text,
  ref_id text,
  deadline text,
  requirements text,
  dismissed boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS applications (
  id serial PRIMARY KEY,
  offer_id integer REFERENCES offers(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  date date NOT NULL DEFAULT CURRENT_DATE,
  link text,
  offer_text text,
  employer text,
  title text,
  ref_id text,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  archive_path text,
  zip_filename text,
  zip_base64 text
);

CREATE TABLE IF NOT EXISTS app_state (
  key text PRIMARY KEY,
  value text NOT NULL
);

CREATE TABLE IF NOT EXISTS emails (
  message_id text PRIMARY KEY,
  uid integer,
  date timestamptz,
  from_addr text,
  to_addr text,
  subject text,
  classification text NOT NULL DEFAULT 'unknown',
  manual boolean NOT NULL DEFAULT false,
  pulled_at timestamptz,
  offers_found integer
)
