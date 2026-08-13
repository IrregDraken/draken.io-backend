# Telegram integration research

## Verified behavior

The official Telegram Bot API documents two mutually exclusive update-delivery methods: `getUpdates` (long polling) and webhooks. When a webhook is configured, `getUpdates` is not used until the webhook is removed. Webhooks deliver JSON `Update` objects via HTTPS POST requests and may include the `X-Telegram-Bot-Api-Secret-Token` header when a secret token is configured. Telegram currently supports webhook ports 443, 80, 88, and 8443.

The official API also documents `getWebhookInfo`, `setWebhook`, and `deleteWebhook`, which will be represented in the integration adapter and health checks as appropriate.

A current grammY deployment guide confirms that long polling is simpler for local development because it does not require a public URL, while webhooks are appropriate when the service can expose a public HTTPS endpoint. Long polling requests use a default 30-second timeout, and webhook handlers should acknowledge requests promptly and avoid doing slow work inline.

## Sources

1. Telegram Bot API: https://core.telegram.org/bots/api
2. grammY, Long Polling vs. Webhooks: https://grammy.dev/guide/deployment-types
