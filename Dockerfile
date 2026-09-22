FROM node:22-bookworm-slim AS city-build

WORKDIR /build/city
COPY apps/city/package.json apps/city/package-lock.json ./
RUN npm ci
COPY apps/city/ ./

ARG NEXT_PUBLIC_SUPABASE_URL=https://huaxflbsnbsmhubhxfjg.supabase.co
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_yWdby9BlNgdjytxx4it0ig_4m4WUpHS
ARG NEXT_PUBLIC_CHAT_DEBATE_URL=/chat-debate/
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_CHAT_DEBATE_URL=$NEXT_PUBLIC_CHAT_DEBATE_URL
RUN npm run build

FROM node:22-bookworm-slim AS chat-build

WORKDIR /build/chat-debate
COPY apps/chat-debate/package.json apps/chat-debate/package-lock.json ./
RUN npm ci
COPY apps/chat-debate/ ./

ARG VITE_SUPABASE_URL=https://huaxflbsnbsmhubhxfjg.supabase.co
ARG VITE_SUPABASE_ANON_KEY=sb_publishable_yWdby9BlNgdjytxx4it0ig_4m4WUpHS
ARG VITE_CREATOR_CITY_URL=/city/neon
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_CREATOR_CITY_URL=$VITE_CREATOR_CITY_URL
RUN npm run build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PYTHONUNBUFFERED=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends nginx python3 python3-venv \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY apps/chat-debate/requirements.txt /tmp/requirements.txt
RUN python3 -m venv /opt/venv \
  && /opt/venv/bin/pip install --no-cache-dir -r /tmp/requirements.txt

COPY --from=city-build /build/city/.next/standalone ./city
COPY --from=city-build /build/city/.next/static ./city/.next/static
COPY --from=city-build /build/city/public ./city/public
COPY --from=chat-build /build/chat-debate/dist /srv/chat-debate
COPY apps/chat-debate/server ./chat-debate/server
COPY apps/chat-debate/shared ./chat-debate/shared
COPY deploy ./deploy

RUN chmod +x /app/deploy/start.sh

EXPOSE 3000

CMD ["/app/deploy/start.sh"]
