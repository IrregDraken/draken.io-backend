import hashlib
import hmac
import secrets

import requests
from flask import current_app


class PaymentUnavailable(RuntimeError):
    pass


class PaystackClient:
    base_url = "https://api.paystack.co"

    def _headers(self) -> dict:
        secret = current_app.config["PAYSTACK_SECRET_KEY"]
        if not secret:
            raise PaymentUnavailable("Online payment is not configured for this restaurant.")
        return {"Authorization": f"Bearer {secret}", "Content-Type": "application/json"}

    def initialize(self, email: str, amount_kobo: int, reference: str, metadata: dict) -> dict:
        callback_url = current_app.config["PAYSTACK_CALLBACK_URL"]
        if not callback_url:
            raise PaymentUnavailable("The payment callback URL has not been configured.")
        response = requests.post(
            f"{self.base_url}/transaction/initialize",
            headers=self._headers(),
            json={"email": email, "amount": amount_kobo, "reference": reference, "callback_url": callback_url, "metadata": metadata},
            timeout=10,
        )
        response.raise_for_status()
        return response.json()

    def verify(self, reference: str) -> dict:
        response = requests.get(f"{self.base_url}/transaction/verify/{reference}", headers=self._headers(), timeout=10)
        response.raise_for_status()
        return response.json()

    @staticmethod
    def webhook_is_valid(raw_body: bytes, signature: str | None) -> bool:
        secret = current_app.config["PAYSTACK_SECRET_KEY"]
        if not secret or not signature:
            return False
        expected = hmac.new(secret.encode(), raw_body, hashlib.sha512).hexdigest()
        return hmac.compare_digest(expected, signature)


def payment_reference(order_id: str) -> str:
    return f"HP-{order_id.replace('-', '')[:12].upper()}-{secrets.token_hex(3).upper()}"
