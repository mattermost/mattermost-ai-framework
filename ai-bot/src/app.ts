import express from 'express'

// Shim for mattermost-redux global fetch access
global.fetch = require('node-fetch')

import { AppBinding, AppCallRequest, AppCallResponse, AppForm, AppManifest } from '@mattermost/types/lib/apps'
import { Channel } from '@mattermost/types/lib/channels'
import { Post } from '@mattermost/types/lib/posts'

import { Client4 } from '@mattermost/client'

import { Configuration } from './serge_api'
import { ChatApi } from './serge_api/apis/ChatApi'
import { ModelApi } from './serge_api/apis/ModelApi'

let model = ''

const host = process.env.APP_HOST || 'localhost'
const port = process.env.APP_PORT || 9000

console.log(`host: ${host}:${port}`)

const app = express()
app.use(express.json())

// Uncomment these lines to enable verbose debugging of requests and responses
// import logger from './middleware/logger';
// app.use(logger);

app.use((req, res, next) => {
	const call: AppCallRequest = req.body

	// This is used to interact with the Mattermost server in the docker-compose dev environment.
	// We ignore the site URL sent in call requests, and instead use the known site URL from the environment variable.
	if (call?.context?.mattermost_site_url && process.env.MATTERMOST_SITEURL) {
		call.context.mattermost_site_url = process.env.MATTERMOST_SITEURL
	}

	next()
})

const manifest = {
	app_id: 'ai-app',
	display_name: "AI Bot",
	description: "AI Bot",
	homepage_url: 'https://github.com/chenilim/mattermost-ai-framework/ai-bot',
	app_type: 'http',
	icon: 'icon.png',
	http: {
		root_url: `http://${host}:${port}`,
	},
	requested_permissions: [
		'act_as_bot',
	],
	requested_locations: [
		'/channel_header',
		'/command',
	],
} as AppManifest

const form: AppForm = {
	title: "What is your question?",
	icon: 'icon.png',
	fields: [
		{
			type: 'text',
			name: 'question',
			label: 'question',
			position: 1,
		},
	],
	submit: {
		path: '/submit',
		expand: {
			acting_user: "all",
			acting_user_access_token: "all",
		}
	},
}

const channelHeaderBindings = {
	location: '/channel_header',
	bindings: [
		{
			location: 'send-button',
			icon: 'icon.png',
			label: 'Ask AI',
			form,
		},
	],
} as AppBinding

const commandBindings = {
	location: '/command',
	bindings: [
		{
			icon: 'icon.png',
			label: 'ai',
			description: manifest.description,
			hint: '[ask]',
			bindings: [
				{
					location: 'ask',
					label: 'ask',
					form,
				},
			],
		},
	],
} as AppBinding

// Serve resources from the static folder
app.use('/static', express.static('./static'))

app.get('/manifest.json', (req, res) => {
	res.json(manifest)
})

app.post('/bindings', (req, res) => {
	const callResponse: AppCallResponse<AppBinding[]> = {
		type: 'ok',
		data: [
			channelHeaderBindings,
			commandBindings,
		],
	}

	res.json(callResponse)
})

type FormValues = {
	question: string
}

app.post('/submit', async (req, res) => {
	console.log(`/submit:\n${JSON.stringify(req.body, null, 2)}`)
	const call = req.body as AppCallRequest

	if (!model) {
		console.log('Checking Serge for available models...')
		model = await getModel()
	}

	const botClient = new Client4()
	botClient.setUrl(call.context.mattermost_site_url)
	botClient.setToken(call.context.bot_access_token)

	const formValues = call.values as FormValues

	const query = formValues.question
	let output = ''
	if (query) {
		console.log(`Making query to ${process.env.SERGE_SITEURL}`)
		const config = new Configuration({
			basePath: process.env.SERGE_SITEURL + '/api'
		})
		const chat = new ChatApi(config)

		const chatId: string = await chat.createNewChatChatPost({
			model
		})

		console.log(`Created new chat, id: ${chatId}`)
		const response = await chat.streamAskAQuestionChatChatIdQuestionGet({
			chatId,
			prompt: query
		})

		output = `### ${query}\n\n` + compileResponse(response)
		console.log(`Serge response: ${output}`)

		await chat.deleteChatChatChatIdDelete({ chatId })
	}

	const users = [
		call.context.bot_user_id,
		call.context.acting_user.id,
	] as string[]

	let channel: Channel
	try {
		channel = await botClient.createDirectChannel(users)
	} catch (e: any) {
		res.json({
			type: 'error',
			error: 'Failed to create/fetch DM channel: ' + e.message,
		})
		return
	}

	const post = {
		channel_id: channel.id,
		message: output,
	} as Post

	try {
		await botClient.createPost(post)
	} catch (e: any) {
		res.json({
			type: 'error',
			error: 'Failed to create post in DM channel: ' + e.message,
		})
		return
	}

	const callResponse: AppCallResponse = {
		type: 'ok',
		text: `I've responded as a DM to you`,
	}

	res.json(callResponse)
})

function compileResponse(response: string): string {
	// This is hokey code to compile an event stream into a single response string
	let result = ''
	const lines = response.split('\r\n')
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]
		if (line.startsWith('event: message') && i < lines.length) {
			const nextLine = lines[i + 1]
			if (nextLine.startsWith('data: ')) {
				result += nextLine.substr(6)
				i++
			}
		}
	}

	return result
}

app.listen(port, () => {
	console.log(`app listening on port ${port}`)
})

// Returns the first available model in Serge
// TODO: Improve model selection
async function getModel(): Promise<string> {
	console.log(`Making query to ${process.env.SERGE_SITEURL}`)
	const config = new Configuration({
		basePath: process.env.SERGE_SITEURL + '/api'
	})

	const modelApi = new ModelApi(config)
	const models: any[] = await modelApi.listOfAllModelsModelAllGet()
	// console.log(`models: ${JSON.stringify(models, null, 2)}`)
	const model = models.find(o => o.available)
	if (model) {
		console.log(`Found model: ${model.name}`)
	} else {
		console.error(`No Serge model found. Please download a model in Serge.`)
	}

	return model ? model.name : ''
}

async function init() {
	model = await getModel()
}

init()
