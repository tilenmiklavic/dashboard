# Deploying the dashboard to the netcup server

Same convention as every app on the server: user `dashboard`, folder `/opt/dashboard`, a web container with the alias
`dashboard-web` on the shared `proxy` network, route in `deploy/site.caddy`. The source is built on the server
(`Dockerfile`), so nothing needs building locally.

1. **DNS** at Namecheap → Advanced DNS: `A` record, Host `dashboard`, Value `62.83.97.2`; `AAAA` record, Host
   `dashboard`, Value `2a03:4000:15:1b34:68ba:ceff:fe89:22d5`. Check: `dig +short dashboard.miklavic.si`.
2. **User and folder** (once, as root; safe to re-run):
   ```bash
   curl -fsSL https://raw.githubusercontent.com/tilenmiklavic/klin-dom/main/deploy/netcup/setup-server.sh | ssh root@klindom.miklavic.si 'bash -s -- dashboard'
   ```
3. **Secrets**: `ssh dashboard@dashboard.miklavic.si`, then create `/opt/dashboard/.env` from `deploy/.env.example`
   (`DASHBOARD_PASSWORD` is required; the server refuses to start without it) and `chmod 600 /opt/dashboard/.env`.
4. **First deploy** from this repo:
   ```bash
   DEPLOY_HOST=dashboard@dashboard.miklavic.si bash deploy/deploy.sh
   ```
   then `curl -I https://dashboard.miklavic.si/` (expect `401`, the login prompt).
5. **Automatic deploys**: a dedicated key for this repo.
   ```bash
   ssh-keygen -t ed25519 -f ~/dashboard-ci -C "github-actions dashboard" -N ""
   cat ~/dashboard-ci.pub | ssh dashboard@dashboard.miklavic.si 'cat >> ~/.ssh/authorized_keys'
   ssh-keyscan dashboard.miklavic.si
   ```
   Repo → Settings → Secrets and variables → Actions: variable `NETCUP_HOST` = `dashboard.miklavic.si`, secret
   `NETCUP_SSH_KEY` = contents of `~/dashboard-ci`, secret `NETCUP_KNOWN_HOSTS` = the `ssh-keyscan` output. Then run
   Actions → Deploy to netcup, and delete `~/dashboard-ci*`.

## What the container can see

`compose.yml` mounts the host's root filesystem read-only (disk usage and host network counters) and the Docker socket
(container state on the Apps page; the code only issues `GET` requests). The socket gives root-equivalent access to
the host if the app were ever compromised, so keep a strong `DASHBOARD_PASSWORD`. If you would rather not expose it,
delete that volume line: everything else keeps working and the Apps page just hides container details.

## Adding an app to the dashboard

Edit `apps.config.json` (`name` must equal the app's compose project name, which is its folder name in `/opt`) and
deploy.
