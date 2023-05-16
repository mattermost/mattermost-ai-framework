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
		'act_as_user',
	],
	requested_locations: [
		'/channel_header',
		'/command',
		'/post_menu',
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

const postMenuBindings = {
	location: '/post_menu',
	bindings: [
		{
			location: 'summarize-post-button',
			icon: 'icon.png',
			label: 'Summarize (AI)',
			submit: {
				path: '/summarize-post',
				expand: {
					acting_user: "all",
					acting_user_access_token: "all",
					post: "summary",
					root_post: "summary",
				}
			},
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
	console.log('/bindings')
	const callResponse: AppCallResponse<AppBinding[]> = {
		type: 'ok',
		data: [
			channelHeaderBindings,
			commandBindings,
			postMenuBindings,
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
	if (!formValues || !formValues.question) {
		const errorResponse: AppCallResponse = {
			type: 'error',
			text: `Please include a question`,
		}

		res.json(errorResponse)
		return
	}

	setTimeout(async () => {
		// Make LLM query
		const query = formValues.question

		const response = await makeSingleQuery(query)
		const output = `### ${query}\n\n` + compileResponse(response)
		console.log(`Serge response: ${output}`)

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
	}, 0)

	const callResponse: AppCallResponse = {
		type: 'ok',
		text: `AI is thinking... response will be sent in a DM.`,
	}

	res.json(callResponse)
})

app.post('/summarize-post', async (req, res) => {
	console.log(`/summarize-post:\n${JSON.stringify(req.body, null, 2)}`)
	const call = req.body as AppCallRequest

	const postId = req.body?.context?.post?.id
	if (!postId) {
		console.log(`Missing post id`)
		const errorResponse: AppCallResponse = {
			type: 'error',
			text: `Post id not found in request`,
		}

		res.json(errorResponse)
		return
	}

	const userClient = new Client4()
	userClient.setUrl(call.context.mattermost_site_url)
	userClient.setToken(call.context.acting_user_access_token)

	const thread = await userClient.getPostThread(postId)
	console.log(`thread:\n${JSON.stringify(thread, null, 2)}`)

	let combinedThread = ''
	for (const threadPostId of thread.order || []) {
		const post = thread.posts?.[threadPostId]
		// HACKHACK: Remove # which might confuse the LLM
		combinedThread += post.message.replaceAll('#', '') + '\n'
	}

	// Make query to LLM
	const prompt = 'Write a summary of the following in one short sentence:\n' + combinedThread
	console.log(`Making query to ${process.env.SERGE_SITEURL}`)
	console.log(prompt)

	setTimeout(async () => {
		const response = await makeSingleQuery(prompt)

		// Post response back to thread
		const botClient = new Client4()
		botClient.setUrl(call.context.mattermost_site_url)
		botClient.setToken(call.context.bot_access_token)

		const channelId = req.body?.context?.post?.channel_id
		const output = `### Summary:\n\n` + compileResponse(response)
		const summaryPost = {
			channel_id: channelId,
			message: output,
		} as Post

		botClient.createPost(summaryPost)
		console.log(`Summary post sent with ${wordCount(output)} words.`)
	}, 0)

	const callResponse: AppCallResponse = {
		type: 'ok',
		text: `Summarizing thread...`,
	}

	res.json(callResponse)
})

function wordCount(sentence: string): number {
	return sentence.split(/\s+/).length
}

async function makeSingleQuery(prompt: string): Promise<string> {
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
		prompt
	})

	await chat.deleteChatChatChatIdDelete({ chatId })

	return response
}

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
	// Allow model to be overriden with env var
	if (process.env.SERGE_MODEL) {
		model = process.env.SERGE_MODEL
		console.log(`Using model from SERGE_MODEL: ${model}`)
	} else {
		model = await getModel()
	}
}

init()
