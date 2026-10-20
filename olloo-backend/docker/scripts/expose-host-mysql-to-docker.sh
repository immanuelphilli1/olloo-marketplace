#!/usr/bin/env bash
# Let HandCO's Compose containers reach the host's MySQL, without exposing 3306
# to anything.
#
# mysqld usually binds 127.0.0.1 only. host.docker.internal resolves to the
# docker0 address, where nothing is listening, so the container gets connection
# refused. This DNATs that address back to 127.0.0.1:3306. mysqld's
# bind-address is NOT changed and 3306 is never published on a public interface.
#
# It also fixes the failure mode this setup invites: bare TCP probes and
# reconnect storms from container restarts trip max_connect_errors, which then
# blocks the container's IP and surfaces as SQLSTATE[HY000] [1129] "Host is
# blocked". max_connect_errors is raised and the host cache is flushed.
#
# Run once per host, as root:
#   sudo ./docker/scripts/expose-host-mysql-to-docker.sh
set -euo pipefail

APP_SLUG="handco"

if [ "$(id -u)" -ne 0 ]; then
    echo "Run as root (sudo)." >&2
    exit 1
fi

if ! command -v iptables >/dev/null 2>&1; then
    echo "iptables is required." >&2
    exit 1
fi

DOCKER0_IP="$(ip -4 -o addr show docker0 2>/dev/null | awk '{print $4}' | cut -d/ -f1 | head -n1 || true)"
if [ -z "${DOCKER0_IP}" ]; then
    echo "docker0 has no IPv4 address. Start Docker once, then re-run." >&2
    exit 1
fi

# Lets a packet addressed to docker0 be routed to loopback, which the DNAT below
# then redirects to mysqld. Without it the kernel drops it.
SYSCTL_FILE="/etc/sysctl.d/99-${APP_SLUG}-docker-mysql.conf"
printf '%s\n' 'net.ipv4.conf.all.route_localnet=1' > "${SYSCTL_FILE}"
sysctl -q -p "${SYSCTL_FILE}" || sysctl -w net.ipv4.conf.all.route_localnet=1 >/dev/null

ensure_nat() {
    if iptables -t nat -C "$@" 2>/dev/null; then
        return 0
    fi
    iptables -t nat -I "$@"
}

# iptables-nft needs an explicit -m tcp; --dport is not implied by -p tcp.
ensure_nat PREROUTING -p tcp -m tcp -d "${DOCKER0_IP}" --dport 3306 -j DNAT --to-destination 127.0.0.1:3306
ensure_nat OUTPUT -p tcp -m tcp -d "${DOCKER0_IP}" --dport 3306 -j DNAT --to-destination 127.0.0.1:3306
ensure_nat POSTROUTING -p tcp -m tcp -d 127.0.0.1 --dport 3306 -j MASQUERADE

echo "Docker host-gateway ${DOCKER0_IP}:3306 now reaches host MySQL on 127.0.0.1:3306."
echo "mysqld bind-address was not changed and 3306 was not published."

MYSQL_CNF_DIR=""
for candidate in /etc/mysql/mysql.conf.d /etc/mysql/conf.d /etc/my.cnf.d; do
    if [ -d "${candidate}" ]; then
        MYSQL_CNF_DIR="${candidate}"
        break
    fi
done

if [ -n "${MYSQL_CNF_DIR}" ]; then
    MYSQL_CNF="${MYSQL_CNF_DIR}/99-${APP_SLUG}-docker.cnf"
    cat > "${MYSQL_CNF}" <<EOF
# Raised for HandCO's Compose containers, which share this MySQL over
# host.docker.internal. Bare TCP probes and reconnect storms from container
# restarts otherwise trip SQLSTATE[HY000] [1129] and block the container's IP.
[mysqld]
max_connect_errors = 1000000
EOF
    echo "Wrote ${MYSQL_CNF} (max_connect_errors=1000000)."
fi

if command -v mysql >/dev/null 2>&1 && mysql --protocol=socket -e "SELECT 1" >/dev/null 2>&1; then
    # Applied live when possible, so this does not need a mysqld restart.
    mysql --protocol=socket -e "SET GLOBAL max_connect_errors = 1000000;" >/dev/null 2>&1 || true
    mysql --protocol=socket -e "FLUSH HOSTS;" >/dev/null 2>&1 || true
    echo "Flushed the MySQL host cache (clears blocked Docker client IPs)."
    echo "mysqld max_connect_errors is now $(mysql --protocol=socket -N -e 'SHOW VARIABLES LIKE "max_connect_errors";' 2>/dev/null | awk '{print $2}' || echo unknown)."
else
    echo "WARNING: could not talk to mysqld over the unix socket as root." >&2
    echo "Once socket auth is fixed, re-run: sudo mysqladmin flush-hosts" >&2
fi

# Installed as a oneshot unit so a reboot re-applies the NAT rules. Docker
# recreates docker0 on restart, and the rules are matched on its address, so
# they have to be re-added after every boot.
INSTALL_PATH="/usr/local/sbin/${APP_SLUG}-expose-host-mysql-to-docker.sh"
SCRIPT_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
if [ "${SCRIPT_PATH}" != "${INSTALL_PATH}" ]; then
    install -m 0755 -o root -g root "${SCRIPT_PATH}" "${INSTALL_PATH}"
fi

UNIT="/etc/systemd/system/${APP_SLUG}-docker-mysql.service"
cat > "${UNIT}" <<EOF
[Unit]
Description=DNAT Docker host-gateway MySQL to 127.0.0.1 for ${APP_SLUG}
After=docker.service network-online.target mysql.service mysqld.service mariadb.service
Wants=docker.service

[Service]
Type=oneshot
# Tells the script it is already running as this unit, so it applies the rules
# and exits instead of restarting the unit from inside itself (which kills its
# own start job and loops forever).
Environment=HANDCO_SYSTEMD_INVOKED=1
ExecStart=${INSTALL_PATH}
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "${APP_SLUG}-docker-mysql.service" >/dev/null
if [ "${HANDCO_SYSTEMD_INVOKED:-}" = "1" ]; then
    echo "Applied inside the systemd unit; leaving the unit alone."
else
    systemctl restart "${APP_SLUG}-docker-mysql.service" >/dev/null
fi
echo "Enabled ${APP_SLUG}-docker-mysql.service so the rules survive a reboot."

if command -v netfilter-persistent >/dev/null 2>&1; then
    netfilter-persistent save >/dev/null 2>&1 || true
fi

echo
echo "Next: docker/env/app.env with DB_HOST=host.docker.internal, then"
echo "  ./docker/scripts/dev-up.sh"