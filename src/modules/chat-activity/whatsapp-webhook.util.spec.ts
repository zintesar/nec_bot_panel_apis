import { iterTextMessages } from './whatsapp-webhook.util';

describe('iterTextMessages', () => {
  it('should extract messages from smb_message_echoes sample payload', () => {
    const payload = {
      sample: {
        field: 'smb_message_echoes',
        value: {
          messaging_product: 'whatsapp',
          metadata: {
            display_phone_number: '16505551111',
            phone_number_id: '123456123',
          },
          message_echoes: [
            {
              from: '16315551181',
              to: '11234567890',
              id: 'ABGGFlA5Fpa',
              timestamp: '1504902988',
              type: 'text',
              text: {
                body: 'this is a text message',
              },
            },
          ],
        },
      },
      sub_field_options: null,
      sample_context_metadata: null,
    };

    const result = iterTextMessages(payload);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      from: '16315551181',
      to: '11234567890',
      sender: '16315551181',
      recipient: '11234567890',
      body: 'this is a text message',
      messageId: 'ABGGFlA5Fpa',
      timestamp: '1504902988',
      type: 'text',
      name: '',
      displayPhoneNumber: '16505551111',
      isEcho: true,
    });
  });

  it('should extract messages from live webhook smb_message_echoes payload', () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '123456',
          changes: [
            {
              field: 'smb_message_echoes',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '16505551111',
                  phone_number_id: '123456123',
                },
                message_echoes: [
                  {
                    from: '16315551181',
                    to: '11234567890',
                    id: 'ABGGFlA5Fpa',
                    timestamp: '1504902988',
                    type: 'text',
                    text: {
                      body: 'outgoing echo message',
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const result = iterTextMessages(payload);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      from: '16315551181',
      to: '11234567890',
      sender: '16315551181',
      recipient: '11234567890',
      body: 'outgoing echo message',
      messageId: 'ABGGFlA5Fpa',
      timestamp: '1504902988',
      type: 'text',
      name: '',
      displayPhoneNumber: '16505551111',
      isEcho: true,
    });
  });

  it('should extract standard incoming user messages', () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '123456',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '16505551111',
                  phone_number_id: '123456123',
                },
                contacts: [
                  {
                    profile: { name: 'John Doe' },
                    wa_id: '11234567890',
                  },
                ],
                messages: [
                  {
                    from: '11234567890',
                    id: 'wamid.HBgL',
                    timestamp: '1504902988',
                    type: 'text',
                    text: {
                      body: 'hello world',
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const result = iterTextMessages(payload);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      from: '11234567890',
      sender: '11234567890',
      body: 'hello world',
      messageId: 'wamid.HBgL',
      timestamp: '1504902988',
      type: 'text',
      name: 'John Doe',
      displayPhoneNumber: '16505551111',
    });
  });

  it('should safely ignore non-text messages or empty payloads', () => {
    expect(iterTextMessages(null)).toEqual([]);
    expect(iterTextMessages({})).toEqual([]);
    expect(
      iterTextMessages({
        sample: {
          field: 'smb_message_echoes',
          value: {
            message_echoes: [
              {
                from: '16315551181',
                type: 'image',
                image: { id: 'img1' },
              },
            ],
          },
        },
      }),
    ).toEqual([]);
  });
});

