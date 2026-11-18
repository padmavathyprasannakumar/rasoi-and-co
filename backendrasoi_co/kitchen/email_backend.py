"""
Send emails through Brevo's HTTPS API (https://www.brevo.com — free 300 emails/day).

Render's free plan blocks Gmail SMTP, so emails go through Brevo's HTTPS API instead.
Needs BREVO_API_KEY and DEFAULT_FROM_EMAIL (a sender verified in Brevo).
"""
import logging
from email.utils import parseaddr

import requests
from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend

log = logging.getLogger(__name__)
BREVO_URL = 'https://api.brevo.com/v3/smtp/email'


class BrevoEmailBackend(BaseEmailBackend):
    def send_messages(self, email_messages):
        api_key = getattr(settings, 'BREVO_API_KEY', '')
        if not api_key:
            log.error('BREVO_API_KEY is not set — email not sent.')
            return 0
        sent = 0
        for message in email_messages:
            sender_name, sender_email = parseaddr(message.from_email or settings.DEFAULT_FROM_EMAIL)
            payload = {
                'sender': {'name': sender_name or 'Rasoi & Co.', 'email': sender_email},
                'to': [{'email': parseaddr(addr)[1]} for addr in message.to],
                'subject': message.subject,
                'textContent': message.body,
            }
            for content, mimetype in getattr(message, 'alternatives', []) or []:
                if mimetype == 'text/html':
                    payload['htmlContent'] = content
            if message.reply_to:
                payload['replyTo'] = {'email': parseaddr(message.reply_to[0])[1]}
            try:
                r = requests.post(BREVO_URL, json=payload, timeout=20,
                                  headers={'api-key': api_key, 'accept': 'application/json'})
                if r.status_code >= 400:
                    log.error('Brevo email failed (%s): %s', r.status_code, r.text[:300])
                    if not self.fail_silently:
                        raise RuntimeError(f'Brevo error {r.status_code}: {r.text[:200]}')
                    continue
                sent += 1
            except requests.RequestException as exc:
                log.error('Brevo email failed: %s', exc)
                if not self.fail_silently:
                    raise
        return sent
