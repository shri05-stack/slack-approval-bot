# Slack Approval Bot

A Slack bot for managing approval workflows within an organization. Built with Node.js and the Slack Bolt framework.

## Features

- Slash command `/approval-test` to initiate approval requests
- Modal interface for selecting approvers and entering request details
- Approval/rejection workflow with notifications
- Real-time status updates for both requesters and approvers

## Setup

1. Clone the repository
2. Install dependencies with `npm install`
3. Create a `.env` file with your Slack credentials: 
SLACK_BOT_TOKEN=xoxb-your-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_APP_TOKEN=your-app-token
PORT=3000
4. 4. Run the app with `node app.js`

## Deployment

This app is deployed on Vercel.
