import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from jinja2 import Template
from app.core.config import settings
from typing import List, Optional
import logging

logger = logging.getLogger(__name__)

class EmailService:
    

    def __init__(self):
        self.smtp_host = settings.SMTP_HOST
        self.smtp_port = settings.SMTP_PORT
        self.smtp_user = settings.SMTP_USER
        self.smtp_password = settings.SMTP_PASSWORD
        self.from_email = settings.SMTP_FROM_EMAIL or settings.SMTP_USER
        self.from_name = settings.SMTP_FROM_NAME

    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None
    ) -> bool:
        
        try:

            message = MIMEMultipart("alternative")
            message["Subject"] = subject
            message["From"] = f"{self.from_name} <{self.from_email}>"
            message["To"] = to_email

            if text_content:
                text_part = MIMEText(text_content, "plain")
                message.attach(text_part)

            html_part = MIMEText(html_content, "html")
            message.attach(html_part)

            await aiosmtplib.send(
                message,
                hostname=self.smtp_host,
                port=self.smtp_port,
                username=self.smtp_user,
                password=self.smtp_password,
                start_tls=True,
            )

            logger.info(f"Email sent successfully to {to_email}")
            return True

        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}")
            return False

    async def send_password_reset_email(
        self,
        to_email: str,
        reset_token: str,
        user_name: Optional[str] = None
    ) -> bool:
        
        reset_link = f"{settings.FRONTEND_URL}/reset-password?token={reset_token}"

        html_template = """
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #dc2626; color: white; padding: 20px; text-align: center; }
                .content { padding: 20px; background-color: #f9f9f9; }
                .button { display: inline-block; padding: 12px 24px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>💍 PakWedding Portal</h1>
                </div>
                <div class="content">
                    <h2>Password Reset Request</h2>
                    <p>Hello{% if user_name %} {{ user_name }}{% endif %},</p>
                    <p>We received a request to reset your password. Click the button below to reset it:</p>
                    <p style="text-align: center;">
                        <a href="{{ reset_link }}" class="button">Reset Password</a>
                    </p>
                    <p>Or copy and paste this link into your browser:</p>
                    <p style="word-break: break-all; color: #0066cc;">{{ reset_link }}</p>
                    <p><strong>This link will expire in 1 hour.</strong></p>
                    <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
                </div>
                <div class="footer">
                    <p>© 2026 PakWedding Portal. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """

        text_content = f"Reset your password by visiting: {reset_link}\n\nThis link will expire in 1 hour."

        template = Template(html_template)
        html_content = template.render(
            reset_link=reset_link,
            user_name=user_name
        )

        return await self.send_email(
            to_email=to_email,
            subject="Reset Your Password - PakWedding Portal",
            html_content=html_content,
            text_content=text_content
        )

    async def send_welcome_email(
        self,
        to_email: str,
        user_name: str,
        user_role: str = "user"
    ) -> bool:
        
        html_template = """
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #dc2626; color: white; padding: 20px; text-align: center; }
                .content { padding: 20px; background-color: #f9f9f9; }
                .button { display: inline-block; padding: 12px 24px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>💍 PakWedding Portal</h1>
                </div>
                <div class="content">
                    <h2>Welcome to PakWedding Portal! 🎉</h2>
                    <p>Hello {{ user_name }},</p>
                    <p>Thank you for joining PakWedding Portal! We're excited to help you plan your perfect wedding.</p>
                    {% if user_role == 'vendor' %}
                    <p>Your vendor account is pending approval. You'll receive an email once an administrator reviews your registration.</p>
                    {% else %}
                    <p>You can now:</p>
                    <ul>
                        <li>Browse verified vendors</li>
                        <li>Book services</li>
                        <li>Manage your favorites</li>
                        <li>Plan your budget</li>
                        <li>Track your wedding checklist</li>
                    </ul>
                    {% endif %}
                    <p style="text-align: center;">
                        <a href="{{ frontend_url }}" class="button">Visit PakWedding Portal</a>
                    </p>
                </div>
                <div class="footer">
                    <p>© 2026 PakWedding Portal. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """

        template = Template(html_template)
        html_content = template.render(
            user_name=user_name,
            user_role=user_role,
            frontend_url=settings.FRONTEND_URL
        )

        return await self.send_email(
            to_email=to_email,
            subject="Welcome to PakWedding Portal! 🎉",
            html_content=html_content
        )

email_service = EmailService()
