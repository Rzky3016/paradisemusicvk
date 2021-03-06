import Discord from 'discord.js'
import { prefix } from './config.json'
import fs from 'fs'
import rateLimit from 'axios-rate-limit'
import axios from 'axios'
import { Shoukaku } from 'shoukaku'

import checkPremium from './tools/checkPremium'
import getRightClockEmoji from './tools/getRightClockEmoji'

const http = rateLimit(axios.create(), { maxRPS: 3 })

const client = new Discord.Client({
  messageCacheLifetime: 60,
  messageSweepInterval: 10
})

const queue = new Map()
const captchas = new Map()
const enable247List = new Set()

const cooldowns = new Discord.Collection()
client.commands = new Discord.Collection()

const LavalinkServersString = process.env.LAVALINK_NODES
const LavalinkServers = LavalinkServersString.split(";").map(val => {
  const arr = val.split(",")
  return {
    name: arr[0],
    host: arr[1],
    port: arr[2],
    auth: arr[3]
  }
})

//const LavalinkServer = [{ name: 'vk-music-bot-1', host: 'localhost', port: 2333, auth: 'youshallnotpass' }]
const ShoukakuOptions = { moveOnDisconnect: false, resumable: false, resumableTimeout: 30, reconnectTries: 2, restTimeout: 10000 }

const shoukaku = new Shoukaku(client, LavalinkServers, ShoukakuOptions)

shoukaku.on("ready", name => {
  console.log(`Lavalink ${name} ready!`)
})
shoukaku.on("error", (name, err) => {
  console.log(`Lavalink ${name} error: ${err}`)
})

const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  import(`./commands/${file}`).then(command => {
    client.commands.set(command.default.name, command.default)
  })
}

client.once('ready', () => {
  console.log('Ready!')
})

client.once('reconnecting', () => {
  console.log('Reconnecting...')
})

client.once('disconnect', () => {
  console.log('Disconnect.')
})

client.on('message', async message => {
  if (message.author.bot || !message.content.startsWith(prefix) || message.channel.type != "text") return
  if (!message.channel.permissionsFor(message.client.user).has("SEND_MESSAGES")) return

  let args = message.content.slice(prefix.length).split(/ +/)
  const command = args.shift().toLowerCase()

  console.log(`${message.guild.shardID}/${message.guild.id} ???????????????? ${command} ?? ?????????????????????? ${args}`)

  if (command == "vh") {
    args = client.commands
  }

  const options = {
    captchas,
    queue,
    enable247List,
    captcha: undefined,
    http,
    shoukaku
  }
  try {
    if (command == "vcaptcha") {
      sendCaptcha(message, args, options)
      return message.channel.stopTyping()
    }

    if (!client.commands.has(command)) return

    if (captchas.has(message.member.id)) {
      const captcha = captchas.get(message.member.id)
      message.reply(`???????????? ?????? ?????????????????? ???????????? ????????????, ???? ???????????? ???????????? ??????????! ?????????????? \`-vcaptcha <??????????_??_????????????????>\`. ${captcha.url}`)
      return message.channel.stopTyping()
    }

    if (client.commands.has(command)) {
      const commandHandler = client.commands.get(command)

      // ???????????????? ???????????????? ????????????
      if (!cooldowns.has(commandHandler.name)) {
        cooldowns.set(commandHandler.name, new Discord.Collection())
      }
      
      const now = Date.now()
      const timestamps = cooldowns.get(commandHandler.name)
      const cooldownAmount = (commandHandler.cooldown || 3) * 1000
      
      if (timestamps.has(message.author.id)) {
        const expirationTime = timestamps.get(message.author.id) + cooldownAmount

        if (now < expirationTime) {
          const timeLeft = (expirationTime - now) / 1000

          return message.reply(`????????????????????, ?????????????????? ?????? ${getRightClockEmoji(cooldownAmount, timeLeft * 1000)} ${timeLeft.toFixed(1)} ???????????? ?????????? ?????? ?????? ???????????????????????? \`${commandHandler.name}\`.`)
            .then(msg => msg.delete({timeout: timeLeft * 1000 + 2000}))
        }
      } else {
        timestamps.set(message.author.id, now)
        setTimeout(() => timestamps.delete(message.author.id), cooldownAmount)
      }

      if (commandHandler.premium) {
        return checkPremium(message).then(premium => {
          if (premium) commandHandler.execute(message, args, options)
        })
      } else {
        commandHandler.execute(message, args, options)
      }
    }
  } catch (error) {
    console.error(error)
  } finally {
    message.channel.stopTyping()
  }
})

function sendCaptcha(message, args, options) {
  if (captchas.has(message.member.id)) {
    let captcha = captchas.get(message.member.id)
    captcha.key = args[0]
    options.captcha = captcha

    client.commands.get(captcha.type).execute(message, captcha.args, options)
    
    captchas.delete(message.member.id)
  } else {
    message.reply("?????????? ?????????????? ???? ????????.")
  }
}

client.login(process.env.DISCORD_TOKEN)