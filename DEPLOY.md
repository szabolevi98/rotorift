# Rotorift production deployment

Public game: **https://fpv.levente.net/**. The separate English showcase remains
at **https://szabolevi98.github.io/rotorift/** and is also served at `/showcase/`.

Like Racing, Apache serves static files directly. Only `/api/` and `/ws` reach
Node, which listens on **127.0.0.1:3015**. Code lives at `/opt/rotorift`, owned by
root; `rotorift.service` runs as the separate `rotorift` system user. MariaDB uses
the `rotorift` database and a user restricted to that database.

SSH connection details are in the private **D:\_vps.md** operations document.
Never commit or print production credentials. `/opt/rotorift/.env` is ignored,
owned by `root:rotorift`, mode `640`; use `.env.example` for the required keys,
plus `NODE_ENV=production`. Keep `HOST=127.0.0.1` and `PORT=3015`.

## First installation

1. Point the domain's DNS at the VPS. Clone this public repository to
   `/opt/rotorift`, then run `npm ci --omit=dev`. GLB models and the prebuilt
   showcase bundle are tracked in Git; no separate asset upload or build is needed.
2. Back up existing configuration and database grants before provisioning. Create
   a separate system user, database and database user; generate a password on the
   VPS and write it directly to the private `.env`. The application initializes
   its schema on startup and needs CREATE/ALTER/INDEX privileges on its own DB.
3. Give the service and Apache read access to the code and public files. Keep
   `.env` private and do not expose the repository root as DocumentRoot.
4. Install `deploy/systemd/rotorift.service` in `/etc/systemd/system/`, run
   `systemctl daemon-reload`, then `systemctl enable --now rotorift`.
5. Enable a separate HTTP virtual host for `fpv.levente.net` and obtain a certificate
   using `certbot --apache -d fpv.levente.net --redirect --non-interactive
   --agree-tos --no-eff-email`. Install the two tracked virtual-host files from
   `deploy/apache/` in `/etc/apache2/sites-available/`. They include the tracked
   common config from `/opt/rotorift/deploy/apache/rotorift-common.conf`.
6. Run `apache2ctl configtest` before `systemctl reload apache2`. Do not restart
   unrelated services. Certbot's existing renewal timer handles the new certificate.

## Updates

Run as root on the VPS, stopping if the working tree is dirty:

```bash
set -e
cd /opt/rotorift
test -z "$(git status --porcelain)"
install -d -m 700 /root/backups
mariadb-dump --single-transaction --routines --triggers rotorift \
  > "/root/backups/rotorift-$(date +%F-%H%M%S).sql"
git pull --ff-only
npm ci --omit=dev
systemctl restart rotorift
systemctl is-active rotorift
curl --fail https://fpv.levente.net/api/status
```

After Apache config changes, copy the tracked virtual-host files, validate,
then reload Apache. The common include changes when Git updates it, so always
run `apache2ctl configtest` after a pull that changes that file as well.

## Verification

- HTTP redirects to HTTPS; HTTPS `/` returns 200 with a trusted certificate.
- `/api/status` returns `ok: true` and `database: true`.
- `/api/catalog` includes three drones, two maps and their JSON race routes.
- `/ws` successfully upgrades over WSS; two clients can create/join a room.
- GLB models, Three modules, Rapier WASM, languages and `/showcase/` load.
- `/.git/config` and `/.env` are forbidden, directory listings disabled.
- `POST /api/routes` stays forbidden on the public hostname. Gate editing exports
  JSON publicly; writing project files is a localhost development feature.
- Racing and the other existing domains retain their previous responses.

Inspect errors using `journalctl -u rotorift -n 50 --no-pager` and
`/var/log/apache2/rotorift-error.log`. Restore a previous reviewed commit and
restart only Rotorift for a code rollback; restore the DB backup if a schema
change requires it. Preserve `.env` and existing data.
