import random
import string
import os
import json
import http
from fastapi import HTTPException
import httpx
import redis.asyncio as redis
from dotenv import load_dotenv


AUTHKEY      = os.getenv("MSG91_AUTHKEY")
EMAIL_DOMAIN = os.getenv("EMAIL_DOMAIN")
EMAIL_FROM   = os.getenv("EMAIL_FROM")
TEMPLATE_ID  = os.getenv("EMAIL_TEMPLATE_ID")
SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL")
REDIS_BROKER_URL = os.getenv("REDIS_BROKER_URL")

redis_client = redis.from_url(REDIS_BROKER_URL, decode_responses=True)


def generate_otp(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))


def build_email_payload(email: str, name: str, otp: str, purpose: str) -> str:
    missing = [k for k, v in {
        "MSG91_AUTHKEY": AUTHKEY,
        "EMAIL_DOMAIN": EMAIL_DOMAIN,
        "EMAIL_FROM": EMAIL_FROM,
        "EMAIL_TEMPLATE_ID": TEMPLATE_ID,
        # "PASSWORD_RESET_TEMPLATE_ID": RESET_TEMPLATE_ID
    }.items() if not v]
    
    if missing:
        raise HTTPException(status_code=500, detail=f"Missing config vars: {', '.join(missing)}")

    template_id = TEMPLATE_ID 
    
    payload = {
        "recipients": [
            {
                "to": [{"name": name, "email": email}],
                "variables": {
                    "company_name": "Insight Agent",
                    "otp": otp,
                    "valid_minutes": "15"  # OTP valid for 15 minutes
                }
            }
        ],
        "from": {"email": EMAIL_FROM},
        "domain": EMAIL_DOMAIN,
        "template_id": template_id
    }
    return json.dumps(payload)


def send_email_otp(json_payload: str) -> tuple[int, str]:
    conn = http.client.HTTPSConnection("control.msg91.com", timeout=10)
    headers = {
        "accept": "application/json",
        "authkey": AUTHKEY,
        "content-type": "application/json"
    }

    try:
        conn.request("POST", "/api/v5/email/send", body=json_payload, headers=headers)
        res = conn.getresponse()
        body = res.read().decode("utf-8")
        return res.status, body
    except ConnectionError as net_err:
        print("[MSG91 ERROR] Timeout or connection issue:", str(net_err))
        return 500, "Timeout or connection issue"
    except Exception as e:
        print("[MSG91 ERROR] Unexpected error:", str(e))
        return 500, str(e)
    finally:
        conn.close()


def format_user_principal_name(user_principal_name: str) -> str:
    if '#EXT#' in user_principal_name:
        username_part, _ = user_principal_name.split('#EXT#')
        formatted_email=username_part.replace('_outlook.com', '@outlook.com')
        return formatted_email
    return user_principal_name


def create_error_html(error_message,base_url):
    if "localhost" in base_url or "127.0.0.1" in base_url:
        target_origin = "http://localhost:3000"
    else:
        target_origin = base_url.rstrip("/") 
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Authentication Error</title>
        <style>
            body {{ font-family: Arial, sans-serif; text-align: center; padding: 40px; }}
            .error-container {{ max-width: 500px; margin: 0 auto; background-color: #fff3f3; border: 1px solid #ffcaca; padding: 20px; border-radius: 5px; }}
            h3 {{ color: #e74c3c; }}
        </style>
    </head>
    <body>
        <div class="error-container">
            <h3>Authentication Failed</h3>
            <p>{error_message}</p>
        </div>
        <script>
            try {{
                const message = {{ type: 'auth_error', error: "{error_message}" }};
                const targetOrigin = '{target_origin}';
                if (window.opener) {{
                    window.opener.postMessage(message, targetOrigin);
                }}
            }} catch (e) {{
                console.error("Error sending message to opener:", e);
            }}
        </script>
    </body>
    </html>
    """


def create_success_html(access_token,base_url):
    if "localhost" in base_url or "127.0.0.1" in base_url:
        target_origin = "http://localhost:3000"
    else:
        target_origin = base_url.rstrip("/") 
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Authenticating...</title>
        <style>
            body {{ font-family: Arial, sans-serif; text-align: center; padding: 40px; }}
            .success-container {{ max-width: 500px; margin: 0 auto; background-color: #f0fff0; border: 1px solid #c3e6cb; padding: 20px; border-radius: 5px; }}
            h3 {{ color: #28a745; }}
        </style>
    </head>
    <body>
        <div class="success-container">
            <h3>Authentication Successful</h3>
            <p>You have been successfully authenticated. This window will close automatically.</p>
        </div>
        <script>
            try {{
                const token = "{access_token}";
                const message = {{ type: 'auth_success', token: token }};
                const targetOrigin = '{target_origin}';
                if (window.opener) {{
                    window.opener.postMessage(message, targetOrigin);
                }} else {{
                    console.error("No window.opener found");
                }}
            }} catch (e) {{
                console.error("Error sending message to opener:", e);
                if (window.opener) {{
                    window.opener.postMessage({{ type: 'auth_error', error: 'Failed to send token' }}, window.opener.location.origin);
                }}
            }}
        </script>
    </body>
    </html>
    """


async def notify_slack_error(user_id: str, error_message: str):
    payload = {
        "text": f"Error from {user_id}\n```{error_message}```"
    }
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(SLACK_WEBHOOK_URL, json=payload)
            print(response.text)
    except Exception as slack_error:
        print(f"Slack notification failed: {slack_error}")


async def check_stop_conversation(session_id: str, message_id: str):
    stop_msg = await redis_client.get(f"stop:{session_id}")
    if stop_msg == message_id:
        return True
    else:
        return False