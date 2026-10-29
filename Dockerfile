FROM node:22-alpine
WORKDIR /app
COPY index.html server.mjs check-build.mjs ./
RUN node --check server.mjs && node check-build.mjs
ENV NODE_ENV=production
ENV PORT=8080
USER node
EXPOSE 8080
CMD ["node", "server.mjs"]
