FROM node:22-alpine AS pocketbase
RUN apk add --no-cache curl unzip ca-certificates
WORKDIR /download
# Pinned official release and checksum. Do not use an unversioned latest URL.
RUN curl -fsSL --retry 3 https://ganigeorgiev.com/meta/pocketbase/pocketbase/download/v0.41.1/pocketbase_0.41.1_linux_amd64.zip -o pb.zip \
 && echo '7504ec99a85fe405fc9941b4d94bdea20733b53707c8251b66fd0daa1444347e  pb.zip' | sha256sum -c - \
 && unzip pb.zip pocketbase

FROM node:22-alpine
RUN apk add --no-cache ca-certificates tini su-exec
WORKDIR /app
COPY --from=pocketbase /download/pocketbase /usr/local/bin/pocketbase
COPY index.html errors.js stat.js hr.js hr.css server.mjs auth.mjs auth-client.js hr-access.mjs login.html login.js login.css start.mjs entrypoint.sh check-build.mjs check-access.mjs ./
COPY pb_migrations ./pb_migrations
RUN chmod +x /usr/local/bin/pocketbase /app/entrypoint.sh \
 && node --check server.mjs && node --check auth.mjs && node --check hr-access.mjs && node --check start.mjs && node check-build.mjs
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["/app/entrypoint.sh"]
