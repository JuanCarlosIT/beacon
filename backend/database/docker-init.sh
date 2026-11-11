#!/bin/sh
(
set -eu

# Solo se ejecuta al inicializar un volumen nuevo. La aplicación no es superusuario.
APP_DB_PASSWORD="$(cat "$APP_DB_PASSWORD_FILE")"
export APP_DB_PASSWORD

psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 <<'SQL'
\getenv app_user APP_DB_USER
\getenv app_password APP_DB_PASSWORD
\getenv app_database POSTGRES_DB
CREATE ROLE :"app_user" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD :'app_password';
ALTER DATABASE :"app_database" OWNER TO :"app_user";
ALTER SCHEMA public OWNER TO :"app_user";
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
SQL

unset APP_DB_PASSWORD
)
