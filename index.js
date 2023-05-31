const { Client, Events, GatewayIntentBits, EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const crypto = require('crypto')
const levenshtein = require('js-levenshtein')
const config = require('./config.json');
require('dotenv').config()

class ChannelData {
	constructor(channelId) {
		this.id = channelId
		this.messages = []
		this.messagesraw = []
	}
}

class UserData {
	constructor(userId) {
		this.id = userId
		this.originals = 0;
		this.unoriginals = 0;
		this.mutePeriod = config.initialMutePeriod/4; //with first mute this quadruples to 2
		this.muteTime = 0;
		this.lastDecay = 0;
	}
}

function parseDate(seconds) {
	let parsed = ""
	days = Math.floor(seconds/86400)
	if (days > 0) parsed += `${days} day${days > 1 ? 's' : ''}, `;
	hours = Math.floor(seconds/3600)%24
	if (hours > 0) parsed += `${hours} hour${hours > 1 ? 's' : ''}, `;
	minutes = Math.floor(seconds/60)%60
	if (minutes > 0) parsed += `${minutes} minute${minutes > 1 ? 's' : ''}, `;
	sec = seconds%60
	if (sec > 0) parsed += `${sec} second${sec > 1 ? 's' : ''}`;
	return parsed;
}

function updateConfig(expr) {
	eval(`config.${expr}`)
	fs.writeFileSync('./config.json',JSON.stringify(config))
}

async function run(message) {
	try {
		//do nothing if in DMs or its a bot message
		if (message.channel.isDMBased() || message.author.bot) return;
		let isStaff = message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)
		let serverTemplate = {
			channels: [],
			users: [
				new UserData(message.author.id)
			]
		}
		let server = serverTemplate
		//check if data directory exists, creating it if its not
		if (!fs.existsSync(`./data`)) { fs.mkdirSync('./data') }
		//check if server data already exists, overwriting server template
		let serverDataExists = fs.existsSync(`./data/${message.guildId}.json`)
		if (serverDataExists) { server = JSON.parse(fs.readFileSync(`./data/${message.guildId}.json`)) }
		if (!server.useLOM) server.useLOM = false;
		//get current user
		let user = server.users.find(user => user.id == message.author.id)
		if (!user) {
			server.users.push(new UserData(message.author.id))
			user = server.users.find(user => user.id == message.author.id)
		}
		/* check for decay:
		if user mute has expired AND the decay period ended
		(duration specified in config or double the current mute period, whichever is greater) */
		if (user.muteTime > 0) {
			let decay = Math.max(user.mutePeriod*2, config.decayTime)
			if (Date.now()-user.muteTime >= (user.mutePeriod+decay)*1000) {user.mutePeriod = Math.max(user.mutePeriod/config.muteDecayMultiplier, 2); user.lastDecay = Date.now()}
		}
		//get current channel
		let channel = await server.channels.find(channel => channel.id == message.channelId)
		//top tier command handling (i was too lazy to write an actual handler)
		if (message.content.startsWith(`${config.prefix}eval`)) {
			if (!config.evalAccess.find(id => id == message.author.id)) return;
			let runstr = message.content.substring(config.prefix.length+4)
			try { output = await eval(runstr); await message.reply(String(output)); fs.writeFileSync(`./data/${message.guildId}.json`, JSON.stringify(server)) }
			catch (error) { await message.reply(String(error)); console.log(error) }
			return
		}
		switch (message.content) {
			case `${config.prefix}lom`:
				if (!isStaff) return;
				server.useLOM = !server.useLOM;
				await message.reply(`LOM has been ${server.useLOM ? 'enabled' : 'disabled'}.`);
				break;
			case `${config.prefix}clear`:
				if (!isStaff) return;
				server = serverTemplate;
				await message.reply('Server data cleared');
				break;
			case `${config.prefix}add`:
				if (!isStaff) return;
				if (channel) {await message.reply('Channel is already in watchlist!'); return}
				server.channels.push(new ChannelData(message.channelId));
				await message.reply('Channel added to watchlist');
				break;
			case `${config.prefix}remove`:
				if (!isStaff) return;
				if (!channel) {await message.reply('Channel is not in watchlist!'); return}
				server.channels.splice(server.channels.indexOf(channel), 1)
				await message.reply('Removed channel from watchlist');
				break;
			case `${config.prefix}watchlist`:
				let desc = ''
				server.channels.forEach(channel => desc += `<#${channel.id}> - ${channel.messages.length} recorded message(s)\n`)
				let watchlist = new EmbedBuilder()
					.setTitle(`Channel watchlist for ${message.guild.name}`)
					.setDescription(desc)
					.setColor('Blue')
				await message.reply({embeds: [watchlist]})
				break;
			case `${config.prefix}stats`:
				let muted = Date.now()-user.muteTime < user.mutePeriod*1000
				let muteExpiry = user.muteTime+user.mutePeriod*1000
				let muteDecay = 0;
				if (user.lastDecay < muteExpiry) muteDecay = muteExpiry+Math.max(user.mutePeriod*2, config.decayTime)*1000
				else muteDecay = user.lastDecay+Math.max(user.mutePeriod*2, config.decayTime)*1000
				let decayText = `${user.mutePeriod < config.initialMutePeriod ? 'never' : '<t:'+Math.floor(muteDecay/1000)+':R>'}`
				let alsoDecayText = `${user.mutePeriod <= config.initialMutePeriod ? '-' : parseDate(user.mutePeriod/config.muteDecayMultiplier)}`
				let muteStatus = `${muted ? 'Muted' : 'Not muted'} (${muted ? 'expires' : 'decays'} ${muted ? '<t:'+Math.floor(muteExpiry/1000)+':R>' : decayText})`
				let stats = new EmbedBuilder()
					.setTitle(`Stats for ${message.author.username}`)
					.addFields(
						{ name: 'Original/unoriginal messages', value: `${user.originals} / ${user.unoriginals}`, inline: true },
						{ name: 'Mute status', value: muteStatus },
						{ name: 'Mute duration', value: `**Current/last**: ${user.mutePeriod >= config.initialMutePeriod ? parseDate(user.mutePeriod) : '-'}
						**On next mute**: ${parseDate(user.mutePeriod*config.muteMultiplier)}
						**After decay**: ${alsoDecayText}
						` }
					)
					.setColor('Orange')
				await message.reply({embeds: [stats]})
				break;
			default:
				//do not continue if channel is not found, meaning its not in the watchlist
				if (!channel || (isStaff && config.ignoreStaff)) return;
				//refuse messages from muted users
				if (Date.now()-user.muteTime < user.mutePeriod*1000) {
					await message.delete()
					await message.author.send(`You are currently muted and cannot send messages. You will be unmuted <t:${Math.floor((user.muteTime+user.mutePeriod*1000)/1000)}:R>`)
					return;
				}
				//filter message
				let msg = message.content
				let regexes = [
					config.filterList.mentions ? /<@(.*?)>/g : /(?!)/g,
					config.filterList.channels ? /<#(.*?)>/g : /(?!)/g,
					config.filterList.links ? /https?:\/\/.+\..+/g : /(?!)/g,
					config.filterList.customEmojis ? /<:(.*?):(.*?)>/g : /(?!)/g,
					config.filterList.punctuation ? /\p{P}/gu : /(?!)/g,
				]
				regexes.forEach(regex => msg = msg.replace(regex, ''))
				msg = msg.replace(config.filterList.defaultEmojis ? /\p{Extended_Pictographic}/gu : /(?!)/g, '')
				msg = msg.trim().toLowerCase();
				console.log(msg)
				let nonascii = /[^\u0000-\u007f]/g;
				let matches = msg.matchAll(nonascii)
				for (match in matches) {
						message.author.send('Sorry, messages cannot contain non-ASCII chatacters.');
						message.delete();
						return;
				}
				let isOriginal = true
				if (message.attachments.length > 0 && message.content == '' && config.allowAttachments) {
					fs.writeFileSync(`./data/${message.guildId}.json`, JSON.stringify(server)); return
				}
				let curHash;
				//run originality check
				if (server.useLOM) {
					console.log(channel.messagesraw)
					if (channel.messagesraw.length > 0) {
						channel.messagesraw.every(message => {
							let score = levenshtein(msg, message)/Math.max(message.length, 1)
							console.log(msg, message, score)
							isOriginal = score >= config.originalityThreshold
							return isOriginal
						})
					}
				} else {
					//hash current message
					curHash = await crypto.createHash('sha256').update(msg).digest('hex')
					console.log(curHash)
					//check if message is already registered
					if (channel.messages.find(hash => hash == curHash)) isOriginal = false;
				}
				if (isOriginal) {
					user.originals++
					channel.messages.push(curHash)
					channel.messagesraw.push(msg)
				} else {
					user.unoriginals++
					user.mutePeriod *= config.muteMultiplier
					user.muteTime = Date.now()
					message.author.send(`Sorry, your message has been deleted for being unoriginal. You have been muted for ${parseDate(user.mutePeriod)}.`)
					message.delete();
				}
		}
		//convert server data to JSON and save to file
		fs.writeFileSync(`./data/${message.guildId}.json`, JSON.stringify(server))
	} catch (error) {
		console.log(error)
		message.reply(String(error))
	}
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.DirectMessages, GatewayIntentBits.MessageContent] });

client.once(Events.ClientReady, c => {
	console.log('Bot online');
})

client.on('messageCreate', async message => {
	run(message)
})

client.on('messageUpdate', async message => {
	run(message)
})

client.login(process.env.token);