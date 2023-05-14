# Mattermost AI Framework

This project demonstrates the ability to run fully private and self-hosted AI chat bots in a multi-user chat environment.

This framework uses a Mattermost app to interface with a variety of LLM AIs. It currently supports locally run LLMs hosted on [Serge](https://github.com/nsarrazin/serge).

### Architecture

The framework consists of three components:
1. A Mattermost server
2. A Serge instance
3. A Mattermost App (AI-Bot) hosted in a

### Setup instructions

1. Clone this repo locally
2. Start the Mattermost server: `cd mattermost && docker compose up`
3. Start the Serge server: `cd serge && docker compose up`
4. Start the AI-Bot app server: `cd ai-bot && docker compose up`
5. Download a Serge model (recommend Gpt4All to start):
  * Open the Serge UI at `http://localhost:8008`
  * Click 'Download Models'
  * Download `GPT4All`
6. Open Mattermost on `http://localhost:8065` and set up an account
7. Install the AI-Bot app by running the following slash command in Mattermost: `/apps install http http://mattermost-apps-ai-bot:9000/manifest.json`
8. You can now ask the bot questions, e.g. `/ai ask "Write a haiku about perseverance"`

### Contributions are welcome!

The current stage is an early proof-of-concept. There are several directions this could go in, including:
* Support for other AI / LLM services
* Additional bot capabilities
* Improved model handling
