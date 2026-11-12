import { Injectable, OnModuleInit } from '@nestjs/common';
import { ProducerService } from '../../config/kafka/producer/producer.service';
import { ConsumerService } from '../../config/kafka/consumer/consumer.service';
import * as nodemailer from 'nodemailer';
import { winstonLog } from '@config/winstonLog';

export interface AgentHandoffAlertPayload {
  recipients: string[];
  customer: {
    name?: string;
    phone?: string;
  };
  activityId: string;
  customerMessage: string;
  requestedAt?: Date;
}

@Injectable()
export class EmailSendService implements OnModuleInit {
  private transporter: nodemailer.Transporter;

  constructor(
    private readonly _kafka: ProducerService,
    private readonly _consumer: ConsumerService,
  ) {
    this.initTransporter();
  }

  private initTransporter() {
    // this.transporter = nodemailer.createTransport({
    //   host: process.env.SMTP_HOST || 'smtp.gmail.com',
    //   port: Number(process.env.SMTP_PORT) || 465,
    //   secure: process.env.SMTP_SECURE === 'true' || true,
    //   auth: {
    //     user: process.env.SMTP_USER || 'dummy.support@gmail.com',
    //     pass: process.env.SMTP_PASS || 'dummy_app_password',
    //   },
    // });

    this.transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "intesarz690@gmail.com@gmail.com",
        pass: "ymbeshcxgaulmwuk", // The 16-character App Password
      },
    });
  }

  /**
   * Dispatches an alert email to human agents notifying them that a customer inquiry
   * has been flagged for human takeover.
   *
   * @param payload - Recipient list and session metadata
   * @returns Nodemailer delivery info
   */
  async sendAgentHandoffAlert(payload: AgentHandoffAlertPayload): Promise<any> {
    const {
      recipients,
      customer,
      activityId,
      customerMessage,
      requestedAt = new Date(),
    } = payload;

    if (!recipients || recipients.length === 0) {
      winstonLog.warn('sendAgentHandoffAlert invoked with no recipients');
      return null;
    }

    const fromAddress =
      process.env.ALERT_EMAIL_FROM || '"NEC Support" <dummy.support@gmail.com>';
    const subject = `[Action Required] Customer Requested Human Support - Session #${activityId}`;

    const textContent = `
A customer has requested human support via WhatsApp.

Customer Details:
- Name: ${customer.name || 'Unknown'}
- Phone Number: ${customer.phone || 'N/A'}
- Activity / Session ID: ${activityId}
- Timestamp: ${requestedAt.toISOString()}

Inbound Message:
"${customerMessage}"

Please access the agent dashboard to take over this conversation.
    `.trim();

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #d9534f; margin-top: 0;">⚠️ Human Support Takeover Requested</h2>
        <p>A customer inquiry on WhatsApp has been transferred to human support.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 15px 0;" />
        <h3 style="color: #333; margin-bottom: 8px;">Session Details</h3>
        <ul style="list-style-type: none; padding-left: 0; line-height: 1.6;">
          <li><strong>Customer Name:</strong> ${customer.name || 'Unknown'}</li>
          <li><strong>Phone Number:</strong> ${customer.phone || 'N/A'}</li>
          <li><strong>Activity ID:</strong> <code>${activityId}</code></li>
          <li><strong>Requested At:</strong> ${requestedAt.toLocaleString()}</li>
        </ul>
        <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #337ab7; margin: 15px 0; border-radius: 4px;">
          <strong>Customer Message:</strong>
          <p style="margin: 8px 0 0 0; font-style: italic;">"${customerMessage}"</p>
        </div>
        <p style="color: #666; font-size: 13px; margin-top: 20px;">
          Please log in to your agent portal to take over and reply to this customer.
        </p>
      </div>
    `.trim();

    try {
      winstonLog.info(`Dispatching agent handoff email alert to: ${recipients.join(', ')}`);
      const info = await this.transporter.sendMail({
        from: fromAddress,
        to: recipients,
        subject,
        text: textContent,
        html: htmlContent,
      });
      winstonLog.info(`Agent handoff alert successfully dispatched. Message ID: ${info?.messageId}`);
      return info;
    } catch (err: any) {
      winstonLog.error(`Failed to send agent handoff email alert: ${err?.message || err}`);
      throw err;
    }
  }

  async producerExample() {
    this._kafka.produce({
      topic: process.env.KAFKA_PRODUCER_TOPIC,
      messages: [{ value: 'this is emplotyee create' }],
    });
  }

  async onModuleInit() {
    this._consumer.consume(
      process.env.KAFKA_GROUP_ID,
      { topic: process.env.KAFKA_CONSUMER_TOPIC },
      {
        eachMessage: async ({ topic, partition, message }) => {
          console.log({
            source: 'update-consumer',
            message: message.value.toString(),
            partition: partition.toString(),
            topic: topic.toString(),
          });
        },
      },
    );
  }
}

