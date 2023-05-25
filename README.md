# Mattermost AI Framework

[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/mattermost/mattermost-ai-framework)

[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)

![Screenshot](https://github.com/mattermost/mattermost-ai-framework/assets/46905241/bbdce0f0-08ba-4934-bf94-6ff55d3cc6e7)

## Table of Contents

- [Mattermost AI Framework](#mattermost-ai-framework)
  - [Table of Contents](#table-of-contents)
  - [Background](#background)
  - [Install](#install)
    - [Local](#local)
    - [Gitpod](#gitpod)
  - [Usage](#usage)
    - [Ask a question](#ask-a-question)
    - [Summarize thread](#summarize-thread)
  - [Related Efforts](#related-efforts)
  - [Contributing](#contributing)
  - [License](#license)

## Background

**🚀 Check out [our AI developer website](https://mattermost.github.io/mattermost-ai-site/), join the ["AI Exchange" channel](https://community.mattermost.com/core/channels/ai-exchange), and explore the [peer-to-peer forums](https://forum.mattermost.com/c/ai-frameworks/40) where Mattermost's open source community is sharing AI news and innovation in real time!**

This project is a framework for a self-hosted AI app in a multi-user chat environment that can be fully private and off-grid AKA air-gapped. Check out the [demo from May 15, 2023](https://www.linkedin.com/posts/iantien_opensource-writing-ai-activity-7064180683354636288-161h?utm_source=share&utm_medium=member_desktop). 

This framework uses a locally-deployed [Mattermost](https://mattermost.com/) app to interface with a variety of LLM AIs. It currently supports local LLMs hosted via [Serge](https://github.com/nsarrazin/serge), a wrapper around [llama.cpp](https://github.com/ggerganov/llama.cpp) that can run LLMs without a GPU.

This framework consists of three local components:
1. [Mattermost](https://github.com/mattermost/mattermost-server)
2. [Serge](https://github.com/nsarrazin/serge)
3. `ai-bot`, a [Mattermost app](https://developers.mattermost.com/integrate/apps/) inside the `./ai-bot` folder

`ai-bot` routes communicaiton between the Mattermost and Serge servers via a REST API.

## Install

### Local

You will need [Docker](https://docs.docker.com/get-docker/) installed with `compose`. This repository should work on a 16GB M1 Macbook.

1. Clone and enter this repository:
  * `git clone https://github.com/mattermost/mattermost-ai-framework && cd mattermost-ai-framework`
2. Start the services: `docker compose up -d`
3. Download a Serge model (e.g., GPT4All):
  * Open Serge at `http://localhost:8008`
  * Select **Download Models**
  * Download **GPT4All** and wait for it to finish
4. Access Mattermost
  * Open Mattermost at `http://localhost:8065`
  * Select **View in Browser**
  * Create your local account and team
5. Install the `ai-bot` Mattermost app
  * In any Mattermost channel, use this slash command: `/apps install http http://ai-bot:9000/manifest.json`
  * Accept the permissions in the modal
  * Select **Submit**
  * If unable to complete the above steps, try restarting the app service first: `docker restart ai-bot`

### Gitpod

[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/mattermost/mattermost-ai-framework)

1. Select the above badge to start your Gitpod workspace
2. The workspace will configure itself automatically. Wait for the services to start and for your `root` login for Mattermost to be generated in the terminal
3. Download a Serge model (e.g., GPT4All):
  * Check for blocked pop-ups, or open Serge on the `Ports` tab.
  * Select **Download Models**
  * Download **GPT4All** and wait for it to finish
4. Access Mattermost and log in with the generated `root` credentials
5. Install the `ai-bot` Mattermost app
  * In any Mattermost channel, use this slash command: `/apps install http http://ai-bot:9000/manifest.json`
  * Accept the permissions in the modal
  * Select **Submit**
  * If unable to complete the above steps, try restarting the app service first: `docker restart ai-bot`

You're now ready to use the example `ai-bot`! 🎉

## Usage

### Ask a question

In any channel, you can now ask `ai-bot` questions with the `/ai ask` slash command. For example:
 * `/ai ask "Write a haiku about perseverance"`
 * `/ai ask "Why is open source important?"`
 * `/ai ask "When were pterodactyls alive?"`

|                                                        Slash command                                                         |                                                           Response                                                            |
| :--------------------------------------------------------------------------------------------------------------------------: | :---------------------------------------------------------------------------------------------------------------------------: |
| ![Asking a question](https://github.com/azigler/mattermost-ai-framework/assets/7295363/6f90923e-e8c0-4ac5-9134-cc1e0d69b78e) | ![Getting a response](https://github.com/azigler/mattermost-ai-framework/assets/7295363/bdf6f0f4-3d3d-4e76-8adb-0c01fe5b63c3) |

### Summarize thread

To summarize threads, first grant the bot account access to public channels:
1. Open the top left Mattermost menu button (9 squares) and select **Integrations**
2. Select **Bot Accounts** then **Edit** for `ai-bot`
3. Check the box for **post:channels** (*Bot will have access to post to all Mattermost public channels*)

Now, open the message app menu button (4 squares) on any post in a public channel and select **Summarize (AI)**. You can watch a brief demo of this functionality [here](https://community.mattermost.com/files/k4gdq47njfg6uxuzr5toq5eb4a/public?h=_Lu6LPIGENzL15vfKYSw3AId2yKSGAGySMH9nCRBr24).

|                                                        Message app menu button                                                         |                                                            Response                                                            |
| :------------------------------------------------------------------------------------------------------------------------------------: | :----------------------------------------------------------------------------------------------------------------------------: |
| ![Requesting a thread summary](https://github.com/azigler/mattermost-ai-framework/assets/7295363/0d048925-37b0-47dd-84c0-e7c76ba2cffc) | ![Getting the summary](https://github.com/azigler/mattermost-ai-framework/assets/7295363/019f7e59-23df-4cc5-9268-37677b32837a) |

## Related Efforts

The current stage is an early proof-of-concept. There are several directions this could go in, including:

* Support for other AI/LLM services
* Additional bot capabilities
* Improved model handling
* Better UX

Explore Mattermost's AI initiatives:

* https://ai.mattermost.com
* https://community.mattermost.com/core/channels/ask-chatgpt
* https://forum.mattermost.com/c/ai-frameworks/40
* https://docs.mattermost.com/about/mattermost-customizable-chatgpt-bot-framework.html
* https://mattermost.com/add-chatgpt-to-mattermost/
* https://github.com/crspeller/mattermost-plugin-summarize/
* https://github.com/Brightscout/mattermost-plugin-openai
* https://github.com/yGuy/chatgpt-mattermost-bot

## Contributing

See Mattermost's [contributor guide](https://developers.mattermost.com/contribute/) to learn about contributing to our open source projects like this one.

## License

This repository is licensed under [Apache-2](./LICENSE).
