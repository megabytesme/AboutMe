FROM node:18-alpine AS builder

WORKDIR /app

COPY index.html .

RUN npx html-minifier-terser index.html -o index.min.html \
    --collapse-whitespace \
    --remove-comments \
    --remove-optional-tags \
    --remove-redundant-attributes \
    --remove-script-type-attributes \
    --remove-tag-whitespace \
    --use-short-doctype \
    --minify-css true \
    --minify-js true

FROM nginx:stable-alpine

COPY --from=builder /app/index.min.html /usr/share/nginx/html/index.html
COPY assets/images/ /usr/share/nginx/html/assets/images/