# syntax=docker/dockerfile:1

# HandCO runs php-fpm behind an nginx gateway container. MySQL is deliberately
# NOT in here: it stays on the host and is reached over host.docker.internal, so
# one database is shared with the host tooling and other projects. See
# docker/scripts/expose-host-mysql-to-docker.sh.

FROM php:8.2-fpm-bookworm AS php-base

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git \
        unzip \
        curl \
        procps \
        default-mysql-client \
        libzip-dev \
        libpng-dev \
        libjpeg62-turbo-dev \
        libfreetype6-dev \
        libonig-dev \
        libxml2-dev \
        libicu-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" \
        bcmath \
        gd \
        intl \
        opcache \
        pcntl \
        pdo_mysql \
        zip \
    && pecl install redis \
    && docker-php-ext-enable redis \
    && rm -rf /var/lib/apt/lists/* \
    && php -m | grep -qi redis

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Targets are ordered so a legacy `docker build` without BuildKit still stops at
# the requested one. Assets come before production because production copies
# public/build from it.

FROM php-base AS development

# Vite runs in this stage for `docker compose -f docker/compose.dev.yaml up`.
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get update \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && test -x /usr/bin/node

ENV APP_ENV=local \
    APP_DEBUG=true

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh \
    && mkdir -p \
        storage/framework/cache \
        storage/framework/sessions \
        storage/framework/views \
        storage/app/private \
        storage/logs \
        bootstrap/cache

EXPOSE 9000
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["php-fpm", "-F"]

# Dev gateway: config only. public/ is bind-mounted from the host so Vite HMR
# and a fresh build show up without rebuilding the image.
FROM nginx:1.27-alpine AS gateway-dev

COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

FROM php-base AS vendor

# Composer install in its own layer, keyed on the lock file, so editing
# application code does not reinstall every package.
COPY composer.json composer.lock ./
RUN composer install \
        --no-dev \
        --no-scripts \
        --no-autoloader \
        --no-interaction \
        --prefer-dist

FROM node:22-bookworm-slim AS assets

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# A single Vite build on a small host can OOM; cap the heap and let it fail
# loudly rather than be OOM-killed halfway through public/build.
ENV NODE_OPTIONS=--max-old-space-size=4096
RUN npm run build

FROM php-base AS production

ENV APP_ENV=production \
    APP_DEBUG=false

WORKDIR /var/www/html

COPY . .
COPY --from=vendor /var/www/html/vendor ./vendor
COPY --from=assets /app/public/build ./public/build

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
COPY docker/php/php.ini /usr/local/etc/php/conf.d/zz-handco-production.ini

# Pool settings go in www.conf, not in an ini: php-fpm ignores a [www] section in
# conf.d, so a [www] block in php.ini looks correct and does nothing.
#
# pm.max_children is the one worth revisiting. The stock image ships 5, low for a
# shop doing checkout and webhook delivery. Children are processes, not threads,
# so size it against this container's memory limit divided by the peak RSS of one
# worker, not against the host's free memory.
RUN set -eux; \
    FPM_POOL=/usr/local/etc/php-fpm.d/www.conf; \
    sed -i \
        -e 's/^pm.max_children = .*/pm.max_children = 16/' \
        -e 's/^pm.start_servers = .*/pm.start_servers = 4/' \
        -e 's/^pm.min_spare_servers = .*/pm.min_spare_servers = 2/' \
        -e 's/^pm.max_spare_servers = .*/pm.max_spare_servers = 6/' \
        -e 's/^;pm.max_requests = .*/pm.max_requests = 500/' \
        "${FPM_POOL}"; \
    # The default is 0, which waits forever and hides a wedged worker.
    printf 'request_terminate_timeout = 120s\n' >> "${FPM_POOL}"; \
    # So worker output reaches `docker compose logs` instead of nowhere.
    printf 'catch_workers_output = yes\ndecorate_workers_output = no\n' >> "${FPM_POOL}"; \
    php-fpm -t

RUN chmod +x /usr/local/bin/entrypoint.sh \
    && mkdir -p \
        storage/framework/cache \
        storage/framework/sessions \
        storage/framework/views \
        storage/app/private \
        storage/logs \
        bootstrap/cache \
    && rm -f bootstrap/cache/packages.php bootstrap/cache/services.php \
    && chown -R www-data:www-data storage bootstrap/cache \
    && composer dump-autoload --optimize --classmap-authoritative --no-interaction \
    && php artisan package:discover --ansi

EXPOSE 9000
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["php-fpm", "-F"]

# The gateway is built from the production stage so its public/ tree is the same
# build the app serves, and it is tagged separately so a release can roll the web
# tier independently of the PHP tier.
FROM nginx:1.27-alpine AS gateway

COPY --from=production /var/www/html/public /var/www/html/public

# The stock image ships /etc/nginx/conf.d/default.conf, which also listens on 80
# with server_name _. It has to go: nginx takes the first matching server block,
# so leaving it in place would serve /usr/share/nginx/html and the whole storefront
# would 404 through a config that looks deployed and correct.
RUN rm -f /etc/nginx/conf.d/default.conf

# Templated into conf.d/ at container start, not copied there at build time, so
# ADMIN_PATH_PREFIX stays per installation. See the header of the template for
# why the filter below matters and what happens when the variable is absent.
COPY docker/nginx/spa.conf.template /etc/nginx/templates/spa.conf.template

# Substitute only the admin prefix. Unfiltered substitution would replace every
# nginx variable that happens to match an env var name: an env var called `uri`
# or `host` would silently blank out $uri or $host across this whole file.
ENV NGINX_ENVSUBST_FILTER="^ADMIN_PATH_PREFIX$"

EXPOSE 80