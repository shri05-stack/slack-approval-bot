require('dotenv').config();
const { App, LogLevel } = require('@slack/bolt');

// Initialize the Bolt app with your Slack credentials and enhanced logging
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: false,
  appToken: process.env.SLACK_APP_TOKEN,
  logLevel: LogLevel.DEBUG // Set to DEBUG for more verbose logging
});

// Global middleware to log all incoming events
app.use(async ({ logger, body, next }) => {
  logger.debug('Incoming event type:', body.type);
  await next();
});

// Handle the slash command
app.command('/approval-test', async ({ ack, body, client, logger }) => {
  // Acknowledge immediately
  await ack();
  logger.info('Received slash command from user:', body.user_id);
  
  try {
    // Call the views.open method to open a modal
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'approval_modal',
        title: {
          type: 'plain_text',
          text: 'Request Approval'
        },
        blocks: [
          {
            type: 'section',
            block_id: 'approver_block',
            text: {
              type: 'mrkdwn',
              text: 'Select the approver:'
            },
            accessory: {
              action_id: 'approver_select',
              type: 'users_select',
              placeholder: {
                type: 'plain_text',
                text: 'Select an approver'
              }
            }
          },
          {
            type: 'input',
            block_id: 'request_block',
            element: {
              type: 'plain_text_input',
              action_id: 'request_input',
              multiline: true,
              placeholder: {
                type: 'plain_text',
                text: 'What needs approval?'
              }
            },
            label: {
              type: 'plain_text',
              text: 'Request Details'
            }
          }
        ],
        submit: {
          type: 'plain_text',
          text: 'Submit'
        }
      }
    });
    logger.info('Successfully opened modal for user:', body.user_id);
  } catch (error) {
    logger.error('Error opening modal:', error);
  }
});

// Handle modal submission
app.view('approval_modal', async ({ ack, body, view, client, logger }) => {
  // Acknowledge immediately
  await ack();
  logger.info('Modal submitted by user:', body.user.id);
  
  try {
    // Extract the values from the modal
    const approverUserId = view.state.values.approver_block.approver_select.selected_user;
    const requestText = view.state.values.request_block.request_input.value;
    const requesterUserId = body.user.id;
    
    logger.info(`Request from ${requesterUserId} to ${approverUserId}: "${requestText.substring(0, 30)}..."`);
    
    // Send the approval request to the approver with action buttons
    await client.chat.postMessage({
      channel: approverUserId,
      text: `You have a new approval request from <@${requesterUserId}>:`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `You have a new approval request from <@${requesterUserId}>:`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Request:*\n${requestText}`
          }
        },
        {
          type: 'actions',
          block_id: 'approval_actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Approve'
              },
              style: 'primary',
              action_id: 'approve_request',
              value: JSON.stringify({
                requesterUserId,
                requestText
              })
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Reject'
              },
              style: 'danger',
              action_id: 'reject_request',
              value: JSON.stringify({
                requesterUserId,
                requestText
              })
            }
          ]
        }
      ]
    });
    logger.info(`Sent approval request to ${approverUserId}`);
    
    // Notify the requester that their request has been sent
    await client.chat.postMessage({
      channel: requesterUserId,
      text: `Your approval request has been sent to <@${approverUserId}>.`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Your approval request has been sent to <@${approverUserId}>.`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Request:*\n${requestText}`
          }
        }
      ]
    });
    logger.info(`Notified requester ${requesterUserId} that request was sent`);
  } catch (error) {
    logger.error('Error processing modal submission:', error);
  }
});

// Handle the approve action
app.action('approve_request', async ({ ack, body, client, logger }) => {
  // Acknowledge immediately
  await ack();
  logger.info('Approval action received');
  
  try {
    const payload = JSON.parse(body.actions[0].value);
    const { requesterUserId, requestText } = payload;
    const approverUserId = body.user.id;
    
    logger.info(`User ${approverUserId} approved request from ${requesterUserId}`);
    
    // Update the original message to show it was approved
    await client.chat.update({
      channel: body.channel.id,
      ts: body.message.ts,
      text: `You approved a request from <@${requesterUserId}>`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `You approved a request from <@${requesterUserId}>`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Request:*\n${requestText}`
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `:white_check_mark: Approved`
            }
          ]
        }
      ]
    });
    
    // Notify the requester that their request was approved
    await client.chat.postMessage({
      channel: requesterUserId,
      text: `Your request has been approved by <@${approverUserId}>!`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:white_check_mark: Your request has been approved by <@${approverUserId}>!`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Request:*\n${requestText}`
          }
        }
      ]
    });
    logger.info(`Notified requester ${requesterUserId} of approval`);
  } catch (error) {
    logger.error('Error handling approval:', error);
  }
});

// Handle the reject action
app.action('reject_request', async ({ ack, body, client, logger }) => {
  // Acknowledge immediately
  await ack();
  logger.info('Rejection action received');
  
  try {
    const payload = JSON.parse(body.actions[0].value);
    const { requesterUserId, requestText } = payload;
    const approverUserId = body.user.id;
    
    logger.info(`User ${approverUserId} rejected request from ${requesterUserId}`);
    
    // Update the original message to show it was rejected
    await client.chat.update({
      channel: body.channel.id,
      ts: body.message.ts,
      text: `You rejected a request from <@${requesterUserId}>`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `You rejected a request from <@${requesterUserId}>`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Request:*\n${requestText}`
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `:x: Rejected`
            }
          ]
        }
      ]
    });
    
    // Notify the requester that their request was rejected
    await client.chat.postMessage({
      channel: requesterUserId,
      text: `Your request has been rejected by <@${approverUserId}>.`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:x: Your request has been rejected by <@${approverUserId}>.`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Request:*\n${requestText}`
          }
        }
      ]
    });
    logger.info(`Notified requester ${requesterUserId} of rejection`);
  } catch (error) {
    logger.error('Error handling rejection:', error);
  }
});

// Handle user selection in the modal
app.action('approver_select', async ({ ack }) => {
  await ack();
});

// Error handling middleware
app.error(async (error) => {
  console.error('Global error handler caught:', error);
});

// Start the Express server
(async () => {
  try {
    const port = process.env.PORT || 3000;
    await app.start(port);
    console.log(`⚡️ Bolt app is running on port ${port}!`);
  } catch (error) {
    console.error('Failed to start app:', error);
  }
})();